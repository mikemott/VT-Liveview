/**
 * Weather alerts collector.
 * Fetches NOAA alerts and stores/updates in database.
 */

import { eq } from 'drizzle-orm';
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

    let processedCount = 0;

    for (const alert of alerts) {
      // Check if alert already exists
      const existing = await db
        .select()
        .from(weatherAlerts)
        .where(eq(weatherAlerts.noaaAlertId, alert.id))
        .limit(1);

      if (existing.length > 0) {
        // Update last_seen timestamp
        await db
          .update(weatherAlerts)
          .set({ lastSeenAt: new Date() })
          .where(eq(weatherAlerts.noaaAlertId, alert.id));
      } else {
        // Insert new alert
        const newAlert: NewWeatherAlert = {
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
        };

        await db.insert(weatherAlerts).values(newAlert);
      }

      processedCount++;
    }

    if (isDev()) {
      console.log(`[Collector:Alerts] Processed ${processedCount} alerts`);
    }

    return processedCount;
  } catch (error) {
    console.error('[Collector:Alerts] Failed to collect alerts:', error);
    throw error;
  }
}
