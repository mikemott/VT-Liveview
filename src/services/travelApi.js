/**
 * Travel API Service
 * Fetches incident data from multiple sources:
 * - HERE Traffic API (accidents, closures, construction)
 * - USGS Water Services (flood gauges)
 * - VTrans ArcGIS (construction projects)
 */

import { mapHereIncidentType } from '../utils/incidentColors';

// Vermont bounding box
const VERMONT_BOUNDS = {
  west: -73.4,
  south: 42.7,
  east: -71.5,
  north: 45.1
};

/**
 * Check if coordinates are valid and within Vermont bounds
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {boolean} True if valid
 */
function isValidVermontCoordinate(lat, lng) {
  if (!lat || !lng || lat === 0 || lng === 0) return false;
  // Vermont bounds with small buffer
  return lat >= 42.6 && lat <= 45.2 && lng >= -73.5 && lng <= -71.4;
}

/**
 * Extract the best available coordinates from HERE incident location
 * @param {object} incident - HERE incident object
 * @returns {object|null} {lat, lng} or null if no valid coordinates
 */
function extractHereCoordinates(incident) {
  const links = incident.location?.shape?.links || [];

  // Try to get coordinates from the first link's points
  for (const link of links) {
    const points = link?.points || [];
    if (points.length > 0) {
      // Use the midpoint if multiple points, otherwise first point
      const midIndex = Math.floor(points.length / 2);
      const point = points[midIndex];
      if (point?.lat && point?.lng && isValidVermontCoordinate(point.lat, point.lng)) {
        return { lat: point.lat, lng: point.lng };
      }
    }
  }

  // Fallback: try to get from location description coordinates if available
  const locDesc = incident.location?.description;
  if (locDesc?.coordinate) {
    const { lat, lng } = locDesc.coordinate;
    if (isValidVermontCoordinate(lat, lng)) {
      return { lat, lng };
    }
  }

  return null;
}

/**
 * Extract road name from HERE incident
 * @param {object} incident - HERE incident object
 * @returns {string} Road name
 */
function extractHereRoadName(incident) {
  // Try multiple sources for road name
  const location = incident.location;

  // Primary: road name from description
  if (location?.description?.value) {
    return location.description.value;
  }

  // Secondary: try to extract from the first link's name or reference
  const firstLink = location?.shape?.links?.[0];
  if (firstLink?.names?.[0]?.value) {
    return firstLink.names[0].value;
  }

  // Tertiary: use the incident title itself if it contains road info
  const title = incident.incidentDetails?.description?.value || '';
  if (title.includes('on ') || title.includes('at ')) {
    return title;
  }

  return 'Unknown Road';
}

/**
 * Check if a HERE incident is currently active based on time
 * @param {object} incidentDetails - HERE incident details
 * @returns {object} {isActive, status}
 */
function getHereIncidentTimeStatus(incidentDetails) {
  const now = new Date();
  const startTime = incidentDetails?.startTime ? new Date(incidentDetails.startTime) : null;
  const endTime = incidentDetails?.endTime ? new Date(incidentDetails.endTime) : null;

  // If no times provided, assume active
  if (!startTime && !endTime) {
    return { isActive: true, status: 'ongoing' };
  }

  // Check if incident hasn't started yet
  if (startTime && startTime > now) {
    const hoursUntilStart = (startTime - now) / (1000 * 60 * 60);
    // Only show if starting within 24 hours
    if (hoursUntilStart <= 24) {
      return { isActive: true, status: 'scheduled', hoursUntilStart };
    }
    return { isActive: false, status: 'future' };
  }

  // Check if incident has ended
  if (endTime && endTime < now) {
    const hoursSinceEnd = (now - endTime) / (1000 * 60 * 60);
    // Allow a small grace period of 30 minutes for recently ended incidents
    if (hoursSinceEnd <= 0.5) {
      return { isActive: true, status: 'ending' };
    }
    return { isActive: false, status: 'expired' };
  }

  return { isActive: true, status: 'active' };
}

/**
 * Fetch incidents from HERE Traffic API
 * @param {object} bounds - Map bounds {west, south, east, north}
 * @returns {Promise<Array>} Normalized incidents
 */
export async function fetchHereIncidents(bounds = VERMONT_BOUNDS) {
  const apiKey = import.meta.env.VITE_HERE_API_KEY;

  if (!apiKey) {
    console.warn('HERE API key not configured');
    return [];
  }

  try {
    const bbox = `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`;
    const url = `https://data.traffic.hereapi.com/v7/incidents?locationReferencing=shape&in=bbox:${bbox}&apiKey=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HERE API error: ${response.status}`);
    }

    const data = await response.json();

    // Normalize HERE incidents to our format, filtering out invalid/expired ones
    const incidents = [];

    for (const incident of (data.results || [])) {
      // Check time-based activity status
      const timeStatus = getHereIncidentTimeStatus(incident.incidentDetails);
      if (!timeStatus.isActive) {
        continue; // Skip expired or far-future incidents
      }

      // Extract and validate coordinates
      const coords = extractHereCoordinates(incident);
      if (!coords) {
        continue; // Skip incidents with no valid location
      }

      const location = incident.location?.shape?.links?.[0];

      incidents.push({
        id: `here-${incident.incidentDetails?.id || Math.random()}`,
        type: mapHereIncidentType(incident.incidentDetails?.type),
        title: incident.incidentDetails?.description?.value || 'Traffic Incident',
        description: incident.incidentDetails?.description?.value || '',
        location: coords,
        geometry: location?.points || null,
        severity: incident.incidentDetails?.criticality?.description || 'MINOR',
        startTime: incident.incidentDetails?.startTime,
        endTime: incident.incidentDetails?.endTime,
        timeStatus: timeStatus.status,
        source: 'HERE Traffic',
        roadName: extractHereRoadName(incident)
      });
    }

    return incidents;
  } catch (error) {
    console.error('Error fetching HERE incidents:', error);
    return [];
  }
}

/**
 * Fetch flood gauge data from USGS
 * @returns {Promise<Array>} Flood incidents
 */
export async function fetchFloodGauges() {
  try {
    // Fetch Vermont river gauges with gage height parameter
    const url = 'https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=VT&parameterCd=00065&siteStatus=active';

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`USGS API error: ${response.status}`);
    }

    const data = await response.json();

    const floods = [];

    // Parse USGS data and identify flooding conditions
    if (data.value?.timeSeries) {
      for (const series of data.value.timeSeries) {
        const siteInfo = series.sourceInfo;
        const values = series.values?.[0]?.value;

        if (!values || values.length === 0) continue;

        const latestValue = values[values.length - 1];
        const gageHeight = parseFloat(latestValue.value);
        const latestTime = new Date(latestValue.dateTime);
        const now = new Date();
        const hoursSinceReading = (now - latestTime) / (1000 * 60 * 60);

        // Only show if data is recent (within last 3 hours) and height is significant
        // TODO: Improve with actual flood stage data from USGS flood categories
        const isRecentData = hoursSinceReading < 3;
        const isFlooding = gageHeight > 15; // Higher threshold to reduce false positives

        if (isFlooding && isRecentData) {
          const lat = siteInfo.geoLocation?.geogLocation?.latitude;
          const lng = siteInfo.geoLocation?.geogLocation?.longitude;

          // Validate coordinates are in Vermont
          if (!isValidVermontCoordinate(lat, lng)) {
            continue;
          }

          // Determine severity based on gage height
          const severity = gageHeight > 25 ? 'CRITICAL' : 'MAJOR';
          const minutesSinceReading = Math.round(hoursSinceReading * 60);

          floods.push({
            id: `usgs-${siteInfo.siteCode[0].value}`,
            type: 'FLOODING',
            title: `Flooding at ${siteInfo.siteName}`,
            description: `Gage height: ${gageHeight.toFixed(2)} ft (updated ${minutesSinceReading} min ago)`,
            location: { lat, lng },
            geometry: null,
            severity,
            startTime: latestValue.dateTime,
            timeStatus: 'active',
            source: 'USGS Water Services',
            roadName: siteInfo.siteName
          });
        }
      }
    }

    return floods;
  } catch (error) {
    console.error('Error fetching USGS flood data:', error);
    return [];
  }
}

/**
 * Extract coordinates from various GeoJSON geometry types
 * @param {object} geometry - GeoJSON geometry object
 * @returns {object|null} {lat, lng} or null if invalid
 */
function extractGeoJSONCoordinates(geometry) {
  if (!geometry || !geometry.coordinates) return null;

  const coords = geometry.coordinates;
  let lng, lat;

  switch (geometry.type) {
    case 'Point':
      // [lng, lat]
      [lng, lat] = coords;
      break;

    case 'LineString':
    case 'MultiPoint':
      // [[lng, lat], [lng, lat], ...]
      // Use midpoint for better positioning
      if (coords.length > 0) {
        const midIndex = Math.floor(coords.length / 2);
        [lng, lat] = coords[midIndex];
      }
      break;

    case 'Polygon':
      // [[[lng, lat], ...]] - use centroid of first ring
      if (coords[0] && coords[0].length > 0) {
        const ring = coords[0];
        const midIndex = Math.floor(ring.length / 2);
        [lng, lat] = ring[midIndex];
      }
      break;

    case 'MultiLineString':
      // [[[lng, lat], ...], ...] - use midpoint of first line
      if (coords[0] && coords[0].length > 0) {
        const midIndex = Math.floor(coords[0].length / 2);
        [lng, lat] = coords[0][midIndex];
      }
      break;

    default:
      return null;
  }

  if (!isValidVermontCoordinate(lat, lng)) {
    return null;
  }

  return { lat, lng };
}

/**
 * Check if a VTrans construction project is currently active based on dates
 * @param {object} props - Feature properties with StartDate and EndDate
 * @returns {object} {isActive, status}
 */
function getConstructionDateStatus(props) {
  const now = new Date();

  // Parse dates - VTrans may use various formats
  const parseDate = (dateValue) => {
    if (!dateValue) return null;
    // Handle epoch milliseconds (common in ArcGIS)
    if (typeof dateValue === 'number') {
      return new Date(dateValue);
    }
    // Handle string dates
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const startDate = parseDate(props.StartDate);
  const endDate = parseDate(props.EndDate);

  // If no dates provided, assume active
  if (!startDate && !endDate) {
    return { isActive: true, status: 'ongoing' };
  }

  // Check if project hasn't started yet
  if (startDate && startDate > now) {
    const daysUntilStart = (startDate - now) / (1000 * 60 * 60 * 24);
    // Show upcoming projects within 7 days
    if (daysUntilStart <= 7) {
      return { isActive: true, status: 'upcoming', daysUntilStart: Math.ceil(daysUntilStart) };
    }
    return { isActive: false, status: 'future' };
  }

  // Check if project has ended
  if (endDate && endDate < now) {
    const daysSinceEnd = (now - endDate) / (1000 * 60 * 60 * 24);
    // Allow 1 day grace period for recently completed projects
    if (daysSinceEnd <= 1) {
      return { isActive: true, status: 'completing' };
    }
    return { isActive: false, status: 'completed' };
  }

  // Project is currently active
  if (endDate) {
    const daysRemaining = (endDate - now) / (1000 * 60 * 60 * 24);
    return { isActive: true, status: 'active', daysRemaining: Math.ceil(daysRemaining) };
  }

  return { isActive: true, status: 'active' };
}

/**
 * Fetch construction projects from VTrans ArcGIS
 * @returns {Promise<Array>} Construction incidents
 */
export async function fetchVTransConstruction() {
  try {
    // VTrans construction projects layer
    // Note: You may need to verify the exact service URL
    const url = 'https://maps.vtrans.vermont.gov/arcgis/rest/services/VTrans511/511lookup/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson';

    const response = await fetch(url);

    if (!response.ok) {
      // If the service doesn't exist or is different, return empty array
      console.warn('VTrans construction data not available');
      return [];
    }

    const data = await response.json();

    // Normalize VTrans data to our format, filtering out inactive projects
    const projects = [];

    for (const feature of (data.features || [])) {
      const props = feature.properties || {};

      // Check date-based activity status
      const dateStatus = getConstructionDateStatus(props);
      if (!dateStatus.isActive) {
        continue; // Skip completed or far-future projects
      }

      // Extract and validate coordinates from various geometry types
      const coords = extractGeoJSONCoordinates(feature.geometry);
      if (!coords) {
        continue; // Skip features with no valid location
      }

      // Build a more informative description
      let description = props.Description || 'Construction project';
      if (dateStatus.status === 'upcoming' && dateStatus.daysUntilStart) {
        description = `Starts in ${dateStatus.daysUntilStart} day${dateStatus.daysUntilStart > 1 ? 's' : ''} - ${description}`;
      } else if (dateStatus.status === 'active' && dateStatus.daysRemaining) {
        description = `${dateStatus.daysRemaining} day${dateStatus.daysRemaining > 1 ? 's' : ''} remaining - ${description}`;
      }

      projects.push({
        id: `vtrans-${props.OBJECTID || projects.length}`,
        type: 'CONSTRUCTION',
        title: props.ProjectName || props.PROJECT_NAME || 'Road Work',
        description,
        location: coords,
        geometry: feature.geometry,
        severity: 'MODERATE',
        startTime: props.StartDate,
        endTime: props.EndDate,
        timeStatus: dateStatus.status,
        source: 'VTrans',
        roadName: props.RoadName || props.ROAD_NAME || props.Route || 'Unknown Road'
      });
    }

    return projects;
  } catch (error) {
    console.error('Error fetching VTrans construction:', error);
    return [];
  }
}

/**
 * Fetch all travel incidents from all sources
 * @param {object} bounds - Map bounds (optional)
 * @returns {Promise<Array>} All incidents combined
 */
export async function fetchAllIncidents(bounds) {
  try {
    const [hereIncidents, floods, construction] = await Promise.all([
      fetchHereIncidents(bounds),
      fetchFloodGauges(),
      fetchVTransConstruction()
    ]);

    return [...hereIncidents, ...floods, ...construction];
  } catch (error) {
    console.error('Error fetching incidents:', error);
    return [];
  }
}
