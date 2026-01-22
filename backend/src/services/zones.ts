/**
 * NOAA Forecast Zone Service
 * Fetches and caches zone boundary polygons from the National Weather Service API.
 * Used to display geographic boundaries for weather alerts that lack polygon geometry.
 */

import type { ZoneBoundary, ZoneCacheEntry } from '../types/index.js';
import { getEnv } from '../types/index.js';

const NOAA_BASE = 'https://api.weather.gov';

// ============================================================================
// Zone Boundary Cache (LRU with 24-hour TTL)
// ============================================================================

const zoneCache = new Map<string, ZoneCacheEntry>();
const ZONE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_ZONE_CACHE_SIZE = 30;

/**
 * Build User-Agent string for NOAA API requests.
 */
function getUserAgent(): string {
  const env = getEnv();
  const contactEmail = env.CONTACT_EMAIL ?? 'weather-app@localhost';
  return `VT-Liveview Weather App (${contactEmail})`;
}

/**
 * Get fetch options with dynamic User-Agent header.
 */
function getFetchOptions(): RequestInit {
  return {
    headers: {
      'User-Agent': getUserAgent(),
      Accept: 'application/geo+json',
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a zone URL or ID is a Vermont zone.
 * Vermont zones have the prefix "VTZ".
 */
export function isVermontZone(zoneUrlOrId: string): boolean {
  const zoneId = extractZoneId(zoneUrlOrId);
  return zoneId.startsWith('VTZ');
}

/**
 * Extract zone ID from a full NOAA zone URL.
 * Example: "https://api.weather.gov/zones/forecast/VTZ001" -> "VTZ001"
 */
export function extractZoneId(zoneUrl: string): string {
  // If it's already just an ID, return it
  if (!zoneUrl.includes('/')) {
    return zoneUrl;
  }
  // Extract the last segment of the URL
  const segments = zoneUrl.split('/');
  return segments[segments.length - 1] ?? zoneUrl;
}

// ============================================================================
// Zone Boundary Fetching
// ============================================================================

/**
 * Fetch a single zone boundary from NOAA.
 * Returns null if the zone cannot be fetched.
 */
export async function fetchZoneBoundary(zoneId: string): Promise<ZoneBoundary | null> {
  // Check cache first
  const cached = zoneCache.get(zoneId);
  if (cached && Date.now() - cached.timestamp < ZONE_CACHE_TTL) {
    return cached.boundary;
  }

  try {
    const response = await fetch(
      `${NOAA_BASE}/zones/forecast/${zoneId}`,
      getFetchOptions()
    );

    if (!response.ok) {
      console.warn(`[ZONES] Failed to fetch zone ${zoneId}: ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      geometry: {
        type: 'Polygon' | 'MultiPolygon';
        coordinates: number[][][] | number[][][][];
      } | null;
      properties: {
        id: string;
        name: string;
        state: string;
      };
    };

    if (!data.geometry) {
      console.warn(`[ZONES] Zone ${zoneId} has no geometry`);
      return null;
    }

    const boundary: ZoneBoundary = {
      id: data.properties.id,
      name: data.properties.name,
      state: data.properties.state,
      geometry: data.geometry,
    };

    // Cache the boundary
    cacheZoneBoundary(zoneId, boundary);

    return boundary;
  } catch (error) {
    console.warn(
      `[ZONES] Error fetching zone ${zoneId}:`,
      error instanceof Error ? error.message : 'Unknown error'
    );
    return null;
  }
}

/**
 * Cache a zone boundary with LRU eviction.
 */
function cacheZoneBoundary(zoneId: string, boundary: ZoneBoundary): void {
  // Implement LRU eviction if cache is full
  if (zoneCache.size >= MAX_ZONE_CACHE_SIZE && !zoneCache.has(zoneId)) {
    const firstKey = zoneCache.keys().next().value;
    if (firstKey !== undefined) {
      zoneCache.delete(firstKey);
    }
  }

  zoneCache.set(zoneId, {
    boundary,
    timestamp: Date.now(),
  });
}

/**
 * Fetch multiple zone boundaries in parallel.
 * Returns a Map of zoneId -> ZoneBoundary for successfully fetched zones.
 */
export async function fetchZoneBoundaries(
  zoneUrls: string[]
): Promise<Map<string, ZoneBoundary>> {
  const results = new Map<string, ZoneBoundary>();
  const toFetch: string[] = [];

  // Extract unique zone IDs and check cache
  const uniqueZoneIds = [...new Set(zoneUrls.map(extractZoneId))];

  for (const zoneId of uniqueZoneIds) {
    const cached = zoneCache.get(zoneId);
    if (cached && Date.now() - cached.timestamp < ZONE_CACHE_TTL) {
      results.set(zoneId, cached.boundary);
    } else {
      toFetch.push(zoneId);
    }
  }

  // Fetch missing zones in parallel
  if (toFetch.length > 0) {
    const fetchPromises = toFetch.map(async (zoneId) => {
      const boundary = await fetchZoneBoundary(zoneId);
      return { zoneId, boundary };
    });

    const fetched = await Promise.all(fetchPromises);

    for (const { zoneId, boundary } of fetched) {
      if (boundary) {
        results.set(zoneId, boundary);
      }
    }
  }

  return results;
}

/**
 * Filter zone URLs to only Vermont zones.
 */
export function filterVermontZones(zoneUrls: string[]): string[] {
  return zoneUrls.filter(isVermontZone);
}

/**
 * Clear the zone cache (for testing or admin purposes).
 */
export function clearZoneCache(): { cleared: boolean; timestamp: string } {
  zoneCache.clear();
  return { cleared: true, timestamp: new Date().toISOString() };
}

/**
 * Get cache statistics (for debugging).
 */
export function getZoneCacheStats(): { size: number; maxSize: number; ttlMs: number } {
  return {
    size: zoneCache.size,
    maxSize: MAX_ZONE_CACHE_SIZE,
    ttlMs: ZONE_CACHE_TTL,
  };
}
