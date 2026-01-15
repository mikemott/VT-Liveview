/**
 * Tests for application constants
 * Validates interval values, geographic bounds, and configuration
 */

import { describe, it, expect } from 'vitest';
import {
  INTERVALS,
  VERMONT,
  MAP_CONFIG,
  RADAR_CONFIG,
  CACHE_CONFIG,
} from '../constants';

describe('INTERVALS', () => {
  it('should have all refresh intervals as positive numbers', () => {
    expect(INTERVALS.RADAR_REFRESH).toBeGreaterThan(0);
    expect(INTERVALS.INCIDENTS_REFRESH).toBeGreaterThan(0);
    expect(INTERVALS.STATIONS_REFRESH).toBeGreaterThan(0);
    expect(INTERVALS.WEATHER_REFRESH).toBeGreaterThan(0);
    expect(INTERVALS.FORECAST_REFRESH).toBeGreaterThan(0);
    expect(INTERVALS.THEME_CHECK).toBeGreaterThan(0);
    expect(INTERVALS.ALERTS_REFRESH).toBeGreaterThan(0);
  });

  it('should have reasonable minimum refresh intervals (>= 1 minute)', () => {
    const oneMinute = 60 * 1000;
    expect(INTERVALS.RADAR_REFRESH).toBeGreaterThanOrEqual(oneMinute);
    expect(INTERVALS.INCIDENTS_REFRESH).toBeGreaterThanOrEqual(oneMinute);
    expect(INTERVALS.STATIONS_REFRESH).toBeGreaterThanOrEqual(oneMinute);
    expect(INTERVALS.WEATHER_REFRESH).toBeGreaterThanOrEqual(oneMinute);
  });

  it('should have reasonable maximum refresh intervals (<= 30 minutes)', () => {
    const thirtyMinutes = 30 * 60 * 1000;
    expect(INTERVALS.RADAR_REFRESH).toBeLessThanOrEqual(thirtyMinutes);
    expect(INTERVALS.INCIDENTS_REFRESH).toBeLessThanOrEqual(thirtyMinutes);
    expect(INTERVALS.WEATHER_REFRESH).toBeLessThanOrEqual(thirtyMinutes);
  });

  it('should have PRELOAD_TIMEOUT between 1-30 seconds', () => {
    expect(INTERVALS.PRELOAD_TIMEOUT).toBeGreaterThanOrEqual(1000);
    expect(INTERVALS.PRELOAD_TIMEOUT).toBeLessThanOrEqual(30000);
  });

  it('should have MAP_MOVE_DEBOUNCE between 100-2000ms', () => {
    expect(INTERVALS.MAP_MOVE_DEBOUNCE).toBeGreaterThanOrEqual(100);
    expect(INTERVALS.MAP_MOVE_DEBOUNCE).toBeLessThanOrEqual(2000);
  });
});

describe('VERMONT', () => {
  it('should have valid latitude coordinates (within Vermont range)', () => {
    // Vermont roughly spans 42.7° to 45.0° latitude
    expect(VERMONT.centerLat).toBeGreaterThanOrEqual(42.5);
    expect(VERMONT.centerLat).toBeLessThanOrEqual(45.5);
    expect(VERMONT.defaultLat).toBeGreaterThanOrEqual(42.5);
    expect(VERMONT.defaultLat).toBeLessThanOrEqual(45.5);
    expect(VERMONT.lat).toBeGreaterThanOrEqual(42.5);
    expect(VERMONT.lat).toBeLessThanOrEqual(45.5);
  });

  it('should have valid longitude coordinates (within Vermont range)', () => {
    // Vermont roughly spans -73.4° to -71.5° longitude
    expect(VERMONT.centerLng).toBeGreaterThanOrEqual(-74);
    expect(VERMONT.centerLng).toBeLessThanOrEqual(-71);
    expect(VERMONT.defaultLon).toBeGreaterThanOrEqual(-74);
    expect(VERMONT.defaultLon).toBeLessThanOrEqual(-71);
    expect(VERMONT.lng).toBeGreaterThanOrEqual(-74);
    expect(VERMONT.lng).toBeLessThanOrEqual(-71);
  });

  it('should have reasonable center zoom level', () => {
    expect(VERMONT.centerZoom).toBeGreaterThanOrEqual(6);
    expect(VERMONT.centerZoom).toBeLessThanOrEqual(10);
  });
});

describe('MAP_CONFIG', () => {
  it('should have valid zoom bounds', () => {
    expect(MAP_CONFIG.minZoom).toBeGreaterThan(0);
    expect(MAP_CONFIG.maxZoom).toBeGreaterThan(MAP_CONFIG.minZoom);
    expect(MAP_CONFIG.maxZoom).toBeLessThanOrEqual(22); // MapLibre max
  });

  it('should have bounds that encompass Vermont', () => {
    const bounds = MAP_CONFIG.bounds as [[number, number], [number, number]];
    const [southwest, northeast] = bounds;

    // Southwest corner should be southwest of Vermont
    expect(southwest[0]).toBeLessThan(-73); // lng
    expect(southwest[1]).toBeLessThan(43); // lat

    // Northeast corner should be northeast of Vermont
    expect(northeast[0]).toBeGreaterThan(-72); // lng
    expect(northeast[1]).toBeGreaterThan(45); // lat
  });
});

describe('RADAR_CONFIG', () => {
  it('should have reasonable frame count', () => {
    expect(RADAR_CONFIG.frameCount).toBeGreaterThanOrEqual(1);
    expect(RADAR_CONFIG.frameCount).toBeLessThanOrEqual(20);
  });

  it('should have reasonable frame delay for smooth animation', () => {
    expect(RADAR_CONFIG.frameDelay).toBeGreaterThanOrEqual(100);
    expect(RADAR_CONFIG.frameDelay).toBeLessThanOrEqual(2000);
  });

  it('should have valid default opacity (0-1)', () => {
    expect(RADAR_CONFIG.defaultOpacity).toBeGreaterThanOrEqual(0);
    expect(RADAR_CONFIG.defaultOpacity).toBeLessThanOrEqual(1);
  });
});

describe('CACHE_CONFIG', () => {
  it('should have reasonable max cache size', () => {
    expect(CACHE_CONFIG.GRID_POINT_MAX_SIZE).toBeGreaterThanOrEqual(10);
    expect(CACHE_CONFIG.GRID_POINT_MAX_SIZE).toBeLessThanOrEqual(1000);
  });

  it('should have reasonable TTL values (10 minutes to 24 hours)', () => {
    const tenMinutes = 10 * 60 * 1000;
    const twentyFourHours = 24 * 60 * 60 * 1000;

    expect(CACHE_CONFIG.GRID_POINT_TTL).toBeGreaterThanOrEqual(tenMinutes);
    expect(CACHE_CONFIG.GRID_POINT_TTL).toBeLessThanOrEqual(twentyFourHours);
    expect(CACHE_CONFIG.STATIONS_TTL).toBeGreaterThanOrEqual(tenMinutes);
    expect(CACHE_CONFIG.STATIONS_TTL).toBeLessThanOrEqual(twentyFourHours);
  });
});
