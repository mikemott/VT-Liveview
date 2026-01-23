/**
 * Data collectors for historical storage.
 * Exports all collectors with retry logic.
 */

import { collectWeatherObservations } from './weather.js';
import { collectWeatherAlerts } from './alerts.js';
import { collectTrafficIncidents } from './traffic.js';
import { collectRiverGauges } from './gauges.js';
import { isDev } from '../types/env.js';

// Re-export individual collectors
export { collectWeatherObservations } from './weather.js';
export { collectWeatherAlerts } from './alerts.js';
export { collectTrafficIncidents } from './traffic.js';
export { collectRiverGauges } from './gauges.js';

/**
 * Retry wrapper for collectors with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  name: string,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const delay = baseDelay * Math.pow(2, attempt);
      const message = error instanceof Error ? error.message : 'Unknown error';

      if (attempt < maxRetries - 1) {
        if (isDev()) {
          console.warn(
            `[Collector:${name}] Attempt ${attempt + 1}/${maxRetries} failed: ${message}. Retrying in ${delay}ms...`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(
          `[Collector:${name}] All ${maxRetries} attempts failed: ${message}`
        );
      }
    }
  }
  return null;
}

/**
 * Collection result for tracking.
 */
export interface CollectionResult {
  weather: number | null;
  alerts: number | null;
  traffic: number | null;
  gauges: number | null;
  timestamp: Date;
  errors: string[];
}

/**
 * Run all collectors with retry logic.
 * Each collector runs independently - failures don't affect others.
 */
export async function runAllCollectors(): Promise<CollectionResult> {
  const errors: string[] = [];
  const timestamp = new Date();

  const [weather, alerts, traffic, gauges] = await Promise.all([
    withRetry(collectWeatherObservations, 'Weather').catch((e) => {
      errors.push(`Weather: ${e.message}`);
      return null;
    }),
    withRetry(collectWeatherAlerts, 'Alerts').catch((e) => {
      errors.push(`Alerts: ${e.message}`);
      return null;
    }),
    withRetry(collectTrafficIncidents, 'Traffic').catch((e) => {
      errors.push(`Traffic: ${e.message}`);
      return null;
    }),
    withRetry(collectRiverGauges, 'Gauges').catch((e) => {
      errors.push(`Gauges: ${e.message}`);
      return null;
    }),
  ]);

  return {
    weather,
    alerts,
    traffic,
    gauges,
    timestamp,
    errors,
  };
}
