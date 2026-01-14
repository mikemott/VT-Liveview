/**
 * Application Constants
 * Centralized constants to avoid magic numbers throughout the codebase
 */

import type { MapConfig, VermontConfig, RadarConfig } from '@/types';
import type { LngLatBoundsLike } from 'maplibre-gl';

/** Refresh intervals in milliseconds */
export const INTERVALS = {
  /** Radar data refresh - 5 minutes */
  RADAR_REFRESH: 5 * 60 * 1000,
  /** Traffic incidents refresh - 2 minutes */
  INCIDENTS_REFRESH: 2 * 60 * 1000,
  /** Weather stations refresh - 15 minutes */
  STATIONS_REFRESH: 15 * 60 * 1000,
  /** Current weather refresh - 5 minutes */
  WEATHER_REFRESH: 5 * 60 * 1000,
  /** Forecast refresh - 15 minutes */
  FORECAST_REFRESH: 15 * 60 * 1000,
  /** Theme (dark/light) check - 1 minute */
  THEME_CHECK: 60 * 1000,
  /** Weather alerts refresh - 5 minutes */
  ALERTS_REFRESH: 5 * 60 * 1000,

  // Timeouts
  /** Preload timeout - 8 seconds */
  PRELOAD_TIMEOUT: 8000,
  /** Map move debounce - 500ms */
  MAP_MOVE_DEBOUNCE: 500,
} as const;

/** Vermont geographic configuration */
export const VERMONT: VermontConfig = {
  centerLat: 44.0,
  centerLng: -73.3,
  centerZoom: 7.5,
  defaultLat: 44.2601, // Montpelier
  defaultLon: -72.5754, // Montpelier
  lat: 44.5588,
  lng: -72.5778,
} as const;

/** Map bounds and zoom configuration */
export const MAP_CONFIG: MapConfig = {
  minZoom: 6.5,
  maxZoom: 18,
  bounds: [
    [-75.0, 41.5], // Southwest
    [-70.0, 46.5], // Northeast
  ] as LngLatBoundsLike,
} as const;

/** Radar animation configuration */
export const RADAR_CONFIG: RadarConfig = {
  frameCount: 6,
  frameDelay: 500, // ms between frames
  defaultOpacity: 0.7,
} as const;

/** Cache configuration */
export const CACHE_CONFIG = {
  /** Maximum grid point cache entries */
  GRID_POINT_MAX_SIZE: 100,
  /** Grid point cache TTL - 1 hour */
  GRID_POINT_TTL: 3600000,
  /** Stations cache TTL - 15 minutes */
  STATIONS_TTL: 900000,
} as const;

/** Type helper for interval keys */
export type IntervalKey = keyof typeof INTERVALS;

/** Type helper for cache config keys */
export type CacheConfigKey = keyof typeof CACHE_CONFIG;
