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

    // Parse each resort entry
    // Note: HTML structure may vary - this is a best-effort parser
    $('.resort-conditions-item, .resort-item, [data-resort]').each((_, elem) => {
      const $elem = $(elem);

      // Extract resort name
      const name = $elem.find('.resort-name, h3, h4').first().text().trim();
      if (!name || !RESORT_COORDS[name]) return; // Skip if name not found or not in our list

      // Parse snowfall (format: "2 - 1" means 2" last 24hr, 1" previous)
      const snowfallText = $elem.find('.snowfall, [data-snowfall]').text().trim();
      const snowMatch = snowfallText.match(/(\d+\.?\d*)\s*-/);
      const snowfall24hr = snowMatch?.[1] ? parseFloat(snowMatch[1]) : null;

      // Parse cumulative snowfall
      const cumulativeMatch = snowfallText.match(/-\s*(\d+\.?\d*)/);
      const snowfallCumulative = cumulativeMatch?.[1] ? parseFloat(cumulativeMatch[1]) : null;

      // Parse lifts "14/20"
      const liftsText = $elem.find('.lifts, [data-lifts]').text().trim();
      const liftsMatch = liftsText.match(/(\d+)\s*\/\s*(\d+)/);
      const liftsOpen = liftsMatch?.[1] ? parseInt(liftsMatch[1]) : 0;
      const liftsTotal = liftsMatch?.[2] ? parseInt(liftsMatch[2]) : 1;

      // Parse trails "147/155"
      const trailsText = $elem.find('.trails, [data-trails]').text().trim();
      const trailsMatch = trailsText.match(/(\d+)\s*\/\s*(\d+)/);
      const trailsOpen = trailsMatch?.[1] ? parseInt(trailsMatch[1]) : 0;
      const trailsTotal = trailsMatch?.[2] ? parseInt(trailsMatch[2]) : 1;

      // Parse temperatures
      const tempText = $elem.find('.temperature, [data-temp]').text().trim();
      const tempCurrentMatch = tempText.match(/(-?\d+)\s*°?F?/);
      const tempCurrent = tempCurrentMatch?.[1] ? parseInt(tempCurrentMatch[1]) : null;

      // Parse temp range if available
      const tempRangeMatch = tempText.match(/(-?\d+)\s*\/\s*(-?\d+)/);
      const tempLow = tempRangeMatch?.[1] ? parseInt(tempRangeMatch[1]) : null;
      const tempHigh = tempRangeMatch?.[2] ? parseInt(tempRangeMatch[2]) : null;

      // Parse base depth
      const baseText = $elem.find('.base-depth, [data-base]').text().trim();
      const baseMatch = baseText.match(/(\d+)\s*"/);
      const baseDepth = baseMatch?.[1] ? parseInt(baseMatch[1]) : null;

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

      const resort: SkiResort = {
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        latitude: RESORT_COORDS[name].lat,
        longitude: RESORT_COORDS[name].lon,
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

    // Validate: should have at least 15 resorts
    if (resorts.length < 15) {
      throw new Error(`Only parsed ${resorts.length} resorts - HTML structure may have changed`);
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
    // Log error (will be captured by Sentry if configured)
    if (process.env.NODE_ENV === 'development') {
      console.error('Ski conditions fetch failed:', error);
    }

    // Return stale cache if available
    const staleCache = skiConditionsCache.get('resorts');
    if (staleCache) {
      console.warn('Using stale ski conditions cache');
      return staleCache.resorts;
    }

    // Last resort: return empty array
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
