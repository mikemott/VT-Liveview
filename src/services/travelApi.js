/**
 * Travel API Service
 * Fetches incident data from multiple sources:
 * - VT 511 (Vermont incidents, construction, lane closures)
 * - USGS Water Services (flood gauges)
 */

import { fetchAllVT511Data } from './vt511Api';

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
    if (import.meta.env.DEV) {
      console.error('Error fetching USGS flood data:', error);
    }
    return [];
  }
}

/**
 * Fetch all travel incidents from all sources
 * @returns {Promise<Array>} All incidents combined
 */
export async function fetchAllIncidents() {
  try {
    const [vt511Data, floods] = await Promise.all([
      fetchAllVT511Data(),
      fetchFloodGauges()
    ]);

    return [...vt511Data, ...floods];
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error fetching incidents:', error);
    }
    return [];
  }
}
