/**
 * GraphQL Client for VT-LiveView
 * Handles all communication with the backend GraphQL API
 */

import { GraphQLClient } from 'graphql-request';
import type { TemperatureUnit } from '@/types';

// =============================================================================
// GraphQL Response Types
// =============================================================================

/** Current weather observation from NOAA */
export interface CurrentWeatherData {
  temperature: number;
  temperatureUnit: TemperatureUnit;
  description: string;
  windSpeed: string | null;
  windDirection: string | null;
  humidity: number | null;
  timestamp: string;
  stationName: string;
  icon: string | null;
}

/** Forecast period from NOAA API */
export interface ForecastPeriodData {
  name: string;
  temperature: number;
  temperatureUnit: TemperatureUnit;
  shortForecast: string;
  detailedForecast: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  icon: string;
  windSpeed: string;
  windDirection: string;
}

/** Alert geometry for map display */
export interface AlertGeometry {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}

/** Weather alert from NOAA API */
export interface AlertData {
  id: string;
  event: string;
  headline: string | null;
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
  certainty: 'Observed' | 'Likely' | 'Possible' | 'Unlikely' | 'Unknown';
  urgency: 'Immediate' | 'Expected' | 'Future' | 'Past' | 'Unknown';
  description: string;
  instruction: string | null;
  areaDesc: string;
  effective: string;
  expires: string;
  geometry: AlertGeometry | null;
}

/** Radar timestamp entry */
export interface RadarTimestamp {
  time: string;
  path: string;
}

/** Radar info from backend */
export interface RadarInfoData {
  baseUrl: string;
  timestamps: RadarTimestamp[];
  tilePattern: string;
}

/** GraphQL query response wrappers */
interface CurrentWeatherResponse {
  currentWeather: CurrentWeatherData | null;
}

interface ForecastResponse {
  forecast: ForecastPeriodData[];
}

interface AlertsResponse {
  alerts: AlertData[];
}

interface RadarInfoResponse {
  radarInfo: RadarInfoData;
}

// =============================================================================
// Client Setup
// =============================================================================

/** GraphQL endpoint - defaults to localhost for development */
const GRAPHQL_ENDPOINT =
  import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

/** Configured GraphQL client instance */
export const graphqlClient = new GraphQLClient(GRAPHQL_ENDPOINT);

// =============================================================================
// Query Definitions
// =============================================================================

export const CURRENT_WEATHER_QUERY = `
  query CurrentWeather($lat: Float!, $lon: Float!) {
    currentWeather(lat: $lat, lon: $lon) {
      temperature
      temperatureUnit
      description
      windSpeed
      windDirection
      humidity
      timestamp
      stationName
      icon
    }
  }
`;

export const FORECAST_QUERY = `
  query Forecast($lat: Float!, $lon: Float!) {
    forecast(lat: $lat, lon: $lon) {
      name
      temperature
      temperatureUnit
      shortForecast
      detailedForecast
      startTime
      endTime
      isDaytime
      icon
      windSpeed
      windDirection
    }
  }
`;

export const ALERTS_QUERY = `
  query Alerts($state: String!) {
    alerts(state: $state) {
      id
      event
      headline
      severity
      certainty
      urgency
      description
      instruction
      areaDesc
      effective
      expires
      geometry {
        type
        coordinates
      }
    }
  }
`;

export const RADAR_INFO_QUERY = `
  query RadarInfo {
    radarInfo {
      baseUrl
      timestamps {
        time
        path
      }
      tilePattern
    }
  }
`;

// =============================================================================
// Fetch Functions
// =============================================================================

/** Coordinates for weather queries */
interface WeatherCoordinates {
  lat: number;
  lon: number;
}

/**
 * Fetch current weather for a location
 * @param lat - Latitude
 * @param lon - Longitude
 * @returns Current weather data or null if unavailable
 */
export async function fetchCurrentWeather(
  lat: number,
  lon: number
): Promise<CurrentWeatherData | null> {
  const data = await graphqlClient.request<CurrentWeatherResponse>(
    CURRENT_WEATHER_QUERY,
    { lat, lon } satisfies WeatherCoordinates
  );
  return data.currentWeather;
}

/**
 * Fetch forecast for a location
 * @param lat - Latitude
 * @param lon - Longitude
 * @returns Array of forecast periods
 */
export async function fetchForecast(
  lat: number,
  lon: number
): Promise<ForecastPeriodData[]> {
  const data = await graphqlClient.request<ForecastResponse>(FORECAST_QUERY, {
    lat,
    lon,
  } satisfies WeatherCoordinates);
  return data.forecast;
}

/**
 * Fetch active weather alerts for a state
 * @param state - Two-letter state code (defaults to 'VT')
 * @returns Array of active alerts
 */
export async function fetchAlerts(state = 'VT'): Promise<AlertData[]> {
  const data = await graphqlClient.request<AlertsResponse>(ALERTS_QUERY, {
    state,
  });
  return data.alerts;
}

/**
 * Fetch radar tile information
 * @returns Radar configuration and timestamp data
 */
export async function fetchRadarInfo(): Promise<RadarInfoData> {
  const data =
    await graphqlClient.request<RadarInfoResponse>(RADAR_INFO_QUERY);
  return data.radarInfo;
}
