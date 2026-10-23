/**
 * Vermont 511 API Service
 * Fetches incident and construction data from New England 511 system
 * Data source: https://nec-por.ne-compass.com/NEC.XmlDataPortal/
 */

import type { IncidentType, IncidentSeverity } from '@/types';

// =============================================================================
// Types
// =============================================================================

/** Location coordinates */
interface Location {
  lat: number;
  lng: number;
}

/** GeoJSON LineString geometry for routes */
interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][]; // [lng, lat] pairs
}

/** Road restrictions from VT 511 */
interface RoadRestrictions {
  weight: string | null;
  width: string | null;
}

/** Base VT 511 incident/closure data */
export interface VT511ParsedIncident {
  id: string;
  type: IncidentType;
  title: string;
  description: string;
  location: Location;
  geometry: RouteGeometry | null;
  severity: IncidentSeverity;
  startTime: string | null;
  endTime: null;
  source: 'VT 511';
  roadName: string;
  affectedLanes: string | null;
  roadRestrictions?: RoadRestrictions;
  eventType?: string;
  eventSubType?: string;
  hasSchedule?: boolean;
}

// =============================================================================
// Internal Constants
// =============================================================================

/** Backend URL for proxy endpoints */
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

// =============================================================================
// XML Parsing Utilities
// =============================================================================

/**
 * Parse XML string to DOM Document
 */
function parseXML(xmlString: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'text/xml');
}

/**
 * Get text content from XML element
 */
function getElementText(parent: Element | null, tagName: string): string | null {
  try {
    if (!parent) return null;
    const element = parent.querySelector(tagName);
    return element?.textContent ?? null;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`Error querying element ${tagName}:`, error);
    }
    return null;
  }
}

/**
 * Convert microdegree coordinates to decimal degrees
 */
function microDegreesToDecimal(microDegrees: string | null): number {
  try {
    if (!microDegrees) return 0;
    const value = parseFloat(microDegrees);
    if (isNaN(value)) return 0;
    return value / 1000000;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`Error converting microdegrees: ${microDegrees}`, error);
    }
    return 0;
  }
}

/**
 * Parse route geometry from incident/closure element
 */
function parseRouteGeometry(element: Element | null): RouteGeometry | null {
  try {
    if (!element) return null;

    const startLocation = element.querySelector('startLocation');
    const endLocation = element.querySelector('endLocation');
    const midpointsContainer = element.querySelector('midpoints');

    if (!startLocation || !endLocation) return null;

    const coordinates: [number, number][] = [];

    // Add start point
    const startLat = getElementText(startLocation, 'lat');
    const startLon = getElementText(startLocation, 'lon');
    if (startLat && startLon) {
      coordinates.push([microDegreesToDecimal(startLon), microDegreesToDecimal(startLat)]);
    }

    // Add midpoints if available
    if (midpointsContainer) {
      const points = midpointsContainer.querySelectorAll('point');
      const sortedPoints = Array.from(points).sort((a, b) => {
        const orderA = parseInt(getElementText(a, 'order') ?? '0', 10);
        const orderB = parseInt(getElementText(b, 'order') ?? '0', 10);
        return orderA - orderB;
      });

      sortedPoints.forEach((point) => {
        const lat = getElementText(point, 'lat');
        const lon = getElementText(point, 'lon');
        if (lat && lon) {
          coordinates.push([microDegreesToDecimal(lon), microDegreesToDecimal(lat)]);
        }
      });
    }

    // Add end point
    const endLat = getElementText(endLocation, 'lat');
    const endLon = getElementText(endLocation, 'lon');
    if (endLat && endLon) {
      coordinates.push([microDegreesToDecimal(endLon), microDegreesToDecimal(endLat)]);
    }

    if (coordinates.length < 2) return null;

    return {
      type: 'LineString',
      coordinates: coordinates,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Error parsing route geometry:', error);
    }
    return null;
  }
}

/**
 * Map VT 511 incident type to our incident types
 */
function mapIncidentType(typeElement: Element | null): IncidentType {
  if (!typeElement) return 'HAZARD';

  const attrs = typeElement.attributes;
  for (let i = 0; i < attrs.length; i++) {
    const attrName = attrs[i]?.name;
    if (attrName === 'Construction' || attrName === 'RoadWork') return 'CONSTRUCTION';
    if (attrName === 'BridgeOut' || attrName === 'BridgeMaintenance') return 'CLOSURE';
    if (attrName === 'Accident') return 'ACCIDENT';
  }

  return 'HAZARD';
}

/** Severity mapping from VT 511 to our types */
const SEVERITY_MAP: Record<string, IncidentSeverity> = {
  Low: 'MINOR',
  Medium: 'MODERATE',
  High: 'MAJOR',
};

/**
 * Map VT 511 severity to our severity levels
 */
function mapSeverity(severity: string | null): IncidentSeverity {
  if (!severity) return 'MINOR';
  return SEVERITY_MAP[severity] ?? 'MINOR';
}

// =============================================================================
// Incident Parsing
// =============================================================================

/**
 * Parse incident from XML element
 */
function parseIncident(incidentElement: Element): VT511ParsedIncident | null {
  try {
    const startLocation = incidentElement.querySelector('startLocation');
    const lat = getElementText(startLocation, 'lat');
    const lon = getElementText(startLocation, 'lon');
    const typeElement = incidentElement.querySelector('type');
    const roadRestrictions = incidentElement.querySelector('roadRestrictions');

    const desc = getElementText(incidentElement, 'desc') ?? '';
    const titleParts = desc.split('.');

    return {
      id: `vt511-incident-${incidentElement.getAttribute('id') ?? Date.now()}`,
      type: mapIncidentType(typeElement),
      title: titleParts[0] || 'Traffic Incident',
      description: desc,
      location: {
        lat: microDegreesToDecimal(lat),
        lng: microDegreesToDecimal(lon),
      },
      geometry: parseRouteGeometry(incidentElement),
      severity: mapSeverity(getElementText(incidentElement, 'severity')),
      startTime: getElementText(incidentElement, 'createdTimestamp'),
      endTime: null,
      source: 'VT 511',
      roadName: `${getElementText(startLocation, 'roadway') ?? 'Unknown Road'} in ${getElementText(startLocation, 'city') ?? 'Unknown City'}`,
      affectedLanes: getElementText(incidentElement, 'affectedLanesDescription'),
      roadRestrictions: {
        weight: getElementText(roadRestrictions, 'weight'),
        width: getElementText(roadRestrictions, 'width'),
      },
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Error parsing incident:', error);
    }
    return null;
  }
}

/**
 * Parse lane closure from XML element
 */
function parseLaneClosure(closureElement: Element): VT511ParsedIncident | null {
  try {
    const startLocation = closureElement.querySelector('startLocation');
    const lat = getElementText(startLocation, 'lat');
    const lon = getElementText(startLocation, 'lon');
    const desc = getElementText(closureElement, 'desc') ?? '';

    // Extract work schedule from description if present
    const hasSchedule = desc.includes('AM') || desc.includes('PM');
    const titleParts = desc.split('.');
    let title = titleParts[0] || 'Construction';
    if (title.length > 100) {
      title = title.substring(0, 97) + '...';
    }

    return {
      id: `vt511-closure-${closureElement.getAttribute('id') ?? Date.now()}`,
      type: 'CONSTRUCTION',
      title,
      description: desc,
      location: {
        lat: microDegreesToDecimal(lat),
        lng: microDegreesToDecimal(lon),
      },
      geometry: parseRouteGeometry(closureElement),
      severity: mapSeverity(getElementText(closureElement, 'severity')),
      startTime: getElementText(closureElement, 'createdTimestamp'),
      endTime: null,
      source: 'VT 511',
      roadName: `${getElementText(startLocation, 'roadway') ?? 'Unknown Road'} in ${getElementText(startLocation, 'city') ?? 'Unknown City'}`,
      affectedLanes: getElementText(closureElement, 'affectedLanesDescription'),
      hasSchedule,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Error parsing lane closure:', error);
    }
    return null;
  }
}

// =============================================================================
// Public API Functions
// =============================================================================

/**
 * Type guard to filter out null values
 */
function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

/**
 * Fetch and parse one VT 511 XML feed from the backend proxy.
 * Throws on HTTP or network errors so callers can tell an outage apart from
 * a quiet day with no incidents.
 */
async function fetchVT511Feed<T>(
  path: string,
  label: string,
  selector: string,
  parse: (el: Element) => T | null,
): Promise<T[]> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(`Error fetching ${label}:`, error);
    }
    throw new Error(`${label} unavailable (network error)`);
  }
  if (!response.ok) {
    throw new Error(`${label} unavailable (HTTP ${response.status})`);
  }
  const xmlDoc = parseXML(await response.text());
  // A 200 with a broken or non-XML body must not read as an empty feed
  if (xmlDoc.getElementsByTagName('parsererror').length > 0 || !xmlDoc.documentElement) {
    throw new Error(`${label} unavailable (malformed response)`);
  }
  return Array.from(xmlDoc.querySelectorAll(selector)).map(parse).filter(isNotNull);
}

/**
 * Fetch incident data from VT 511 (via backend proxy). Rejects if unavailable.
 */
export function fetchVT511Incidents(): Promise<VT511ParsedIncident[]> {
  return fetchVT511Feed('/api/vt511/incidents', 'VT 511 incidents', 'incident', parseIncident);
}

/**
 * Fetch lane closure (construction) data from VT 511 (via backend proxy).
 * Rejects if unavailable.
 */
export function fetchVT511LaneClosures(): Promise<VT511ParsedIncident[]> {
  return fetchVT511Feed(
    '/api/vt511/closures',
    'VT 511 lane closures',
    'laneClosure',
    parseLaneClosure,
  );
}

/**
 * Fetch all VT 511 data (incidents + lane closures). Returns whatever loaded;
 * rejects only when both feeds fail.
 */
export async function fetchAllVT511Data(): Promise<VT511ParsedIncident[]> {
  const [incidents, closures] = await Promise.allSettled([
    fetchVT511Incidents(),
    fetchVT511LaneClosures(),
  ]);
  if (incidents.status === 'rejected' && closures.status === 'rejected') {
    throw incidents.reason;
  }
  return [
    ...(incidents.status === 'fulfilled' ? incidents.value : []),
    ...(closures.status === 'fulfilled' ? closures.value : []),
  ];
}
