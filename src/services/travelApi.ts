/**
 * Travel API Service
 * Fetches incident data from multiple sources:
 * - VT 511 (Vermont incidents, construction, lane closures)
 * - USGS Water Services (flood gauges)
 */

import { fetchAllVT511Data, type VT511ParsedIncident } from './vt511Api';

// =============================================================================
// Types
// =============================================================================

/** Location coordinates */
interface Location {
  lat: number;
  lng: number;
}

/** USGS flood gauge parsed data */
export interface FloodIncident {
  id: string;
  type: 'FLOODING';
  title: string;
  description: string;
  location: Location;
  geometry: null;
  severity: 'MAJOR';
  startTime: string;
  source: 'USGS Water Services';
  roadName: string;
}

/** Combined incident type from all sources */
export type TravelIncident = VT511ParsedIncident | FloodIncident;

// =============================================================================
// USGS API Types
// =============================================================================

/** USGS site code entry */
interface USGSSiteCode {
  value: string;
  network: string;
  agencyCode: string;
}

/** USGS geographic location */
interface USGSGeoLocation {
  geogLocation: {
    srs: string;
    latitude: number;
    longitude: number;
  };
  localSiteXY?: Array<{
    x: number;
    y: number;
  }>;
}

/** USGS site info from API */
interface USGSSiteInfo {
  siteName: string;
  siteCode: USGSSiteCode[];
  timeZoneInfo: {
    defaultTimeZone: {
      zoneOffset: string;
      zoneAbbreviation: string;
    };
  };
  geoLocation: USGSGeoLocation;
  note?: Array<{
    value: string;
    title: string;
  }>;
  siteType?: Array<{
    value: string;
  }>;
  siteProperty?: Array<{
    value: string;
    name: string;
  }>;
}

/** USGS time series value entry */
interface USGSValue {
  value: string;
  qualifiers: string[];
  dateTime: string;
}

/** USGS time series data */
interface USGSTimeSeries {
  sourceInfo: USGSSiteInfo;
  variable: {
    variableCode: Array<{
      value: string;
      network: string;
      vocabulary: string;
      variableID: number;
    }>;
    variableName: string;
    variableDescription: string;
    valueType: string;
    unit: {
      unitCode: string;
    };
    noDataValue: number;
  };
  values: Array<{
    value: USGSValue[];
    qualifier?: Array<{
      qualifierCode: string;
      qualifierDescription: string;
      qualifierID: number;
      network: string;
      vocabulary: string;
    }>;
    method?: Array<{
      methodDescription: string;
      methodID: number;
    }>;
  }>;
  name: string;
}

/** USGS API response */
interface USGSResponse {
  name: string;
  declaredType: string;
  scope: string;
  value: {
    queryInfo: {
      queryURL: string;
      criteria: {
        locationParam: string;
        variableParam: string;
        parameter: Array<{ name: string; value: string }>;
      };
      note: Array<{ value: string; title: string }>;
    };
    timeSeries: USGSTimeSeries[];
  };
  nil: boolean;
  globalScope: boolean;
  typeSubstituted: boolean;
}

// =============================================================================
// USGS Flood Data
// =============================================================================

/** USGS Water Services API URL */
const USGS_API_URL =
  'https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=VT&parameterCd=00065&siteStatus=active';

/**
 * Fetch flood gauge data from USGS
 */
export async function fetchFloodGauges(): Promise<FloodIncident[]> {
  try {
    const response = await fetch(USGS_API_URL);

    if (!response.ok) {
      throw new Error(`USGS API error: ${response.status}`);
    }

    const data: USGSResponse = await response.json();
    const floods: FloodIncident[] = [];

    // Parse USGS data and identify flooding conditions
    if (data.value?.timeSeries) {
      for (const series of data.value.timeSeries) {
        const siteInfo = series.sourceInfo;
        const values = series.values?.[0]?.value;

        if (!values || values.length === 0) continue;

        const latestValue = values[values.length - 1];
        if (!latestValue) continue;

        const gageHeight = parseFloat(latestValue.value);
        const latestTime = new Date(latestValue.dateTime);
        const now = new Date();
        const hoursSinceReading =
          (now.getTime() - latestTime.getTime()) / (1000 * 60 * 60);

        // Only show if data is recent (within last 3 hours) and height is significant
        // TODO: Improve with actual flood stage data from USGS flood categories
        const isRecentData = hoursSinceReading < 3;
        const isFlooding = gageHeight > 15; // Higher threshold to reduce false positives

        if (isFlooding && isRecentData) {
          const siteCode = siteInfo.siteCode[0]?.value ?? 'unknown';

          floods.push({
            id: `usgs-${siteCode}`,
            type: 'FLOODING',
            title: `Flooding at ${siteInfo.siteName}`,
            description: `Gage height: ${gageHeight.toFixed(2)} ft`,
            location: {
              lat: siteInfo.geoLocation.geogLocation.latitude,
              lng: siteInfo.geoLocation.geogLocation.longitude,
            },
            geometry: null,
            severity: 'MAJOR',
            startTime: latestValue.dateTime,
            source: 'USGS Water Services',
            roadName: siteInfo.siteName,
          });
        }
      }
    }

    return floods;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error fetching USGS flood data:', error);
    }
    throw error;
  }
}

// =============================================================================
// Aggregated Data
// =============================================================================

/**
 * Fetch all travel incidents from all sources
 */
export async function fetchAllIncidents(): Promise<TravelIncident[]> {
  try {
    const [vt511Data, floods] = await Promise.all([
      fetchAllVT511Data(),
      fetchFloodGauges(),
    ]);

    return [...vt511Data, ...floods];
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error fetching incidents:', error);
    }
    throw error;
  }
}
