/**
 * Color scheme for travel incidents
 * Categorical colors for different incident types
 */

export const INCIDENT_COLORS = {
  ACCIDENT: {
    primary: '#8B5CF6',
    background: '#8B5CF620',
    name: 'purple'
  },
  CONSTRUCTION: {
    primary: '#F97316',
    background: '#F9731620',
    name: 'orange'
  },
  CLOSURE: {
    primary: '#3B82F6',
    background: '#3B82F620',
    name: 'blue'
  },
  FLOODING: {
    primary: '#14B8A6',
    background: '#14B8A620',
    name: 'teal'
  },
  HAZARD: {
    primary: '#F59E0B',
    background: '#F59E0B20',
    name: 'amber'
  }
};

/**
 * Get color for incident type
 * @param {string} type - Incident type (ACCIDENT, CONSTRUCTION, etc.)
 * @returns {object} Color object with primary and background
 */
export function getIncidentColor(type) {
  return INCIDENT_COLORS[type] || INCIDENT_COLORS.HAZARD;
}

/**
 * Get severity level for zoom-based filtering
 * @param {object} incident - Incident object
 * @returns {string} Severity level: CRITICAL, MAJOR, MODERATE, MINOR
 */
export function getIncidentSeverity(incident) {
  // Accidents are major (always visible at zoom 8+)
  if (incident.type === 'ACCIDENT') {
    return 'MAJOR';
  }

  // Flooding is major (always visible at zoom 8+)
  if (incident.type === 'FLOODING') {
    return 'MAJOR';
  }

  // Construction and road closures are moderate (only visible at zoom 10+)
  if (incident.type === 'CONSTRUCTION' || incident.type === 'CLOSURE') {
    return 'MODERATE';
  }

  // Everything else is minor
  return 'MINOR';
}

/**
 * Determine if incident should be visible at current zoom level
 * @param {object} incident - Incident object
 * @param {number} zoom - Current map zoom level
 * @returns {boolean} True if incident should be visible
 */
export function shouldShowIncident(incident, zoom) {
  const severity = getIncidentSeverity(incident);

  if (zoom < 8) {
    // Only show critical incidents when zoomed out
    return severity === 'CRITICAL';
  } else if (zoom < 10) {
    // Show critical and major incidents at medium zoom
    return severity === 'CRITICAL' || severity === 'MAJOR';
  } else {
    // Show all incidents when zoomed in
    return true;
  }
}
