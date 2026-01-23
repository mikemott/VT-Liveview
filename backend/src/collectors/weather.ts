/**
 * Weather observations collector.
 * Fetches current weather from NOAA stations and stores in database.
 */

import { getDb, weatherObservations, type NewWeatherObservation } from '../db/index.js';
import { getObservationStations } from '../services/noaa.js';
import { isDev } from '../types/env.js';

/**
 * Collect and store weather observations from all Vermont stations.
 * Returns the number of observations stored.
 */
export async function collectWeatherObservations(): Promise<number> {
  const db = getDb();
  if (!db) {
    if (isDev()) {
      console.log('[Collector:Weather] Database not configured, skipping');
    }
    return 0;
  }

  try {
    const stations = await getObservationStations();

    if (stations.length === 0) {
      if (isDev()) {
        console.log('[Collector:Weather] No stations returned from NOAA');
      }
      return 0;
    }

    const observations: NewWeatherObservation[] = [];

    for (const station of stations) {
      // Skip stations without valid weather data
      if (!station.weather?.timestamp) {
        continue;
      }

      observations.push({
        stationId: station.id,
        stationName: station.name,
        latitude: String(station.location.lat),
        longitude: String(station.location.lng),
        observedAt: new Date(station.weather.timestamp),
        temperatureF: station.weather.temperature !== null ? String(station.weather.temperature) : null,
        humidity: station.weather.humidity !== null ? String(station.weather.humidity) : null,
        windSpeedMph: station.weather.windSpeed ? parseWindSpeed(station.weather.windSpeed) : null,
        windDirection: station.weather.windDirection || null,
        pressureMb: station.weather.pressure || null,
        description: station.weather.description || null,
      });
    }

    if (observations.length === 0) {
      if (isDev()) {
        console.log('[Collector:Weather] No valid observations to store');
      }
      return 0;
    }

    // Insert observations, ignoring duplicates (same station + timestamp)
    await db
      .insert(weatherObservations)
      .values(observations)
      .onConflictDoNothing();

    if (isDev()) {
      console.log(`[Collector:Weather] Stored ${observations.length} observations`);
    }

    return observations.length;
  } catch (error) {
    console.error('[Collector:Weather] Failed to collect observations:', error);
    throw error;
  }
}

/**
 * Parse wind speed string (e.g., "12 mph") to decimal string.
 */
function parseWindSpeed(windSpeed: string): string | null {
  const match = windSpeed.match(/(\d+(?:\.\d+)?)/);
  return match?.[1] ?? null;
}
