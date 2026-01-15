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
} from '../types/index.js';
import { getEnv } from '../types/index.js';

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
// Helper Functions
// ============================================================================

function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9) / 5 + 32);
}

function degreesToCardinal(degrees: number): string {
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
 * Get all Vermont observation stations with current weather.
 * Results are cached for 15 minutes.
 */
export async function getObservationStations(): Promise<ObservationStation[]> {
  // Check cache first
  if (stationsCache.data && stationsCache.timestamp) {
    const age = Date.now() - stationsCache.timestamp;
    if (age < stationsCache.ttl) {
      return stationsCache.data;
    }
  }

  // Fetch all Vermont observation stations
  const stationsResponse = await fetch(`${NOAA_BASE}/stations?state=VT&limit=50`, getFetchOptions());

  if (!stationsResponse.ok) {
    throw new Error(`Failed to get stations: ${stationsResponse.status}`);
  }

  const stationsData = (await stationsResponse.json()) as NOAAStationsResponse;
  const stations = stationsData.features;

  // Fetch latest observation for each station (in parallel, limited to first 50)
  const stationsWithWeather = await Promise.all(
    stations.slice(0, 50).map(async (station): Promise<ObservationStation | null> => {
      try {
        const stationId = station.properties.stationIdentifier;
        const obsResponse = await fetch(
          `${NOAA_BASE}/stations/${stationId}/observations/latest`,
          getFetchOptions()
        );

        if (!obsResponse.ok) {
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
          return null;
        }

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
        // Skip stations with errors
        return null;
      }
    })
  );

  // Filter out null results and cache
  const validStations = stationsWithWeather.filter(
    (s): s is ObservationStation => s !== null
  );

  stationsCache.data = validStations;
  stationsCache.timestamp = Date.now();

  return validStations;
}
