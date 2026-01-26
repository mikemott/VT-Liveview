import * as cheerio from 'cheerio';
import type { SkiResort, SkiConditionsCache } from '../types/ski.js';
import { RESORT_COORDS, RESORT_LOGOS } from '../data/resortData.js';

interface ColorInput {
  snowfall24hr: number | null;
  trailsOpen: number;
  trailsTotal: number;
  liftsOpen: number;
  liftsTotal: number;
}

/**
 * Normalize resort name for matching against RESORT_COORDS keys
 * Handles common variations in resort naming
 */
function normalizeResortName(name: string): string {
  return name
    // Remove common suffixes
    .replace(/\s+(Resort|Mountain Resort|Ski Area|Cross Country|Nordic Center)$/i, '')
    // Normalize apostrophes (curly to straight)
    .replace(/'/g, "'")
    // Normalize "Snowbowl" vs "Snow Bowl"
    .replace(/Snowbowl/i, 'Snow Bowl')
    // Normalize "Cochran's" vs "Cochrans"
    .replace(/Cochran's/i, 'Cochrans')
    // Normalize "Smugglers'" vs "Smugglers"
    .replace(/Smugglers'/i, 'Smugglers')
    .trim();
}

/**
 * Find matching resort name in RESORT_COORDS, trying exact match first then normalized
 */
function findResortCoords(extractedName: string): string | null {
  // Try exact match first
  if (RESORT_COORDS[extractedName]) {
    return extractedName;
  }

  // Try normalized match
  const normalized = normalizeResortName(extractedName);
  if (RESORT_COORDS[normalized]) {
    return normalized;
  }

  // Try normalized match against all keys
  for (const key of Object.keys(RESORT_COORDS)) {
    if (normalizeResortName(key) === normalized) {
      return key;
    }
  }

  return null;
}

export function calculateResortColor(input: ColorInput): 'green' | 'yellow' | 'red' {
  const { snowfall24hr, trailsOpen, trailsTotal, liftsOpen, liftsTotal } = input;

  // Step 1: Check snow quality
  const hasGoodSnow = snowfall24hr !== null && snowfall24hr >= 2;
  const hasDecentSnow = snowfall24hr !== null && snowfall24hr >= 0.5;

  // Step 2: Check operational status
  const trailsPercent = (trailsOpen / trailsTotal) * 100;
  const liftsPercent = (liftsOpen / liftsTotal) * 100;
  const operationsPercent = Math.min(trailsPercent, liftsPercent);

  const goodOperations = operationsPercent >= 70;
  const decentOperations = operationsPercent >= 40;

  // Step 3: Combine (tiered priority)
  if (hasGoodSnow && goodOperations) return 'green';
  if (hasDecentSnow && decentOperations) return 'yellow';
  if (decentOperations) return 'yellow';
  return 'red';
}

// ============================================================================
// LRU Cache with 12-hour TTL (matches cron frequency)
// ============================================================================

const skiConditionsCache = new Map<string, SkiConditionsCache>();
let cacheTimeout: ReturnType<typeof setTimeout> | null = null;

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Fetch and parse ski conditions from skivermont.com
 */
export async function fetchSkiConditions(): Promise<SkiResort[]> {
  // Check cache first
  const cached = skiConditionsCache.get('resorts');
  if (cached) {
    return cached.resorts;
  }

  try {
    const response = await fetch('https://skivermont.com/conditions');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const resorts: SkiResort[] = [];

    // Parse each resort card from widget_resort_conditions section
    const cards = $('.widget_resort_conditions .card');
    console.log(`[SKI] Found ${cards.length} resort cards`);

    // Track which resorts we've already added (to skip duplicates like "Stowe" and "Stowe Cross Country")
    const processedResorts = new Set<string>();

    cards.each((_, elem) => {
      const $elem = $(elem);

      // Extract resort name from .name a element
      const extractedName = $elem.find('.name a').first().text().trim();
      console.log(`[SKI] Extracted name: "${extractedName}"`);

      if (!extractedName) {
        console.log('[SKI] Skipping: empty name');
        return;
      }

      // Try to find matching resort in RESORT_COORDS
      const matchedKey = findResortCoords(extractedName);
      if (!matchedKey) {
        console.log(`[SKI] Skipping: "${extractedName}" - no match in RESORT_COORDS`);
        return;
      }

      // Skip duplicates (e.g., "Stowe" downhill and "Stowe Cross Country" both match "Stowe")
      if (processedResorts.has(matchedKey)) {
        console.log(`[SKI] Skipping: "${extractedName}" → "${matchedKey}" (duplicate)`);
        return;
      }

      const name = matchedKey;
      processedResorts.add(name);
      console.log(`[SKI] Processing: "${extractedName}" → "${name}"`);

      // Parse all .item elements
      const items = $elem.find('.mtn_info .item');

      let snowfall24hr: number | null = null;
      let snowfallCumulative: number | null = null;
      let liftsOpen = 0;
      let liftsTotal = 1;
      let trailsOpen = 0;
      let trailsTotal = 1;
      let tempLow: number | null = null;
      let tempHigh: number | null = null;

      items.each((_, item) => {
        const $item = $(item);
        const text = $item.text().trim();
        const span = $item.find('span').text().trim();

        // Last 24hr Snowfall
        if (text.includes('Last 24hr Snowfall')) {
          if (!span.includes('No Update')) {
            const match = span.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
            if (match && match[1] && match[2]) {
              snowfall24hr = parseFloat(match[1]);
              snowfallCumulative = parseFloat(match[2]);
            }
          }
        }

        // Last Snowfall
        else if (text.includes('Last Snowfall') && !text.includes('24hr')) {
          const match = span.match(/(\d+\.?\d*)/);
          if (match && match[1] && snowfallCumulative === null) {
            snowfallCumulative = parseFloat(match[1]);
          }
        }

        // Lifts
        else if (text.includes('Lifts')) {
          const match = span.match(/(\d+)\s*\/\s*(\d+)/);
          if (match && match[1] && match[2]) {
            liftsOpen = parseInt(match[1]);
            liftsTotal = parseInt(match[2]);
          }
        }

        // Trails
        else if (text.includes('Trails')) {
          const match = span.match(/(\d+)\s*\/\s*(\d+)/);
          if (match && match[1] && match[2]) {
            trailsOpen = parseInt(match[1]);
            trailsTotal = parseInt(match[2]);
          }
        }

        // Today's Low/High
        else if (text.includes('Low/High')) {
          const match = span.match(/(-?\d+)[^\/]*\/\s*(-?\d+)/);
          if (match && match[1] && match[2]) {
            tempLow = parseInt(match[1]);
            tempHigh = parseInt(match[2]);
          }
        }
      });

      const tempCurrent = tempLow; // Use low temp as current if no current available
      const baseDepth: number | null = null; // Not provided in this format

      // Determine status
      const status = liftsOpen === 0 ? 'closed' :
                    (liftsOpen / liftsTotal < 0.5 ? 'partial' : 'open');

      // Calculate color
      const color = calculateResortColor({
        snowfall24hr,
        trailsOpen,
        trailsTotal,
        liftsOpen,
        liftsTotal,
      });

      const coords = RESORT_COORDS[name];
      if (!coords) {
        console.error(`[SKI] BUG: coords missing for "${name}" after findResortCoords succeeded`);
        return;
      }

      const resort: SkiResort = {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        latitude: coords.lat,
        longitude: coords.lon,
        logoUrl: RESORT_LOGOS[name] || null,
        snowfall24hr,
        snowfallCumulative,
        liftsOpen,
        liftsTotal,
        trailsOpen,
        trailsTotal,
        tempCurrent,
        tempHigh,
        tempLow,
        baseDepth,
        lastUpdated: new Date().toISOString(),
        status,
        color,
      };

      resorts.push(resort);
    });

    console.log(`[SKI] Parsed ${resorts.length} resorts successfully`);

    // Validate: should have at least 10 resorts (we have 20 in RESORT_COORDS, expecting ~50% match rate)
    if (resorts.length < 10) {
      throw new Error(`Only parsed ${resorts.length} resorts - expected at least 10`);
    }

    // Cache with 12-hour TTL
    const cacheData: SkiConditionsCache = {
      resorts,
      fetchedAt: new Date().toISOString(),
    };
    skiConditionsCache.set('resorts', cacheData);

    // Set timeout to clear cache
    if (cacheTimeout) clearTimeout(cacheTimeout);
    cacheTimeout = setTimeout(() => {
      skiConditionsCache.clear();
    }, CACHE_TTL_MS);

    return resorts;

  } catch (error) {
    // Always log errors (including production) to help debug issues
    console.error('[SKI] Ski conditions fetch failed:', error);

    // Return stale cache if available
    const staleCache = skiConditionsCache.get('resorts');
    if (staleCache) {
      console.warn('[SKI] Using stale ski conditions cache');
      return staleCache.resorts;
    }

    // Last resort: return empty array
    console.error('[SKI] No cache available, returning empty array');
    return [];
  }
}

/**
 * Clear the ski conditions cache (for testing/debugging)
 */
export function clearCache(): void {
  skiConditionsCache.clear();
  if (cacheTimeout) {
    clearTimeout(cacheTimeout);
    cacheTimeout = null;
  }
}
