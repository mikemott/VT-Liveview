/**
 * River gauge collector.
 * Fetches USGS water level data and stores in database.
 */

import { getDb, riverGauges, type NewRiverGauge } from '../db/index.js';
import { isDev } from '../types/env.js';

// USGS Water Services API
const USGS_API_BASE = 'https://waterservices.usgs.gov/nwis/iv';

interface USGSSite {
  siteCode: string;
  siteName: string;
  latitude: number;
  longitude: number;
  gageHeightFt: number;
  observedAt: Date;
}

/**
 * Collect and store river gauge readings from USGS.
 * Returns the number of readings stored.
 */
export async function collectRiverGauges(): Promise<number> {
  const db = getDb();
  if (!db) {
    if (isDev()) {
      console.log('[Collector:Gauges] Database not configured, skipping');
    }
    return 0;
  }

  try {
    // Fetch Vermont gauge data from USGS
    // parameterCd=00065 = Gage height (feet)
    const url = `${USGS_API_BASE}?format=json&stateCd=VT&parameterCd=00065&siteStatus=active`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'VT-Liveview/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`USGS API returned ${response.status}`);
    }

    const data = await response.json();
    const sites = parseUSGSResponse(data);

    if (sites.length === 0) {
      if (isDev()) {
        console.log('[Collector:Gauges] No gauge data from USGS');
      }
      return 0;
    }

    const readings: NewRiverGauge[] = sites.map((site) => ({
      siteCode: site.siteCode,
      siteName: site.siteName,
      latitude: String(site.latitude),
      longitude: String(site.longitude),
      observedAt: site.observedAt,
      gageHeightFt: String(site.gageHeightFt),
    }));

    // Insert readings, ignoring duplicates (same site + timestamp)
    await db
      .insert(riverGauges)
      .values(readings)
      .onConflictDoNothing();

    if (isDev()) {
      console.log(`[Collector:Gauges] Stored ${readings.length} gauge readings`);
    }

    return readings.length;
  } catch (error) {
    console.error('[Collector:Gauges] Failed to collect gauge data:', error);
    throw error;
  }
}

/**
 * Parse USGS Water Services API response.
 */
function parseUSGSResponse(data: unknown): USGSSite[] {
  const sites: USGSSite[] = [];

  try {
    // Navigate the USGS JSON structure
    const response = data as {
      value?: {
        timeSeries?: Array<{
          sourceInfo?: {
            siteName?: string;
            siteCode?: Array<{ value?: string }>;
            geoLocation?: {
              geogLocation?: {
                latitude?: number;
                longitude?: number;
              };
            };
          };
          variable?: {
            variableCode?: Array<{ value?: string }>;
          };
          values?: Array<{
            value?: Array<{
              value?: string;
              dateTime?: string;
            }>;
          }>;
        }>;
      };
    };

    const timeSeries = response.value?.timeSeries || [];

    for (const series of timeSeries) {
      const sourceInfo = series.sourceInfo;
      if (!sourceInfo) continue;

      const siteCode = sourceInfo.siteCode?.[0]?.value;
      const siteName = sourceInfo.siteName || 'Unknown';
      const geoLocation = sourceInfo.geoLocation?.geogLocation;

      if (!siteCode || !geoLocation) continue;

      const latitude = geoLocation.latitude || 0;
      const longitude = geoLocation.longitude || 0;

      // Skip sites without valid location
      if (latitude === 0 && longitude === 0) continue;

      // Get the latest value
      const values = series.values?.[0]?.value || [];
      const latestValue = values[values.length - 1];

      if (!latestValue?.value || !latestValue.dateTime) continue;

      const gageHeightFt = parseFloat(latestValue.value);
      if (isNaN(gageHeightFt)) continue;

      const observedAt = new Date(latestValue.dateTime);
      if (isNaN(observedAt.getTime())) continue;

      // Skip readings older than 3 hours
      const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
      if (observedAt.getTime() < threeHoursAgo) continue;

      sites.push({
        siteCode,
        siteName,
        latitude,
        longitude,
        gageHeightFt,
        observedAt,
      });
    }
  } catch (error) {
    if (isDev()) {
      console.error('[Collector:Gauges] Error parsing USGS response:', error);
    }
  }

  return sites;
}
