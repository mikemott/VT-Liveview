import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LAST_WEATHER_MAX_AGE_MS,
  loadLastWeather,
  roundWeatherCoord,
  saveLastWeather,
} from '../lastWeather';
import type { CurrentWeatherData } from '../../services/graphqlClient';

const READING: CurrentWeatherData = {
  temperature: 48,
  temperatureUnit: 'F',
  description: 'Mostly Cloudy',
  windSpeed: '5 mph',
  windDirection: 'NW',
  humidity: 70,
  timestamp: '2026-11-09T14:35:00+00:00',
  stationName: 'Barre / Montpelier, Knapp State Airport',
  icon: null,
};

const NOW = Date.parse('2026-11-09T15:00:00Z');

describe('roundWeatherCoord', () => {
  it('rounds to two decimals', () => {
    expect(roundWeatherCoord(44.2601)).toBe(44.26);
    expect(roundWeatherCoord(-72.5754)).toBe(-72.58);
  });
});

describe('lastWeather', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('round-trips a reading for the same point', () => {
    saveLastWeather(44.26, -72.58, READING, NOW);
    expect(loadLastWeather(44.26, -72.58, NOW + 60_000)).toEqual({ data: READING, savedAt: NOW });
  });

  it('ignores a reading saved for another point', () => {
    saveLastWeather(44.26, -72.58, READING, NOW);
    expect(loadLastWeather(44.48, -73.21, NOW)).toBeUndefined();
  });

  it('ignores a reading older than the limit, or from the future', () => {
    saveLastWeather(44.26, -72.58, READING, NOW);
    expect(loadLastWeather(44.26, -72.58, NOW + LAST_WEATHER_MAX_AGE_MS + 1)).toBeUndefined();
    expect(loadLastWeather(44.26, -72.58, NOW - 1)).toBeUndefined();
  });

  it('ignores storage that holds something else', () => {
    localStorage.setItem('vtl:lastWeather', '{not json');
    expect(loadLastWeather(44.26, -72.58, NOW)).toBeUndefined();
    localStorage.setItem(
      'vtl:lastWeather',
      JSON.stringify({ lat: 44.26, lon: -72.58, savedAt: NOW, data: { temperature: '48' } }),
    );
    expect(loadLastWeather(44.26, -72.58, NOW)).toBeUndefined();
  });

  it('treats blocked storage as nothing saved', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveLastWeather(44.26, -72.58, READING, NOW)).not.toThrow();
    expect(loadLastWeather(44.26, -72.58, NOW)).toBeUndefined();
  });
});
