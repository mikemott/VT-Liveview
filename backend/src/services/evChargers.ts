/**
 * Public EV charging stations in Vermont from the U.S. DOE Alternative Fuels
 * Data Center (AFDC) station locator (VTL-81).
 *
 * The API moved from developer.nrel.gov to developer.nlr.gov when NREL was
 * renamed (2025); the old host no longer answers. It needs an api.data.gov
 * key (AFDC_API_KEY). Without one we use DEMO_KEY, which allows 30 requests
 * an hour per IP: plenty for one request per TTL, but get a real key for
 * production.
 *
 * Response shapes follow a recorded v1 response (Oct 2026).
 */
import { cachedLoader } from './c2c.js';

const AFDC = 'https://developer.nlr.gov/api/alt-fuel-stations/v1.json';
/** Stations change slowly; the AFDC refreshes its data daily */
const TTL_MS = 12 * 3600_000;
const REQUEST_TIMEOUT_MS = 20_000;

export interface EvCharger {
  /** AFDC station id */
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  lat: number;
  lng: number;
  network: string | null;
  networkUrl: string | null;
  dcFastPorts: number;
  level2Ports: number;
  /** Highest rated power across the station's ports, when reported */
  maxKw: number | null;
  /** Connector standards, e.g. ["CCS", "NACS (Tesla)"] */
  connectors: string[];
  hours: string | null;
  pricing: string | null;
  /** e.g. "Hotel", "Grocery" */
  facility: string | null;
  /** YYYY-MM-DD */
  lastConfirmed: string | null;
}

interface RawStation {
  id?: number;
  station_name?: string;
  street_address?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  status_code?: string;
  access_code?: string;
  ev_network?: string | null;
  ev_network_web?: string | null;
  ev_dc_fast_num?: number | null;
  ev_level2_evse_num?: number | null;
  ev_connector_types?: string[] | null;
  ev_charging_units?: {
    connectors?: Record<string, { power_kw?: number | null; port_count?: number } | undefined>;
  }[];
  access_days_time?: string | null;
  ev_pricing?: string | null;
  facility_type?: string | null;
  date_last_confirmed?: string | null;
}

const CONNECTOR_NAMES: Record<string, string> = {
  J1772: 'J1772',
  J1772COMBO: 'CCS',
  CHADEMO: 'CHAdeMO',
  TESLA: 'NACS (Tesla)',
  J3400: 'NACS (J3400)',
  NEMA515: 'NEMA 5-15',
  NEMA520: 'NEMA 5-20',
  NEMA1450: 'NEMA 14-50',
};

/** "Non-Networked" and AFDC's code-like names, made readable */
export function networkName(raw: string | null | undefined): string | null {
  const n = raw?.trim();
  if (!n || /^non-networked$/i.test(n)) return null;
  return n.replace(/ Network$/, '').replace(/_/g, ' ');
}

/** "HOTEL" → "Hotel", "CAR_DEALER" → "Car dealer" */
function facilityName(raw: string | null | undefined): string | null {
  const f = raw?.trim();
  if (!f) return null;
  const words = f.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const text = (s: string | null | undefined): string | null => s?.trim() || null;

export function parseStations(body: unknown): EvCharger[] {
  const rows = (body as { fuel_stations?: unknown } | null)?.fuel_stations;
  if (!Array.isArray(rows)) return [];
  const out: EvCharger[] = [];
  for (const s of rows as (RawStation | null)[]) {
    if (!s || typeof s !== 'object' || typeof s.id !== 'number') continue;
    const { latitude: lat, longitude: lng } = s;
    if (typeof lat !== 'number' || typeof lng !== 'number' || (lat === 0 && lng === 0)) continue;
    // Open, public stations only (the query asks for these; double-check)
    if ((s.status_code ?? 'E') !== 'E' || (s.access_code ?? 'public') !== 'public') continue;
    const dcFastPorts = s.ev_dc_fast_num ?? 0;
    const level2Ports = s.ev_level2_evse_num ?? 0;
    if (dcFastPorts + level2Ports === 0) continue; // Level 1 only: not useful on the road

    let maxKw: number | null = null;
    for (const unit of s.ev_charging_units ?? []) {
      for (const c of Object.values(unit.connectors ?? {})) {
        if (c && (c.port_count ?? 0) > 0 && typeof c.power_kw === 'number' && c.power_kw > 0) {
          maxKw = Math.max(maxKw ?? 0, Math.round(c.power_kw));
        }
      }
    }
    out.push({
      id: String(s.id),
      name: text(s.station_name) ?? 'EV charging station',
      address: text(s.street_address),
      city: text(s.city),
      lat,
      lng,
      network: networkName(s.ev_network),
      networkUrl: /^https:\/\//.test(s.ev_network_web ?? '') ? s.ev_network_web! : null,
      dcFastPorts,
      level2Ports,
      maxKw,
      connectors: [...new Set((s.ev_connector_types ?? []).map((c) => CONNECTOR_NAMES[c] ?? c))],
      hours: text(s.access_days_time),
      pricing: text(s.ev_pricing),
      facility: facilityName(s.facility_type),
      lastConfirmed: /^\d{4}-\d{2}-\d{2}$/.test(s.date_last_confirmed ?? '')
        ? s.date_last_confirmed!
        : null,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function createEvChargerService(apiKey: string | undefined) {
  const stations = cachedLoader(TTL_MS, async () => {
    const url = new URL(AFDC);
    url.searchParams.set('api_key', apiKey || 'DEMO_KEY');
    url.searchParams.set('state', 'VT');
    url.searchParams.set('fuel_type', 'ELEC');
    url.searchParams.set('status', 'E');
    url.searchParams.set('access', 'public');
    url.searchParams.set('limit', 'all');
    const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`AFDC: HTTP ${res.status}`);
    return parseStations(await res.json());
  });

  return {
    getStations: () => stations.get(),
    /** For tests. */
    reset: () => stations.reset(),
  };
}
