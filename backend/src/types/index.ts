/**
 * Backend type exports.
 * Re-exports all types from specialized modules for convenient imports.
 */

// Weather and NOAA API types
export type {
  // GraphQL response types
  WeatherConditions,
  ForecastPeriod,
  Alert,
  AlertGeometry,
  Location,
  StationWeather,
  ObservationStation,
  RadarTimestamp,
  RadarInfo,
  // NOAA API response types
  NOAAPointsResponse,
  NOAAGridPointProperties,
  NOAAStationsResponse,
  NOAAStationFeature,
  NOAAObservationResponse,
  NOAAObservationProperties,
  NOAAQuantitativeValue,
  NOAAForecastResponse,
  NOAAForecastPeriod,
  NOAAAlertsResponse,
  NOAAAlertFeature,
  // Cache types
  StationsCache,
  ClearCacheResult,
  // Zone boundary types
  ZoneBoundary,
  ZoneCacheEntry,
  // Merged alert types
  MergedAlert,
  MergedAlertGeometry,
} from './weather.js';

// Environment types
export type { Env } from './env.js';
export { validateEnv, getEnv, isDev, isProd } from './env.js';
