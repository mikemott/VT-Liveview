/**
 * Weather alerts collector.
 * Fetches NOAA alerts and stores/updates in database.
 */

import { eq, inArray } from 'drizzle-orm';
import { getDb, weatherAlerts, type NewWeatherAlert } from '../db/index.js';
import { getMergedAlerts } from '../services/noaa.js';
import { isDev } from '../types/env.js';

/**
 * Collect and store weather alerts for Vermont.
 * Uses upsert to track first_seen and last_seen timestamps.
 * Returns the number of alerts processed.
 */
export async function collectWeatherAlerts(): Promise<number> {
  const db = getDb();
  if (!db) {
    if (isDev()) {
      console.log('[Collector:Alerts] Database not configured, skipping');
    }
    return 0;
  }

  try {
    const alerts = await getMergedAlerts('VT');

    if (alerts.length === 0) {
      if (isDev()) {
        console.log('[Collector:Alerts] No active alerts for Vermont');
      }
      return 0;
    }

    // Batch optimization: Fetch all existing alerts in ONE query
    const alertIds = alerts.map(alert => alert.id);

    const existingAlerts = alertIds.length > 0
      ? await db
          .select({ noaaAlertId: weatherAlerts.noaaAlertId })
          .from(weatherAlerts)
          .where(inArray(weatherAlerts.noaaAlertId, alertIds))
      : [];

    const existingIdSet = new Set(existingAlerts.map(a => a.noaaAlertId));

    // Separate alerts into update vs insert batches
    const idsToUpdate: string[] = [];
    const alertsToInsert: NewWeatherAlert[] = [];

    for (const alert of alerts) {
      if (existingIdSet.has(alert.id)) {
        idsToUpdate.push(alert.id);
      } else {
        alertsToInsert.push({
          noaaAlertId: alert.id,
          eventType: alert.event,
          severity: alert.severity,
          certainty: alert.certainty,
          urgency: alert.urgency,
          headline: alert.headline || null,
          description: alert.description || null,
          instruction: alert.instruction || null,
          areaDesc: alert.areaDesc || null,
          affectedZones: alert.affectedZoneIds || [],
          geometry: alert.geometry || null,
          effectiveAt: new Date(alert.effective),
          expiresAt: new Date(alert.expires),
        });
      }
    }

    // Batch update: Update all existing alerts in ONE query
    if (idsToUpdate.length > 0) {
      await db
        .update(weatherAlerts)
        .set({ lastSeenAt: new Date() })
        .where(inArray(weatherAlerts.noaaAlertId, idsToUpdate));
    }

    // Batch insert: Insert all new alerts in ONE query
    if (alertsToInsert.length > 0) {
      await db.insert(weatherAlerts).values(alertsToInsert);
    }

    const processedCount = alerts.length;

    if (isDev()) {
      console.log(`[Collector:Alerts] Processed ${processedCount} alerts`);
    }

    return processedCount;
  } catch (error) {
    console.error('[Collector:Alerts] Failed to collect alerts:', error);
    throw error;
  }
}
