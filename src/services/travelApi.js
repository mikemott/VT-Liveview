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

    // Normalize HERE incidents to our format
    return (data.results || []).map(incident => {
      const location = incident.location?.shape?.links?.[0];
      const coords = location?.points?.[0];

      return {
        id: `here-${incident.incidentDetails?.id || Math.random()}`,
        type: mapHereIncidentType(incident.incidentDetails?.type),
        title: incident.incidentDetails?.description?.value || 'Traffic Incident',
        description: incident.incidentDetails?.description?.value || '',
        location: {
          lat: coords?.lat || 0,
          lng: coords?.lng || 0
        },
        geometry: location?.points || null,
        severity: incident.incidentDetails?.criticality?.description || 'MINOR',
        startTime: incident.incidentDetails?.startTime,
        endTime: incident.incidentDetails?.endTime,
        source: 'HERE Traffic',
        roadName: location?.functionalClass || 'Unknown Road'
      };
    });
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
          floods.push({
            id: `usgs-${siteInfo.siteCode[0].value}`,
            type: 'FLOODING',
            title: `Flooding at ${siteInfo.siteName}`,
            description: `Gage height: ${gageHeight.toFixed(2)} ft`,
            location: {
              lat: siteInfo.geoLocation.geogLocation.latitude,
              lng: siteInfo.geoLocation.geogLocation.longitude
            },
            geometry: null,
            severity: 'MAJOR',
            startTime: latestValue.dateTime,
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

    // Normalize VTrans data to our format
    return (data.features || []).map((feature, index) => {
      const props = feature.properties;
      const coords = feature.geometry.coordinates;

      return {
        id: `vtrans-${props.OBJECTID || index}`,
        type: 'CONSTRUCTION',
        title: props.ProjectName || 'Road Work',
        description: props.Description || 'Construction project',
        location: {
          lat: coords[1],
          lng: coords[0]
        },
        geometry: feature.geometry,
        severity: 'MODERATE',
        startTime: props.StartDate,
        endTime: props.EndDate,
        source: 'VTrans',
        roadName: props.RoadName || 'Unknown Road'
      };
    });
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
