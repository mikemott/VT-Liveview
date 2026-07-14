import beachData from '../data/vtBeaches.json' with { type: 'json' };
import type { Beach, BeachCache, BurlingtonApiResponse } from '../types/beach.js';

const beachCache = new Map<string, BeachCache>();
let cacheTimeout: ReturnType<typeof setTimeout> | null = null;

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const BURLINGTON_API_URL = 'https://maps.burlingtonvt.gov/arcgis/rest/services/BTV_Beach_Status/MapServer/0/query';

/**
 * Calculate beach color based on cyanobacteria category and E. coli levels
 */
function calculateBeachColor(input: {
  cyanobacteriaCategory: number | null;
  eColiLevel: number | null;
}): 'green' | 'yellow' | 'red' {
  const { cyanobacteriaCategory, eColiLevel } = input;

  // Cyanobacteria category takes priority
  // 1 = Open (green), 2 = Alert (yellow), 3 = Closed (red)
  if (cyanobacteriaCategory === 3) return 'red';
  if (cyanobacteriaCategory === 2) return 'yellow';

  // E. coli level check (EPA threshold: 235 per 100 mL)
  if (eColiLevel !== null) {
    if (eColiLevel >= 235) return 'red';
    if (eColiLevel >= 100) return 'yellow';
  }

  // Default to green if open with low/no E. coli
  if (cyanobacteriaCategory === 1) return 'green';

  // Unknown status - default to yellow
  return 'yellow';
}

/**
 * Calculate water quality grade from E. coli levels
 */
function calculateGrade(eColiLevel: number | null): Beach['waterQualityGrade'] {
  if (eColiLevel === null) return null;

  if (eColiLevel < 50) return 'A';
  if (eColiLevel < 100) return 'B';
  if (eColiLevel < 235) return 'C'; // EPA threshold
  if (eColiLevel < 500) return 'D';
  return 'F';
}

/**
 * Determine status from cyanobacteria category
 */
function determineStatus(cyanobacteriaCategory: number | null): Beach['status'] {
  if (cyanobacteriaCategory === null) return 'unknown';
  if (cyanobacteriaCategory === 1) return 'open';
  if (cyanobacteriaCategory === 2) return 'alert';
  if (cyanobacteriaCategory === 3) return 'closed';
  return 'unknown';
}

/**
 * Fetch Burlington beach data from ArcGIS REST API
 */
async function fetchBurlingtonBeachData(): Promise<Map<number, BurlingtonApiResponse['features'][0]>> {
  const url = `${BURLINGTON_API_URL}?where=1%3D1&outFields=*&f=json`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'VT-LiveView/1.0 (Educational; mike@mottvt.com)'
    },
    signal: controller.signal
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`Burlington API error: ${response.status}`);
  }

  const data = await response.json() as BurlingtonApiResponse;

  // Create a map of LocationId -> beach data for fast lookups
  const beachMap = new Map<number, BurlingtonApiResponse['features'][0]>();

  for (const feature of data.features) {
    beachMap.set(feature.attributes.LocationId, feature);
  }

  return beachMap;
}

/**
 * Fetch and merge beach water quality data
 */
export async function fetchBeachWaterQuality(): Promise<Beach[]> {
  // Check cache first
  const cached = beachCache.get('beaches');
  if (cached) {
    return cached.beaches;
  }

  try {
    // Fetch Burlington data
    const burlingtonData = await fetchBurlingtonBeachData();

    // Merge with static beach data
    const beaches: Beach[] = (beachData as any[]).map(staticBeach => {
      // Check if this beach has Burlington water quality data
      const waterQualityData = staticBeach.burlingtonLocationId
        ? burlingtonData.get(staticBeach.burlingtonLocationId)
        : null;

      if (!waterQualityData) {
        // No water quality data - return beach with unknown status
        return {
          ...staticBeach,
          waterQualityGrade: null,
          waterTemp: null,
          eColiLevel: null,
          cyanobacteriaCategory: null,
          lastTested: null,
          advisory: null,
          status: 'unknown' as const,
          color: 'yellow' as const,
          lastUpdated: new Date().toISOString(),
        };
      }

      const attrs = waterQualityData.attributes;

      // Parse E. coli level (0 means not tested or below detection limit)
      const eColiLevel = attrs.EColi !== null && attrs.EColi > 0 ? attrs.EColi : null;

      // Calculate grade, color, and status
      const waterQualityGrade = calculateGrade(eColiLevel);
      const color = calculateBeachColor({
        cyanobacteriaCategory: attrs.CyanobacteriaCategory,
        eColiLevel,
      });
      const status = determineStatus(attrs.CyanobacteriaCategory);

      // Generate advisory message if needed
      let advisory: string | null = null;
      if (attrs.CyanobacteriaCategory === 2) {
        advisory = 'Cyanobacteria is present in low levels. Vulnerable groups (children and pets) are advised to avoid the water.';
      } else if (attrs.CyanobacteriaCategory === 3) {
        advisory = 'Cyanobacteria bloom present at dangerous levels. Swimming prohibited.';
      } else if (eColiLevel && eColiLevel >= 235) {
        advisory = 'High E. coli levels detected. Beach closed until levels return to safe range.';
      }

      // Append notes if present, preserving any generated advisory
      if (attrs.Notes) {
        advisory = advisory ? `${advisory} ${attrs.Notes}` : attrs.Notes;
      }

      return {
        ...staticBeach,
        waterQualityGrade,
        waterTemp: null, // Not provided by Burlington API
        eColiLevel,
        cyanobacteriaCategory: attrs.CyanobacteriaCategory,
        lastTested: attrs.ResultDateTime,
        advisory,
        status,
        color,
        lastUpdated: new Date().toISOString(),
      };
    });

    // Cache with 12-hour TTL
    const cacheData: BeachCache = {
      beaches,
      fetchedAt: new Date().toISOString(),
    };
    beachCache.set('beaches', cacheData);

    // Set timeout to clear cache
    if (cacheTimeout) clearTimeout(cacheTimeout);
    cacheTimeout = setTimeout(() => {
      beachCache.clear();
    }, CACHE_TTL_MS);

    return beaches;

  } catch (error) {
    // Log errors (will be captured by Sentry if configured)
    console.error('Beach water quality fetch failed:', error);

    // Return stale cache if available
    const staleCache = beachCache.get('beaches');
    if (staleCache) {
      console.warn('Using stale beach water quality cache');
      return staleCache.beaches;
    }

    // Last resort: return beaches with no quality data
    return (beachData as any[]).map(beach => ({
      ...beach,
      waterQualityGrade: null,
      waterTemp: null,
      eColiLevel: null,
      cyanobacteriaCategory: null,
      lastTested: null,
      advisory: null,
      status: 'unknown' as const,
      color: 'yellow' as const,
      lastUpdated: new Date().toISOString(),
    }));
  }
}

/**
 * Clear the beach water quality cache (for testing/debugging)
 */
export function clearCache(): void {
  beachCache.clear();
  if (cacheTimeout) {
    clearTimeout(cacheTimeout);
    cacheTimeout = null;
  }
}
