/**
 * Lake Temperature Service
 * Fetches water temperature data from USGS Water Services API
 *
 * Note: USGS coverage in Vermont is limited. Currently only Lake Champlain
 * has an active lake temperature sensor. Other major lakes will need alternative
 * data sources (NOAA buoys, VT DEC sensors, manual monitoring) in future phases.
 */

import type { LakeTemperature } from '../types/lake.js';

// =============================================================================
// Lake Definitions
// =============================================================================

interface LakeDefinition {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  usgsGaugeId?: string;
  description?: string;
  region: 'north' | 'central' | 'south';
}

/**
 * Curated list of Vermont lakes
 *
 * Phase 1: Only Lake Champlain has confirmed USGS data
 * Future: Add data sources for other lakes (NOAA, VT DEC, community sensors)
 */
const VERMONT_LAKES: LakeDefinition[] = [
  // Northern Vermont
  {
    id: 'champlain-burlington',
    name: 'Lake Champlain (Burlington)',
    latitude: 44.476,
    longitude: -73.222,
    usgsGaugeId: '04294500',
    description: 'Vermont\'s largest lake with public beaches',
    region: 'north',
  },
  {
    id: 'memphremagog',
    name: 'Lake Memphremagog',
    latitude: 44.943,
    longitude: -72.323,
    description: 'International lake on VT-Quebec border',
    region: 'north',
    // TODO: Find data source (NOAA buoys, VT DEC, or Quebec sensors)
  },
  {
    id: 'willoughby',
    name: 'Lake Willoughby',
    latitude: 44.736,
    longitude: -72.067,
    description: 'Glacial lake with pristine water',
    region: 'north',
    // TODO: Find data source
  },

  // Central Vermont
  {
    id: 'bomoseen',
    name: 'Lake Bomoseen',
    latitude: 43.638,
    longitude: -73.201,
    description: 'Largest lake entirely in Vermont',
    region: 'central',
    // TODO: Find data source
  },
  {
    id: 'dunmore',
    name: 'Lake Dunmore',
    latitude: 43.841,
    longitude: -73.067,
    description: 'Popular swimming and recreation lake',
    region: 'central',
    // TODO: Find data source
  },

  // Southern Vermont
  {
    id: 'harriman',
    name: 'Harriman Reservoir',
    latitude: 42.912,
    longitude: -72.918,
    description: 'Largest flood control reservoir',
    region: 'south',
    // TODO: Find data source
  },
];

// =============================================================================
// Caching
// =============================================================================

interface CacheEntry {
  data: LakeTemperature[];
  timestamp: number;
}

const cache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes (matches USGS update frequency)

// =============================================================================
// USGS API Integration
// =============================================================================

interface USGSTimeSeries {
  sourceInfo: {
    siteName: string;
    siteCode: Array<{ value: string }>;
    geoLocation: {
      geogLocation: {
        latitude: number;
        longitude: number;
      };
    };
  };
  values: Array<{
    value: Array<{
      value: string; // Temperature in Celsius
      dateTime: string;
    }>;
  }>;
}

interface USGSResponse {
  value: {
    timeSeries: USGSTimeSeries[];
  };
}

/**
 * Fetch water temperature data from USGS for given gauge IDs
 */
async function fetchUSGSData(gaugeIds: string[]): Promise<Map<string, { temp: number; timestamp: string }>> {
  const sites = gaugeIds.join(',');
  const url = `https://waterservices.usgs.gov/nwis/iv/?sites=${sites}&parameterCd=00010&format=json&siteStatus=active`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`USGS API error: ${response.status}`);
    }

    const data = await response.json() as USGSResponse;
    const results = new Map<string, { temp: number; timestamp: string }>();

    if (!data.value?.timeSeries) {
      return results;
    }

    for (const series of data.value.timeSeries) {
      const siteCode = series.sourceInfo.siteCode[0];
      if (!siteCode) continue;

      const gaugeId = siteCode.value;
      const valuesArray = series.values[0]?.value;

      if (valuesArray && valuesArray.length > 0) {
        const latestValue = valuesArray[valuesArray.length - 1];
        if (!latestValue) continue;

        const tempCelsius = parseFloat(latestValue.value);

        if (!isNaN(tempCelsius)) {
          // Convert Celsius to Fahrenheit
          const tempFahrenheit = (tempCelsius * 9/5) + 32;
          results.set(gaugeId, {
            temp: Math.round(tempFahrenheit),
            timestamp: latestValue.dateTime,
          });
        }
      }
    }

    return results;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to fetch USGS data:', error);
    }
    throw new Error(`Failed to fetch USGS water temperature data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate comfort level based on temperature
 */
function calculateComfortLevel(tempF: number): 'cold' | 'comfortable' | 'warm' {
  if (tempF < 65) return 'cold';
  if (tempF <= 75) return 'comfortable';
  return 'warm';
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Fetch current lake temperature data
 *
 * Returns cached data if available and fresh (< 15 minutes old).
 * Otherwise fetches fresh data from USGS API.
 *
 * Note: Only Lake Champlain has USGS data currently.
 * Other lakes return null temperature until additional data sources are added.
 */
export async function fetchLakeTemperatures(): Promise<LakeTemperature[]> {
  const cacheKey = 'all-lakes';

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  // Fetch fresh data from USGS
  const lakesWithUSGS = VERMONT_LAKES.filter(lake => lake.usgsGaugeId);
  const gaugeIds = lakesWithUSGS.map(lake => lake.usgsGaugeId!);

  let usgsData = new Map<string, { temp: number; timestamp: string }>();

  if (gaugeIds.length > 0) {
    try {
      usgsData = await fetchUSGSData(gaugeIds);
    } catch (error) {
      // Log error but continue - we'll return lakes with null temperatures
      if (process.env.NODE_ENV === 'development') {
        console.error('USGS fetch failed, returning partial data:', error);
      }
    }
  }

  // Build response with data from USGS where available
  const results: LakeTemperature[] = VERMONT_LAKES.map(lake => {
    const usgsReading = lake.usgsGaugeId ? usgsData.get(lake.usgsGaugeId) : null;

    return {
      id: lake.id,
      name: lake.name,
      latitude: lake.latitude,
      longitude: lake.longitude,
      temperatureFahrenheit: usgsReading?.temp ?? null,
      comfortLevel: usgsReading ? calculateComfortLevel(usgsReading.temp) : 'cold',
      timestamp: usgsReading?.timestamp ?? new Date().toISOString(),
      usgsGaugeId: lake.usgsGaugeId ?? null,
      description: lake.description ?? null,
    };
  });

  // Cache results
  cache.set(cacheKey, {
    data: results,
    timestamp: Date.now(),
  });

  return results;
}

/**
 * Clear the cache (useful for testing)
 */
export function clearCache(): void {
  cache.clear();
}
