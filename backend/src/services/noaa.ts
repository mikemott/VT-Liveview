/**
 * NOAA Weather API Service
 * Fetches weather data, forecasts, and alerts from the National Weather Service API.
 */

import type {
  WeatherConditions,
  ForecastPeriod,
  Alert,
  ObservationStation,
  StationsCache,
  ClearCacheResult,
  NOAAGridPointProperties,
  NOAAStationsResponse,
  NOAAObservationResponse,
  NOAAForecastResponse,
  NOAAAlertsResponse,
  MergedAlert,
  ZoneBoundary,
} from '../types/index.js';
import { getEnv } from '../types/index.js';
import {
  fetchZoneBoundaries,
  filterVermontZones,
  extractZoneId,
} from './zones.js';

const NOAA_BASE = 'https://api.weather.gov';

/**
 * Build User-Agent string for NOAA API requests.
 * Uses CONTACT_EMAIL env var per NOAA API Terms of Service.
 */
function getUserAgent(): string {
  const env = getEnv();
  const contactEmail = env.CONTACT_EMAIL ?? 'weather-app@localhost';
  return `VT-Liveview Weather App (${contactEmail})`;
}

/**
 * Get fetch options with dynamic User-Agent header.
 */
function getFetchOptions(): RequestInit {
  return {
    headers: {
      'User-Agent': getUserAgent(),
      Accept: 'application/geo+json',
    },
  };
}

// ============================================================================
// Grid Point Cache (LRU with max 100 entries)
// ============================================================================

const gridPointCache = new Map<string, NOAAGridPointProperties>();
const cacheTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
const MAX_CACHE_SIZE = 100;

/**
 * Get NOAA grid point information for coordinates.
 * Results are cached for 1 hour with LRU eviction.
 */
async function getGridPoint(lat: number, lon: number): Promise<NOAAGridPointProperties> {
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;

  const cached = gridPointCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetch(`${NOAA_BASE}/points/${lat},${lon}`, getFetchOptions());

  if (!response.ok) {
    throw new Error(`Failed to get grid point: ${response.status}`);
  }

  const data = (await response.json()) as { properties: NOAAGridPointProperties };

  // Implement LRU eviction if cache is full
  if (gridPointCache.size >= MAX_CACHE_SIZE) {
    const firstKey = gridPointCache.keys().next().value;
    if (firstKey !== undefined) {
      gridPointCache.delete(firstKey);

      // Clear associated timeout
      const timeout = cacheTimeouts.get(firstKey);
      if (timeout) {
        clearTimeout(timeout);
        cacheTimeouts.delete(firstKey);
      }
    }
  }

  gridPointCache.set(cacheKey, data.properties);

  // Clear cache after 1 hour and store timeout reference
  const timeout = setTimeout(() => {
    gridPointCache.delete(cacheKey);
    cacheTimeouts.delete(cacheKey);
  }, 3600000);

  cacheTimeouts.set(cacheKey, timeout);

  return data.properties;
}

// ============================================================================
// Weather Data Functions
// ============================================================================

/**
 * Get current weather conditions for coordinates.
 * Tries multiple nearby observation stations until valid data is found.
 */
export async function getCurrentWeather(lat: number, lon: number): Promise<WeatherConditions> {
  const gridPoint = await getGridPoint(lat, lon);

  // Get observation stations
  const stationsResponse = await fetch(gridPoint.observationStations, getFetchOptions());
  if (!stationsResponse.ok) {
    throw new Error(`Failed to get stations: ${stationsResponse.status}`);
  }

  const stationsData = (await stationsResponse.json()) as NOAAStationsResponse;
  const stations = stationsData.features;

  if (!stations || stations.length === 0) {
    throw new Error('No observation stations found');
  }

  // Try stations until we get a valid observation
  for (const station of stations.slice(0, 3)) {
    const stationId = station.properties.stationIdentifier;

    try {
      const obsResponse = await fetch(
        `${NOAA_BASE}/stations/${stationId}/observations/latest`,
        getFetchOptions()
      );

      if (!obsResponse.ok) continue;

      const obsData = (await obsResponse.json()) as NOAAObservationResponse;
      const props = obsData.properties;

      // Extract values for type narrowing
      const tempValue = props.temperature?.value;
      const windSpeedValue = props.windSpeed?.value;
      const windDirValue = props.windDirection?.value;

      // Check if we have valid temperature data
      if (tempValue === null || tempValue === undefined) continue;

      return {
        temperature: celsiusToFahrenheit(tempValue),
        temperatureUnit: 'F',
        description: props.textDescription ?? 'Unknown',
        windSpeed:
          windSpeedValue !== null && windSpeedValue !== undefined
            ? `${Math.round(windSpeedValue * 2.237)} mph`
            : null,
        windDirection:
          windDirValue !== null && windDirValue !== undefined
            ? degreesToCardinal(windDirValue)
            : null,
        humidity: props.relativeHumidity?.value ?? null,
        timestamp: props.timestamp ?? new Date().toISOString(),
        stationName: station.properties.name,
        icon: props.icon,
      };
    } catch {
      // Try next station
      continue;
    }
  }

  throw new Error('No valid observations available from nearby stations');
}

/**
 * Get weather forecast for coordinates.
 */
export async function getForecast(lat: number, lon: number): Promise<ForecastPeriod[]> {
  const gridPoint = await getGridPoint(lat, lon);

  const forecastResponse = await fetch(gridPoint.forecast, getFetchOptions());

  if (!forecastResponse.ok) {
    throw new Error(`Failed to get forecast: ${forecastResponse.status}`);
  }

  const forecastData = (await forecastResponse.json()) as NOAAForecastResponse;
  const periods = forecastData.properties.periods;

  return periods.map((period) => ({
    name: period.name,
    temperature: period.temperature,
    temperatureUnit: period.temperatureUnit,
    shortForecast: period.shortForecast,
    detailedForecast: period.detailedForecast,
    startTime: period.startTime,
    endTime: period.endTime,
    isDaytime: period.isDaytime,
    icon: period.icon,
    windSpeed: period.windSpeed,
    windDirection: period.windDirection,
  }));
}

/**
 * Get active weather alerts for a state.
 */
export async function getAlerts(state: string): Promise<Alert[]> {
  const response = await fetch(`${NOAA_BASE}/alerts/active?area=${state}`, getFetchOptions());

  if (!response.ok) {
    throw new Error(`Failed to get alerts: ${response.status}`);
  }

  const data = (await response.json()) as NOAAAlertsResponse;
  const features = data.features;

  return features.map((feature) => {
    const props = feature.properties;
    return {
      id: props.id,
      event: props.event,
      headline: props.headline,
      severity: props.severity,
      certainty: props.certainty,
      urgency: props.urgency,
      description: props.description,
      instruction: props.instruction,
      areaDesc: props.areaDesc,
      effective: props.effective,
      expires: props.expires,
      geometry: feature.geometry
        ? {
            type: feature.geometry.type,
            coordinates: feature.geometry.coordinates,
          }
        : null,
    };
  });
}

// ============================================================================
// Merged Alerts (with zone boundary fetching)
// ============================================================================

/**
 * Severity ranking for alert prioritization.
 * Higher number = more severe.
 */
const SEVERITY_RANK: Record<string, number> = {
  Extreme: 4,
  Severe: 3,
  Moderate: 2,
  Minor: 1,
  Unknown: 0,
};

/**
 * Certainty ranking for alert prioritization.
 */
const CERTAINTY_RANK: Record<string, number> = {
  Observed: 4,
  Likely: 3,
  Possible: 2,
  Unlikely: 1,
  Unknown: 0,
};

/**
 * Urgency ranking for alert prioritization.
 */
const URGENCY_RANK: Record<string, number> = {
  Immediate: 4,
  Expected: 3,
  Future: 2,
  Past: 1,
  Unknown: 0,
};

/**
 * Convert zone boundaries to a MultiPolygon coordinate array.
 */
function zonesToMultiPolygon(zones: ZoneBoundary[]): number[][][][] {
  const coordinates: number[][][][] = [];

  for (const zone of zones) {
    if (zone.geometry.type === 'Polygon') {
      // Polygon coordinates are number[][][]
      coordinates.push(zone.geometry.coordinates as number[][][]);
    } else if (zone.geometry.type === 'MultiPolygon') {
      // MultiPolygon coordinates are number[][][][]
      const multiCoords = zone.geometry.coordinates as number[][][][];
      coordinates.push(...multiCoords);
    }
  }

  return coordinates;
}

/**
 * Get merged weather alerts for a state.
 * Alerts are grouped by event type and merged into single visual boundaries.
 * Only Vermont zones are included in the geometry.
 * Uses existing alert geometry when available, falls back to zone boundaries.
 */
export async function getMergedAlerts(state: string): Promise<MergedAlert[]> {
  let data: NOAAAlertsResponse;

  try {
    const response = await fetch(`${NOAA_BASE}/alerts/active?area=${state}`, getFetchOptions());

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    data = (await response.json()) as NOAAAlertsResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get merged alerts for ${state}: ${message}`);
  }

  const features = data.features;

  if (features.length === 0) {
    return [];
  }

  // Collect VT zone URLs from alerts that lack geometry (need to fetch boundaries)
  const zoneUrlsNeedingBoundaries: string[] = [];
  for (const feature of features) {
    if (!feature.geometry) {
      const vtZones = filterVermontZones(feature.properties.affectedZones || []);
      zoneUrlsNeedingBoundaries.push(...vtZones);
    }
  }

  // Fetch zone boundaries in parallel (only for alerts without geometry)
  const zoneBoundaries = await fetchZoneBoundaries(zoneUrlsNeedingBoundaries);

  // Group alerts by event type
  const alertsByEvent = new Map<string, typeof features>();
  for (const feature of features) {
    const event = feature.properties.event;
    const existing = alertsByEvent.get(event) || [];
    existing.push(feature);
    alertsByEvent.set(event, existing);
  }

  // Merge each group into a single alert
  const mergedAlerts: MergedAlert[] = [];

  for (const [event, alerts] of alertsByEvent) {
    // Collect all VT zone IDs for this event group
    const vtZoneIds = new Set<string>();
    for (const alert of alerts) {
      const vtZones = filterVermontZones(alert.properties.affectedZones || []);
      for (const zoneUrl of vtZones) {
        vtZoneIds.add(extractZoneId(zoneUrl));
      }
    }

    // Skip if no VT zones affected
    if (vtZoneIds.size === 0) {
      continue;
    }

    // Build geometry: prefer existing alert polygons, fall back to zone boundaries
    const geometryParts: number[][][][] = [];

    // First, collect existing geometry from alerts that have it
    for (const alert of alerts) {
      if (alert.geometry) {
        if (alert.geometry.type === 'Polygon') {
          // Polygon coordinates are number[][][] - wrap in array for MultiPolygon format
          // Note: NOAA types have coordinates as number[][][][] but Polygon is actually number[][][]
          const polygonCoords = alert.geometry.coordinates as unknown as number[][][];
          geometryParts.push(polygonCoords);
        } else if (alert.geometry.type === 'MultiPolygon') {
          // MultiPolygon coordinates are number[][][][] - spread to add each polygon
          geometryParts.push(...alert.geometry.coordinates);
        }
      }
    }

    // If no alerts had geometry, fall back to zone boundaries
    if (geometryParts.length === 0) {
      const eventZoneBoundaries: ZoneBoundary[] = [];
      for (const zoneId of vtZoneIds) {
        const boundary = zoneBoundaries.get(zoneId);
        if (boundary) {
          eventZoneBoundaries.push(boundary);
        }
      }

      if (eventZoneBoundaries.length === 0) {
        console.warn(`[ALERTS] No geometry or zone boundaries found for event: ${event}`);
        continue;
      }

      geometryParts.push(...zonesToMultiPolygon(eventZoneBoundaries));
    }

    // Find the most severe alert in the group
    const sortedAlerts = [...alerts].sort((a, b) => {
      const sevA = SEVERITY_RANK[a.properties.severity] ?? 0;
      const sevB = SEVERITY_RANK[b.properties.severity] ?? 0;
      if (sevA !== sevB) return sevB - sevA;

      const certA = CERTAINTY_RANK[a.properties.certainty] ?? 0;
      const certB = CERTAINTY_RANK[b.properties.certainty] ?? 0;
      if (certA !== certB) return certB - certA;

      const urgA = URGENCY_RANK[a.properties.urgency] ?? 0;
      const urgB = URGENCY_RANK[b.properties.urgency] ?? 0;
      return urgB - urgA;
    });

    const primaryAlert = sortedAlerts[0];
    if (!primaryAlert) continue;

    // Find earliest effective and latest expires
    let earliestEffective = primaryAlert.properties.effective;
    let latestExpires = primaryAlert.properties.expires;

    for (const alert of alerts) {
      if (new Date(alert.properties.effective) < new Date(earliestEffective)) {
        earliestEffective = alert.properties.effective;
      }
      if (new Date(alert.properties.expires) > new Date(latestExpires)) {
        latestExpires = alert.properties.expires;
      }
    }

    // Combine area descriptions (VT zones only)
    const vtZoneNames: string[] = [];
    for (const zoneId of vtZoneIds) {
      const boundary = zoneBoundaries.get(zoneId);
      if (boundary) {
        vtZoneNames.push(boundary.name);
      }
    }
    // If we used existing geometry, zone names might be empty - use areaDesc from primary
    const areaDesc = vtZoneNames.length > 0
      ? vtZoneNames.join('; ')
      : primaryAlert.properties.areaDesc;

    // Create merged alert
    const mergedAlert: MergedAlert = {
      id: `merged-${event.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      event,
      headline: primaryAlert.properties.headline,
      severity: primaryAlert.properties.severity,
      certainty: primaryAlert.properties.certainty,
      urgency: primaryAlert.properties.urgency,
      description: primaryAlert.properties.description,
      instruction: primaryAlert.properties.instruction,
      areaDesc,
      effective: earliestEffective,
      expires: latestExpires,
      geometry: {
        type: 'MultiPolygon',
        coordinates: geometryParts,
      },
      mergedFrom: alerts.map((a) => a.properties.id),
      affectedZoneIds: [...vtZoneIds],
    };

    mergedAlerts.push(mergedAlert);
  }

  return mergedAlerts;
}

// ============================================================================
// Helper Functions (exported for testing)
// ============================================================================

/**
 * Convert Celsius temperature to Fahrenheit.
 * @param celsius - Temperature in Celsius
 * @returns Temperature in Fahrenheit, rounded to nearest integer
 */
export function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32);
}

/**
 * Convert wind direction degrees to cardinal direction string.
 * @param degrees - Wind direction in degrees (0-360)
 * @returns Cardinal direction (N, NNE, NE, etc.)
 */
export function degreesToCardinal(degrees: number): string {
  const directions = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index] ?? 'N';
}

// ============================================================================
// Observation Stations Cache
// ============================================================================

const stationsCache: StationsCache = {
  data: null,
  timestamp: null,
  ttl: 900000, // 15 minutes (reduced from 1 hour to prevent stale data)
};

/**
 * Clear the stations cache (for admin endpoint).
 */
export function clearStationsCache(): ClearCacheResult {
  stationsCache.data = null;
  stationsCache.timestamp = null;
  return { cleared: true, timestamp: new Date().toISOString() };
}

/**
 * Vermont grid points for comprehensive station coverage.
 * The ?state=VT endpoint misses airport stations (KBTV, KMPV, etc.) because
 * they don't have state metadata set. Querying by grid points includes them.
 */
const VERMONT_GRID_POINTS = [
  { name: 'Burlington', lat: 44.4759, lon: -73.2121 },
  { name: 'Montpelier', lat: 44.2601, lon: -72.5754 },
  { name: 'St. Johnsbury', lat: 44.4195, lon: -72.0151 },
  { name: 'Rutland', lat: 43.6106, lon: -72.9726 },
  { name: 'Brattleboro', lat: 42.8509, lon: -72.5579 },
  { name: 'Newport', lat: 44.9364, lon: -72.2051 },
];

/**
 * Logging utility for station fetching diagnostics.
 * Always logs in production to help debug station availability issues.
 */
function logStationDebug(message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const logEntry = data
    ? `[STATIONS ${timestamp}] ${message}: ${JSON.stringify(data)}`
    : `[STATIONS ${timestamp}] ${message}`;
  console.log(logEntry);
}

/**
 * Fetch station IDs from a grid point's observation stations endpoint.
 */
async function fetchStationsFromGridPoint(
  gridPointName: string,
  lat: number,
  lon: number
): Promise<NOAAStationsResponse['features']> {
  try {
    // Use cached getGridPoint to avoid duplicate API calls
    const gridPoint = await getGridPoint(lat, lon);
    const stationsUrl = gridPoint.observationStations;

    // Fetch stations from this grid point
    const stationsResponse = await fetch(stationsUrl, getFetchOptions());
    if (!stationsResponse.ok) {
      logStationDebug(`Stations fetch failed for ${gridPointName}`, { status: stationsResponse.status });
      return [];
    }

    const stationsData = (await stationsResponse.json()) as NOAAStationsResponse;
    return stationsData.features || [];
  } catch (error) {
    logStationDebug(`Error fetching stations for ${gridPointName}`, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return [];
  }
}

/**
 * Get all Vermont observation stations with current weather.
 * Queries multiple grid points across Vermont to capture airport stations
 * that are missing from the ?state=VT endpoint.
 * Results are cached for 15 minutes.
 */
export async function getObservationStations(): Promise<ObservationStation[]> {
  // Check cache first
  if (stationsCache.data && stationsCache.timestamp) {
    const age = Date.now() - stationsCache.timestamp;
    if (age < stationsCache.ttl) {
      logStationDebug('Returning cached stations', { count: stationsCache.data.length, ageMs: age });
      return stationsCache.data;
    }
  }

  logStationDebug('Fetching fresh station data from NOAA grid points');

  // Fetch stations from all Vermont grid points in parallel
  const stationArrays = await Promise.all(
    VERMONT_GRID_POINTS.map((point) =>
      fetchStationsFromGridPoint(point.name, point.lat, point.lon)
    )
  );

  // Deduplicate stations by ID (same station appears from multiple grid points)
  const stationMap = new Map<string, NOAAStationsResponse['features'][0]>();
  for (const stations of stationArrays) {
    for (const station of stations) {
      const id = station.properties.stationIdentifier;
      if (!stationMap.has(id)) {
        stationMap.set(id, station);
      }
    }
  }

  const uniqueStations = Array.from(stationMap.values());
  logStationDebug('Unique stations discovered', {
    total: uniqueStations.length,
    byGridPoint: stationArrays.map((arr, i) => ({
      name: VERMONT_GRID_POINTS[i]?.name ?? 'Unknown',
      count: arr.length,
    })),
  });

  // Track statistics for logging
  let fetchErrors = 0;
  let nullTemperature = 0;
  let validCount = 0;

  // Fetch latest observation for each station (in parallel)
  const stationsWithWeather = await Promise.all(
    uniqueStations.map(async (station): Promise<ObservationStation | null> => {
      const stationId = station.properties.stationIdentifier;
      try {
        const obsResponse = await fetch(
          `${NOAA_BASE}/stations/${stationId}/observations/latest`,
          getFetchOptions()
        );

        if (!obsResponse.ok) {
          fetchErrors++;
          return null;
        }

        const obsData = (await obsResponse.json()) as NOAAObservationResponse;
        const props = obsData.properties;

        // Extract values for type narrowing
        const tempValue = props.temperature?.value;
        const windSpeedValue = props.windSpeed?.value;
        const windDirValue = props.windDirection?.value;
        const dewpointValue = props.dewpoint?.value;
        const pressureValue = props.barometricPressure?.value;

        // Only include stations with valid temperature data
        if (tempValue === null || tempValue === undefined) {
          nullTemperature++;
          return null;
        }

        validCount++;
        return {
          id: stationId,
          name: station.properties.name,
          location: {
            lat: station.geometry.coordinates[1],
            lng: station.geometry.coordinates[0],
          },
          elevation: station.properties.elevation?.value
            ? Math.round(station.properties.elevation.value * 3.28084) // Convert m to ft
            : null,
          weather: {
            temperature: celsiusToFahrenheit(tempValue),
            temperatureUnit: 'F',
            description: props.textDescription ?? 'Unknown',
            windSpeed:
              windSpeedValue !== null && windSpeedValue !== undefined
                ? `${Math.round(windSpeedValue * 2.237)} mph`
                : null,
            windDirection:
              windDirValue !== null && windDirValue !== undefined
                ? degreesToCardinal(windDirValue)
                : null,
            humidity: props.relativeHumidity?.value ?? null,
            dewpoint:
              dewpointValue !== null && dewpointValue !== undefined
                ? celsiusToFahrenheit(dewpointValue)
                : null,
            pressure:
              pressureValue !== null && pressureValue !== undefined
                ? Math.round(pressureValue / 100) // Convert Pa to mb
                : null,
            timestamp: props.timestamp ?? new Date().toISOString(),
          },
        };
      } catch {
        fetchErrors++;
        return null;
      }
    })
  );

  // Filter out null results and cache
  const validStations = stationsWithWeather.filter(
    (s): s is ObservationStation => s !== null
  );

  logStationDebug('Station fetch complete', {
    discovered: uniqueStations.length,
    fetchErrors,
    nullTemperature,
    valid: validCount,
    stationIds: validStations.map((s) => s.id),
  });

  stationsCache.data = validStations;
  stationsCache.timestamp = Date.now();

  return validStations;
}
