/**
 * Vermont 511 API Service
 * Fetches incident and construction data from New England 511 system
 * Data source: https://nec-por.ne-compass.com/NEC.XmlDataPortal/
 */

// Use backend proxy to avoid CORS issues
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

/**
 * Parse XML string to DOM
 * @param {string} xmlString - XML data
 * @returns {Document} Parsed XML document
 */
function parseXML(xmlString) {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'text/xml');
}

/**
 * Get text content from XML element
 * @param {Element} parent - Parent element
 * @param {string} tagName - Tag name to find
 * @returns {string|null} Text content or null
 */
function getElementText(parent, tagName) {
  try {
    if (!parent) return null;
    const element = parent.querySelector(tagName);
    return element?.textContent || null;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn(`Error querying element ${tagName}:`, error);
    }
    return null;
  }
}

/**
 * Convert microdegree coordinates to decimal degrees
 * @param {string} microDegrees - Coordinate in microdegrees
 * @returns {number} Coordinate in decimal degrees
 */
function microDegreesToDecimal(microDegrees) {
  try {
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
 * @param {Element} element - Incident or closure XML element
 * @returns {object|null} GeoJSON LineString geometry or null
 */
function parseRouteGeometry(element) {
  try {
    if (!element) return null;

    const startLocation = element.querySelector('startLocation');
    const endLocation = element.querySelector('endLocation');
    const midpointsContainer = element.querySelector('midpoints');

    if (!startLocation || !endLocation) return null;

    const coordinates = [];

    // Add start point
    const startLat = getElementText(startLocation, 'lat');
    const startLon = getElementText(startLocation, 'lon');
    if (startLat && startLon) {
      coordinates.push([
        microDegreesToDecimal(startLon),
        microDegreesToDecimal(startLat)
      ]);
    }

    // Add midpoints if available
    if (midpointsContainer) {
      const points = midpointsContainer.querySelectorAll('point');
      const sortedPoints = Array.from(points).sort((a, b) => {
        const orderA = parseInt(getElementText(a, 'order') || '0');
        const orderB = parseInt(getElementText(b, 'order') || '0');
        return orderA - orderB;
      });

      sortedPoints.forEach(point => {
        const lat = getElementText(point, 'lat');
        const lon = getElementText(point, 'lon');
        if (lat && lon) {
          coordinates.push([
            microDegreesToDecimal(lon),
            microDegreesToDecimal(lat)
          ]);
        }
      });
    }

    // Add end point
    const endLat = getElementText(endLocation, 'lat');
    const endLon = getElementText(endLocation, 'lon');
    if (endLat && endLon) {
      coordinates.push([
        microDegreesToDecimal(endLon),
        microDegreesToDecimal(endLat)
      ]);
    }

    if (coordinates.length < 2) return null;

    return {
      type: 'LineString',
      coordinates: coordinates
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
 * @param {Element} typeElement - Type element with attributes
 * @returns {string} Incident type
 */
function mapIncidentType(typeElement) {
  if (!typeElement) return 'HAZARD';

  const attrs = typeElement.attributes;
  for (let i = 0; i < attrs.length; i++) {
    const attrName = attrs[i].name;
    if (attrName === 'Construction' || attrName === 'RoadWork') return 'CONSTRUCTION';
    if (attrName === 'BridgeOut' || attrName === 'BridgeMaintenance') return 'CLOSURE';
    if (attrName === 'Accident') return 'ACCIDENT';
  }

  return 'HAZARD';
}

/**
 * Map VT 511 severity to our severity levels
 * @param {string} severity - VT 511 severity (Low/Medium/High)
 * @returns {string} Our severity level
 */
function mapSeverity(severity) {
  const severityMap = {
    'Low': 'MINOR',
    'Medium': 'MODERATE',
    'High': 'MAJOR'
  };
  return severityMap[severity] || 'MINOR';
}

/**
 * Parse incident from XML element
 * @param {Element} incidentElement - Incident XML element
 * @returns {object|null} Normalized incident or null if parsing fails
 */
function parseIncident(incidentElement) {
  try {
    if (!incidentElement) return null;

    const startLocation = incidentElement.querySelector('startLocation');
    const lat = getElementText(startLocation, 'lat');
    const lon = getElementText(startLocation, 'lon');
    const typeElement = incidentElement.querySelector('type');
    const roadRestrictions = incidentElement.querySelector('roadRestrictions');

    return {
      id: `vt511-incident-${incidentElement.getAttribute('id') || Date.now()}`,
      type: mapIncidentType(typeElement),
      title: getElementText(incidentElement, 'desc')?.split('.')[0] || 'Traffic Incident',
      description: getElementText(incidentElement, 'desc') || '',
      location: {
        lat: lat ? microDegreesToDecimal(lat) : 0,
        lng: lon ? microDegreesToDecimal(lon) : 0
      },
      geometry: parseRouteGeometry(incidentElement),
      severity: mapSeverity(getElementText(incidentElement, 'severity')),
      startTime: getElementText(incidentElement, 'createdTimestamp'),
      endTime: null,
      source: 'VT 511',
      roadName: `${getElementText(startLocation, 'roadway') || 'Unknown Road'} in ${getElementText(startLocation, 'city') || 'Unknown City'}`,
      affectedLanes: getElementText(incidentElement, 'affectedLanesDescription'),
      roadRestrictions: {
        weight: getElementText(roadRestrictions, 'weight'),
        width: getElementText(roadRestrictions, 'width')
      }
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
 * @param {Element} closureElement - Lane closure XML element
 * @returns {object|null} Normalized incident or null if parsing fails
 */
function parseLaneClosure(closureElement) {
  try {
    if (!closureElement) return null;

    const startLocation = closureElement.querySelector('startLocation');
    const lat = getElementText(startLocation, 'lat');
    const lon = getElementText(startLocation, 'lon');
    const desc = getElementText(closureElement, 'desc') || '';

    // Extract work schedule from description if present
    const hasSchedule = desc.includes('AM') || desc.includes('PM');
    const title = desc.split('.')[0] || 'Construction';

    return {
      id: `vt511-closure-${closureElement.getAttribute('id') || Date.now()}`,
      type: 'CONSTRUCTION',
      title: title.length > 100 ? title.substring(0, 97) + '...' : title,
      description: desc,
      location: {
        lat: lat ? microDegreesToDecimal(lat) : 0,
        lng: lon ? microDegreesToDecimal(lon) : 0
      },
      geometry: parseRouteGeometry(closureElement),
      severity: mapSeverity(getElementText(closureElement, 'severity')),
      startTime: getElementText(closureElement, 'createdTimestamp'),
      endTime: null,
      source: 'VT 511',
      roadName: `${getElementText(startLocation, 'roadway') || 'Unknown Road'} in ${getElementText(startLocation, 'city') || 'Unknown City'}`,
      affectedLanes: getElementText(closureElement, 'affectedLanesDescription'),
      hasSchedule: hasSchedule
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Error parsing lane closure:', error);
    }
    return null;
  }
}

/**
 * Fetch incident data from VT 511 (via backend proxy)
 * @returns {Promise<Array>} Array of incidents
 */
export async function fetchVT511Incidents() {
  try {
    const url = `${BACKEND_URL}/api/vt511/incidents`;
    const response = await fetch(url);

    if (!response.ok) {
      // VT 511 data unavailable - silently return empty array('VT 511 incident data not available');
      return [];
    }

    const xmlText = await response.text();
    const xmlDoc = parseXML(xmlText);

    const incidents = xmlDoc.querySelectorAll('incident');
    return Array.from(incidents)
      .map(parseIncident)
      .filter(incident => incident !== null); // Filter out failed parses
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error fetching VT 511 incidents:', error);
    }
    return [];
  }
}

/**
 * Fetch lane closure (construction) data from VT 511 (via backend proxy)
 * @returns {Promise<Array>} Array of lane closures
 */
export async function fetchVT511LaneClosures() {
  try {
    const url = `${BACKEND_URL}/api/vt511/closures`;
    const response = await fetch(url);

    if (!response.ok) {
      // VT 511 data unavailable - silently return empty array('VT 511 lane closure data not available');
      return [];
    }

    const xmlText = await response.text();
    const xmlDoc = parseXML(xmlText);

    const closures = xmlDoc.querySelectorAll('laneClosure');
    return Array.from(closures)
      .map(parseLaneClosure)
      .filter(closure => closure !== null); // Filter out failed parses
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error fetching VT 511 lane closures:', error);
    }
    return [];
  }
}

/**
 * Fetch all VT 511 data (incidents + lane closures)
 * @returns {Promise<Array>} Combined incidents and closures
 */
export async function fetchAllVT511Data() {
  try {
    const [incidents, closures] = await Promise.all([
      fetchVT511Incidents(),
      fetchVT511LaneClosures()
    ]);

    return [...incidents, ...closures];
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error fetching VT 511 data:', error);
    }
    return [];
  }
}
