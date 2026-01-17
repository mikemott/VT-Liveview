/**
 * Color scheme for travel incidents
 * Categorical colors for different incident types
 */

import type { IncidentType, IncidentSeverity, IncidentColor, IncidentColorMap, Incident } from '@/types';

/** Color configuration for each incident type */
export const INCIDENT_COLORS: IncidentColorMap = {
  ACCIDENT: {
    primary: '#8B5CF6',
    background: '#8B5CF620',
    name: 'purple',
  },
  CONSTRUCTION: {
    primary: '#F97316',
    background: '#F9731620',
    name: 'orange',
  },
  CLOSURE: {
    primary: '#3B82F6',
    background: '#3B82F620',
    name: 'blue',
  },
  FLOODING: {
    primary: '#14B8A6',
    background: '#14B8A620',
    name: 'teal',
  },
  HAZARD: {
    primary: '#F59E0B',
    background: '#F59E0B20',
    name: 'amber',
  },
} as const;

/**
 * Get color configuration for an incident type
 * @param type - Incident type (ACCIDENT, CONSTRUCTION, etc.)
 * @returns Color object with primary and background colors
 */
export function getIncidentColor(type: IncidentType): IncidentColor {
  return INCIDENT_COLORS[type] ?? INCIDENT_COLORS.HAZARD;
}

/**
 * Get severity level for zoom-based filtering
 * @param incident - Incident object with type property
 * @returns Severity level: CRITICAL, MAJOR, MODERATE, or MINOR
 */
export function getIncidentSeverity(incident: Pick<Incident, 'type'>): IncidentSeverity {
  // Road closures are always critical
  if (incident.type === 'CLOSURE') {
    return 'CRITICAL';
  }

  // Accidents are major
  if (incident.type === 'ACCIDENT') {
    return 'MAJOR';
  }

  // Flooding is major
  if (incident.type === 'FLOODING') {
    return 'MAJOR';
  }

  // Construction is moderate
  if (incident.type === 'CONSTRUCTION') {
    return 'MODERATE';
  }

  // Everything else is minor
  return 'MINOR';
}

/**
 * Determine if incident should be visible at current zoom level
 * Uses severity-based filtering to reduce clutter at lower zoom levels
 *
 * @param incident - Incident object with type property
 * @param zoom - Current map zoom level
 * @returns True if incident should be visible at the given zoom
 */
export function shouldShowIncident(incident: Pick<Incident, 'type'>, zoom: number): boolean {
  // Special handling for closures - only show when zoomed in to keep initial view clean
  if (incident.type === 'CLOSURE') {
    return zoom >= 9;
  }

  const severity = getIncidentSeverity(incident);

  if (zoom < 8) {
    // Only show critical incidents when zoomed out (closures already filtered above)
    return severity === 'CRITICAL';
  } else if (zoom < 10) {
    // Show critical and major incidents at medium zoom
    return severity === 'CRITICAL' || severity === 'MAJOR';
  } else {
    // Show all incidents when zoomed in
    return true;
  }
}
