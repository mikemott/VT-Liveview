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
 * Result wrapper for retry operations.
 */
interface RetryResult<T> {
  value: T | null;
  error: string | null;
}

/**
 * Retry wrapper that returns result with error info instead of throwing.
 */
async function withRetryResult<T>(
  fn: () => Promise<T>,
  name: string,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<RetryResult<T>> {
  let lastError: string | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const value = await fn();
      return { value, error: null };
    } catch (error) {
      const delay = baseDelay * Math.pow(2, attempt);
      lastError = error instanceof Error ? error.message : 'Unknown error';

      if (attempt < maxRetries - 1) {
        if (isDev()) {
          console.warn(
            `[Collector:${name}] Attempt ${attempt + 1}/${maxRetries} failed: ${lastError}. Retrying in ${delay}ms...`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(
          `[Collector:${name}] All ${maxRetries} attempts failed: ${lastError}`
        );
      }
    }
  }

  return { value: null, error: lastError };
}

/**
 * Run all collectors with retry logic.
 * Each collector runs independently - failures don't affect others.
 */
export async function runAllCollectors(): Promise<CollectionResult> {
  const errors: string[] = [];
  const timestamp = new Date();

  const [weatherResult, alertsResult, trafficResult, gaugesResult] = await Promise.all([
    withRetryResult(collectWeatherObservations, 'Weather'),
    withRetryResult(collectWeatherAlerts, 'Alerts'),
    withRetryResult(collectTrafficIncidents, 'Traffic'),
    withRetryResult(collectRiverGauges, 'Gauges'),
  ]);

  if (weatherResult.error) errors.push(`Weather: ${weatherResult.error}`);
  if (alertsResult.error) errors.push(`Alerts: ${alertsResult.error}`);
  if (trafficResult.error) errors.push(`Traffic: ${trafficResult.error}`);
  if (gaugesResult.error) errors.push(`Gauges: ${gaugesResult.error}`);

  return {
    weather: weatherResult.value,
    alerts: alertsResult.value,
    traffic: trafficResult.value,
    gauges: gaugesResult.value,
    timestamp,
    errors,
  };
}
