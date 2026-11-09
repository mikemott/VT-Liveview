/**
 * The weather card's last good reading, kept in localStorage so a refresh can
 * show it at once while the live request runs (VTL-86).
 */
import type { CurrentWeatherData } from '../services/graphqlClient';

const STORAGE_KEY = 'vtl:lastWeather';

/** Older than this, a saved reading isn't shown: better a skeleton than stale weather */
export const LAST_WEATHER_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/** Rounds a coordinate to two decimals (about 1 km) for the weather card's queries */
export function roundWeatherCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface SavedWeather {
  data: CurrentWeatherData;
  /** When it was fetched, in ms since the epoch */
  savedAt: number;
}

interface StoredWeather extends SavedWeather {
  lat: number;
  lon: number;
}

function isWeatherData(value: unknown): value is CurrentWeatherData {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.temperature === 'number' &&
    typeof v.temperatureUnit === 'string' &&
    typeof v.description === 'string'
  );
}

/**
 * The saved reading for this (rounded) point, if there is one and it is recent.
 * Storage that is blocked, full or holding something else reads as nothing saved.
 */
export function loadLastWeather(
  lat: number,
  lon: number,
  now: number = Date.now(),
): SavedWeather | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const stored = JSON.parse(raw) as Partial<StoredWeather>;
    if (stored.lat !== lat || stored.lon !== lon) return undefined;
    if (typeof stored.savedAt !== 'number' || !isWeatherData(stored.data)) return undefined;
    const age = now - stored.savedAt;
    if (age < 0 || age > LAST_WEATHER_MAX_AGE_MS) return undefined;
    return { data: stored.data, savedAt: stored.savedAt };
  } catch {
    return undefined;
  }
}

/** Saves a reading for this (rounded) point; a storage failure is ignored. */
export function saveLastWeather(
  lat: number,
  lon: number,
  data: CurrentWeatherData,
  now: number = Date.now(),
): void {
  try {
    const stored: StoredWeather = { lat, lon, data, savedAt: now };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Private mode or a full quota: the card just won't start pre-filled next time
  }
}
