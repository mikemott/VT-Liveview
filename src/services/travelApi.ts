/**
 * Travel API Service
 * Fetches incident data from multiple sources:
 * - VT 511 (Vermont incidents, construction, lane closures)
 * - NWS river gauges at minor flood stage or above, via the backend (VTL-89)
 */

import { fetchRiverGauges, type FloodCategory, type RiverGauge } from './riverApi';
import { fetchVT511Incidents, fetchVT511LaneClosures, type VT511ParsedIncident } from './vt511Api';

// =============================================================================
// Types
// =============================================================================

/** Location coordinates */
interface Location {
  lat: number;
  lng: number;
}

/** A river gauge that is flooding */
export interface FloodIncident {
  id: string;
  type: 'FLOODING';
  title: string;
  description: string;
  location: Location;
  geometry: null;
  severity: 'MAJOR';
  startTime: string;
  source: 'NWS river gauges';
  roadName: string;
}

/** Combined incident type from all sources */
export type TravelIncident = VT511ParsedIncident | FloodIncident;

// =============================================================================
// Flooding (NWS river gauges)
// =============================================================================

/** Observed flood categories that count as flooding, with their labels */
const FLOODING: Partial<Record<FloodCategory, string>> = {
  minor: 'Minor flooding',
  moderate: 'Moderate flooding',
  major: 'Major flooding',
};

function toFloodIncident(gauge: RiverGauge): FloodIncident | null {
  const label = FLOODING[gauge.category];
  if (!label || !gauge.observedAt) return null;
  const stage = gauge.stageFt === null ? '' : ` · ${gauge.stageFt.toFixed(1)} ft`;
  return {
    id: `flood-${gauge.id}`,
    type: 'FLOODING',
    title: `${label} at ${gauge.name}`,
    description: `${label}${stage}`,
    location: { lat: gauge.lat, lng: gauge.lng },
    geometry: null,
    severity: 'MAJOR',
    startTime: gauge.observedAt,
    source: 'NWS river gauges',
    roadName: gauge.name,
  };
}

/**
 * Gauges at minor flood stage or above, using the NWS flood categories. The
 * backend caches the gauge list (one NWPS call per 10 minutes for everyone);
 * it replaced the browser's direct USGS call, which took 7-10 s and is being
 * retired (VTL-89).
 */
export async function fetchFloodGauges(): Promise<FloodIncident[]> {
  const gauges = await fetchRiverGauges();
  return gauges.map(toFloodIncident).filter((f): f is FloodIncident => f !== null);
}

// =============================================================================
// Aggregated Data
// =============================================================================

/** Incidents plus the names of any sources that failed to load. */
export interface IncidentFetchResult {
  incidents: TravelIncident[];
  /** Human-readable names of sources that failed, e.g. "VT 511 incidents". */
  unavailableSources: string[];
}

const INCIDENT_SOURCES: { label: string; fetch: () => Promise<TravelIncident[]> }[] = [
  { label: 'VT 511 incidents', fetch: fetchVT511Incidents },
  { label: 'VT 511 lane closures', fetch: fetchVT511LaneClosures },
  { label: 'River gauges', fetch: fetchFloodGauges },
];

/**
 * Fetch travel incidents from every source and report which ones failed.
 * An outage in one source must not hide the others' incidents, but it also
 * must not look like "no incidents". Rejects only when every source fails.
 * `onSource` lets a caller show fast sources before the slowest one returns.
 */
export async function fetchAllIncidentsWithStatus(
  /** Called with each source's incidents as soon as that source loads */
  onSource?: (label: string, incidents: TravelIncident[]) => void,
): Promise<IncidentFetchResult> {
  const results = await Promise.allSettled(
    INCIDENT_SOURCES.map(async (source) => {
      const incidents = await source.fetch();
      onSource?.(source.label, incidents);
      return incidents;
    }),
  );

  const incidents: TravelIncident[] = [];
  const unavailableSources: string[] = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') incidents.push(...result.value);
    else unavailableSources.push(INCIDENT_SOURCES[i]?.label ?? 'Unknown source');
  });

  if (unavailableSources.length === INCIDENT_SOURCES.length) {
    const firstFailure = results.find((r) => r.status === 'rejected');
    if (import.meta.env.DEV) {
      console.error('Error fetching incidents: all sources failed', results);
    }
    throw firstFailure?.status === 'rejected' && firstFailure.reason instanceof Error
      ? firstFailure.reason
      : new Error('Travel incident data is unavailable');
  }

  return { incidents, unavailableSources };
}

/**
 * Fetch all travel incidents from all sources. Rejects only when every
 * source fails; see fetchAllIncidentsWithStatus for partial-outage details.
 */
export async function fetchAllIncidents(): Promise<TravelIncident[]> {
  return (await fetchAllIncidentsWithStatus()).incidents;
}
