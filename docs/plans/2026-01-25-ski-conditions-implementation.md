# Ski Conditions Layer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add real-time ski resort conditions to VT-LiveView map with color-coded markers and detailed popups.

**Architecture:** Backend scrapes skivermont.com twice daily via GitHub Actions, caches data with 12-hour TTL, serves via GraphQL. Frontend displays circular markers with Mountain icons, color-coded by snow + operations metrics.

**Tech Stack:** Cheerio (HTML parsing), GraphQL, MapLibre GL, React Query, Lucide icons

---

## Phase 1: Backend - Ski Data Service

### Task 1: Create Ski Conditions Types

**Files:**
- Create: `backend/src/types/ski.ts`

**Step 1: Write type definitions**

```typescript
export interface SkiResort {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  logoUrl: string | null;
  snowfall24hr: number | null;
  snowfallCumulative: number | null;
  liftsOpen: number;
  liftsTotal: number;
  trailsOpen: number;
  trailsTotal: number;
  tempCurrent: number | null;
  tempHigh: number | null;
  tempLow: number | null;
  baseDepth: number | null;
  lastUpdated: string;
  status: 'open' | 'partial' | 'closed';
  color: 'green' | 'yellow' | 'red';
}

export interface ResortCoordinates {
  lat: number;
  lon: number;
}

export interface SkiConditionsCache {
  resorts: SkiResort[];
  fetchedAt: string;
}
```

**Step 2: Commit**

```bash
git add backend/src/types/ski.ts
git commit -m "feat(backend): add ski resort type definitions"
```

---

### Task 2: Create Resort Lookup Data

**Files:**
- Create: `backend/src/data/resortData.ts`

**Step 1: Add resort coordinates**

```typescript
import type { ResortCoordinates } from '../types/ski.js';

export const RESORT_COORDS: Record<string, ResortCoordinates> = {
  'Bolton Valley': { lat: 44.4064, lon: -72.8725 },
  'Bromley Mountain': { lat: 43.2267, lon: -72.9628 },
  'Burke Mountain': { lat: 44.5804, lon: -71.9175 },
  'Cochrans Ski Area': { lat: 44.4267, lon: -73.1772 },
  'Jay Peak': { lat: 44.9383, lon: -72.5032 },
  'Killington': { lat: 43.6046, lon: -72.8197 },
  'Mad River Glen': { lat: 44.2017, lon: -72.9209 },
  'Magic Mountain': { lat: 43.1642, lon: -72.8214 },
  'Middlebury Snow Bowl': { lat: 44.0050, lon: -73.0992 },
  'Mount Snow': { lat: 42.9608, lon: -72.9203 },
  'Okemo': { lat: 43.4019, lon: -72.7176 },
  'Pico Mountain': { lat: 43.6592, lon: -72.8492 },
  'Quechee Ski Hill': { lat: 43.6467, lon: -72.4142 },
  'Saskadena Six': { lat: 44.0133, lon: -72.0733 },
  'Smugglers Notch': { lat: 44.5450, lon: -72.7856 },
  'Stowe': { lat: 44.5303, lon: -72.7817 },
  'Stratton': { lat: 43.1142, lon: -72.9083 },
  'Sugarbush': { lat: 44.1356, lon: -72.9017 },
  'Suicide Six': { lat: 43.6397, lon: -72.4656 },
  'Sundown Ski Area': { lat: 43.0281, lon: -72.8753 },
};

export const RESORT_LOGOS: Record<string, string> = {
  'Bolton Valley': 'https://www.boltonvalley.com/wp-content/uploads/2023/06/BV-Logo-White.png',
  'Bromley Mountain': 'https://www.bromley.com/wp-content/uploads/2023/05/bromley-logo.svg',
  'Burke Mountain': 'https://skiburke.com/wp-content/uploads/2023/06/burke-mountain-logo.svg',
  'Jay Peak': 'https://jaypeakresort.com/wp-content/uploads/2023/06/jay-peak-logo.svg',
  'Killington': 'https://www.killington.com/~/media/killington/logos/killington-logo-white.ashx',
  'Mad River Glen': 'https://www.madriverglen.com/wp-content/uploads/2023/06/mrg-logo.svg',
  'Mount Snow': 'https://www.mountsnow.com/~/media/mount-snow/logos/mount-snow-logo-white.ashx',
  'Okemo': 'https://www.okemo.com/~/media/okemo/logos/okemo-logo-white.ashx',
  'Pico Mountain': 'https://www.picomountain.com/~/media/pico/logos/pico-logo-white.ashx',
  'Smugglers Notch': 'https://www.smuggs.com/wp-content/uploads/2023/06/smuggs-logo.svg',
  'Stowe': 'https://www.stowe.com/~/media/stowe/logos/stowe-logo-white.ashx',
  'Stratton': 'https://www.stratton.com/~/media/stratton/logos/stratton-logo-white.ashx',
  'Sugarbush': 'https://www.sugarbush.com/~/media/sugarbush/logos/sugarbush-logo-white.ashx',
  // Note: Smaller resorts may not have public logo URLs - will default to Mountain icon
};
```

**Step 2: Commit**

```bash
git add backend/src/data/resortData.ts
git commit -m "feat(backend): add resort coordinates and logo URLs"
```

---

### Task 3: Create Ski Conditions Service (Part 1 - Color Logic)

**Files:**
- Create: `backend/src/services/skiConditions.ts`
- Reference: `backend/src/services/noaa.ts` (for LRU cache pattern)

**Step 1: Write failing test for color calculation**

Create: `backend/src/services/__tests__/skiConditions.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { calculateResortColor } from '../skiConditions.js';

describe('calculateResortColor', () => {
  it('returns green for good snow and operations', () => {
    const result = calculateResortColor({
      snowfall24hr: 2.5,
      trailsOpen: 80,
      trailsTotal: 100,
      liftsOpen: 14,
      liftsTotal: 15,
    });
    expect(result).toBe('green');
  });

  it('returns yellow for decent snow and moderate operations', () => {
    const result = calculateResortColor({
      snowfall24hr: 0.5,
      trailsOpen: 50,
      trailsTotal: 100,
      liftsOpen: 6,
      liftsTotal: 15,
    });
    expect(result).toBe('yellow');
  });

  it('returns yellow for open resort with no fresh snow', () => {
    const result = calculateResortColor({
      snowfall24hr: 0,
      trailsOpen: 80,
      trailsTotal: 100,
      liftsOpen: 12,
      liftsTotal: 15,
    });
    expect(result).toBe('yellow');
  });

  it('returns red for poor operations', () => {
    const result = calculateResortColor({
      snowfall24hr: 1,
      trailsOpen: 20,
      trailsTotal: 100,
      liftsOpen: 2,
      liftsTotal: 15,
    });
    expect(result).toBe('red');
  });

  it('handles null snowfall', () => {
    const result = calculateResortColor({
      snowfall24hr: null,
      trailsOpen: 70,
      trailsTotal: 100,
      liftsOpen: 10,
      liftsTotal: 15,
    });
    expect(result).toBe('yellow');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd backend
npm test skiConditions.test.ts
```

Expected: FAIL - `calculateResortColor is not defined`

**Step 3: Write minimal implementation**

In `backend/src/services/skiConditions.ts`:

```typescript
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
```

**Step 4: Run test to verify it passes**

```bash
npm test skiConditions.test.ts
```

Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add backend/src/services/__tests__/skiConditions.test.ts backend/src/services/skiConditions.ts
git commit -m "feat(backend): add ski resort color calculation logic with tests"
```

---

### Task 4: Create Ski Conditions Service (Part 2 - Scraper)

**Files:**
- Modify: `backend/src/services/skiConditions.ts`
- Add dependency: `cheerio` (HTML parsing)

**Step 1: Install cheerio**

```bash
cd backend
npm install cheerio
npm install --save-dev @types/cheerio
```

**Step 2: Write scraping service**

Add to `backend/src/services/skiConditions.ts`:

```typescript
import * as cheerio from 'cheerio';
import type { SkiResort, SkiConditionsCache } from '../types/ski.js';
import { RESORT_COORDS, RESORT_LOGOS } from '../data/resortData.js';

// LRU cache with 12-hour TTL (matches cron frequency)
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
      const snowfall24hr = snowMatch ? parseFloat(snowMatch[1]) : null;

      // Parse cumulative snowfall
      const cumulativeMatch = snowfallText.match(/-\s*(\d+\.?\d*)/);
      const snowfallCumulative = cumulativeMatch ? parseFloat(cumulativeMatch[1]) : null;

      // Parse lifts "14/20"
      const liftsText = $elem.find('.lifts, [data-lifts]').text().trim();
      const liftsMatch = liftsText.match(/(\d+)\s*\/\s*(\d+)/);
      const liftsOpen = liftsMatch ? parseInt(liftsMatch[1]) : 0;
      const liftsTotal = liftsMatch ? parseInt(liftsMatch[2]) : 1;

      // Parse trails "147/155"
      const trailsText = $elem.find('.trails, [data-trails]').text().trim();
      const trailsMatch = trailsText.match(/(\d+)\s*\/\s*(\d+)/);
      const trailsOpen = trailsMatch ? parseInt(trailsMatch[1]) : 0;
      const trailsTotal = trailsMatch ? parseInt(trailsMatch[2]) : 1;

      // Parse temperatures
      const tempText = $elem.find('.temperature, [data-temp]').text().trim();
      const tempCurrentMatch = tempText.match(/(-?\d+)\s*°?F?/);
      const tempCurrent = tempCurrentMatch ? parseInt(tempCurrentMatch[1]) : null;

      // Parse temp range if available
      const tempRangeMatch = tempText.match(/(-?\d+)\s*\/\s*(-?\d+)/);
      const tempLow = tempRangeMatch ? parseInt(tempRangeMatch[1]) : null;
      const tempHigh = tempRangeMatch ? parseInt(tempRangeMatch[2]) : null;

      // Parse base depth
      const baseText = $elem.find('.base-depth, [data-base]').text().trim();
      const baseMatch = baseText.match(/(\d+)\s*"/);
      const baseDepth = baseMatch ? parseInt(baseMatch[1]) : null;

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
```

**Step 3: Commit**

```bash
git add backend/src/services/skiConditions.ts backend/package.json backend/package-lock.json
git commit -m "feat(backend): add ski conditions scraper with caching"
```

---

### Task 5: Add GraphQL Schema for Ski Resorts

**Files:**
- Modify: `backend/src/schema.graphql`

**Step 1: Add types to schema**

Append to `backend/src/schema.graphql`:

```graphql
type SkiResort {
  id: ID!
  name: String!
  latitude: Float!
  longitude: Float!
  logoUrl: String
  snowfall24hr: Float
  snowfallCumulative: Float
  liftsOpen: Int!
  liftsTotal: Int!
  trailsOpen: Int!
  trailsTotal: Int!
  tempCurrent: Int
  tempHigh: Int
  tempLow: Int
  baseDepth: Int
  lastUpdated: String!
  status: String!
  color: String!
}

extend type Query {
  skiResorts: [SkiResort!]!
}
```

**Step 2: Commit**

```bash
git add backend/src/schema.graphql
git commit -m "feat(backend): add ski resorts to GraphQL schema"
```

---

### Task 6: Add GraphQL Resolver for Ski Resorts

**Files:**
- Modify: `backend/src/resolvers/index.ts`

**Step 1: Add resolver**

In `backend/src/resolvers/index.ts`, add:

```typescript
import { fetchSkiConditions } from '../services/skiConditions.js';

// Add to existing resolvers object:
export const resolvers = {
  Query: {
    // ... existing resolvers ...

    skiResorts: async () => {
      return await fetchSkiConditions();
    },
  },
};
```

**Step 2: Commit**

```bash
git add backend/src/resolvers/index.ts
git commit -m "feat(backend): add skiResorts GraphQL resolver"
```

---

### Task 7: Add Refresh Endpoint for GitHub Actions

**Files:**
- Modify: `backend/src/server.ts`

**Step 1: Add POST endpoint**

In `backend/src/server.ts`, add route:

```typescript
import { fetchSkiConditions } from './services/skiConditions.js';

// Add after other routes
fastify.post('/api/ski-conditions/refresh', async (request, reply) => {
  try {
    const resorts = await fetchSkiConditions();
    return {
      success: true,
      updated: new Date().toISOString(),
      resortCount: resorts.length,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    reply.code(500);
    return {
      success: false,
      error: errorMessage,
    };
  }
});
```

**Step 2: Test endpoint manually**

```bash
cd backend
npm run dev
# In another terminal:
curl -X POST http://localhost:4000/api/ski-conditions/refresh
```

Expected: `{"success":true,"updated":"...","resortCount":20}`

**Step 3: Commit**

```bash
git add backend/src/server.ts
git commit -m "feat(backend): add ski conditions refresh endpoint"
```

---

## Phase 2: GitHub Actions Cron Job

### Task 8: Create GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/ski-conditions-cron.yml`

**Step 1: Write workflow file**

```yaml
name: Update Ski Conditions
on:
  schedule:
    # 6 AM ET = 11 AM UTC (EST) or 10 AM UTC (EDT)
    - cron: '0 11 * * *'
    # 2 PM ET = 7 PM UTC (EST) or 6 PM UTC (EDT)
    - cron: '0 19 * * *'
  workflow_dispatch: # Allow manual triggering

jobs:
  update-ski-conditions:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger backend refresh endpoint
        run: |
          response=$(curl -f -X POST https://vt-liveview-api.fly.dev/api/ski-conditions/refresh)
          echo "Response: $response"

      - name: Notify on failure
        if: failure()
        run: |
          echo "::error::Ski conditions update failed"
```

**Step 2: Commit**

```bash
git add .github/workflows/ski-conditions-cron.yml
git commit -m "feat(ci): add GitHub Actions cron for ski conditions"
```

**Step 3: Test manually**

After pushing to GitHub:
1. Go to Actions tab
2. Select "Update Ski Conditions" workflow
3. Click "Run workflow"
4. Verify it succeeds

---

## Phase 3: Frontend - Ski Layer Component

### Task 9: Create Ski Colors Utility

**Files:**
- Create: `src/utils/skiColors.ts`

**Step 1: Write failing test**

Create: `src/utils/__tests__/skiColors.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { calculateResortColor, SKI_COLORS } from '../skiColors';

describe('skiColors', () => {
  describe('calculateResortColor', () => {
    it('returns green for powder day with full operations', () => {
      expect(calculateResortColor({
        snowfall24hr: 3,
        trailsOpen: 90,
        trailsTotal: 100,
        liftsOpen: 14,
        liftsTotal: 15,
      })).toBe('green');
    });

    it('returns yellow for moderate conditions', () => {
      expect(calculateResortColor({
        snowfall24hr: 1,
        trailsOpen: 50,
        trailsTotal: 100,
        liftsOpen: 8,
        liftsTotal: 15,
      })).toBe('yellow');
    });

    it('returns red for poor conditions', () => {
      expect(calculateResortColor({
        snowfall24hr: 0,
        trailsOpen: 10,
        trailsTotal: 100,
        liftsOpen: 1,
        liftsTotal: 15,
      })).toBe('red');
    });
  });

  describe('SKI_COLORS', () => {
    it('defines color values', () => {
      expect(SKI_COLORS.green).toBe('#22c55e');
      expect(SKI_COLORS.yellow).toBe('#eab308');
      expect(SKI_COLORS.red).toBe('#ef4444');
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test skiColors.test.ts
```

Expected: FAIL - `calculateResortColor is not defined`

**Step 3: Write implementation**

Create: `src/utils/skiColors.ts`

```typescript
interface ColorInput {
  snowfall24hr: number | null;
  trailsOpen: number;
  trailsTotal: number;
  liftsOpen: number;
  liftsTotal: number;
}

export function calculateResortColor(input: ColorInput): 'green' | 'yellow' | 'red' {
  const { snowfall24hr, trailsOpen, trailsTotal, liftsOpen, liftsTotal } = input;

  const hasGoodSnow = snowfall24hr !== null && snowfall24hr >= 2;
  const hasDecentSnow = snowfall24hr !== null && snowfall24hr >= 0.5;

  const trailsPercent = (trailsOpen / trailsTotal) * 100;
  const liftsPercent = (liftsOpen / liftsTotal) * 100;
  const operationsPercent = Math.min(trailsPercent, liftsPercent);

  const goodOperations = operationsPercent >= 70;
  const decentOperations = operationsPercent >= 40;

  if (hasGoodSnow && goodOperations) return 'green';
  if (hasDecentSnow && decentOperations) return 'yellow';
  if (decentOperations) return 'yellow';
  return 'red';
}

export const SKI_COLORS = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
} as const;
```

**Step 4: Run test to verify it passes**

```bash
npm test skiColors.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/__tests__/skiColors.test.ts src/utils/skiColors.ts
git commit -m "feat(frontend): add ski resort color utility with tests"
```

---

### Task 10: Create Ski API Service

**Files:**
- Create: `src/services/skiApi.ts`
- Reference: `src/services/graphqlClient.ts`

**Step 1: Write GraphQL query**

```typescript
import { gql } from 'graphql-request';
import { graphqlClient } from './graphqlClient';

const SKI_RESORTS_QUERY = gql`
  query GetSkiResorts {
    skiResorts {
      id
      name
      latitude
      longitude
      logoUrl
      snowfall24hr
      snowfallCumulative
      liftsOpen
      liftsTotal
      trailsOpen
      trailsTotal
      tempCurrent
      tempHigh
      tempLow
      baseDepth
      lastUpdated
      status
      color
    }
  }
`;

export interface SkiResort {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  logoUrl: string | null;
  snowfall24hr: number | null;
  snowfallCumulative: number | null;
  liftsOpen: number;
  liftsTotal: number;
  trailsOpen: number;
  trailsTotal: number;
  tempCurrent: number | null;
  tempHigh: number | null;
  tempLow: number | null;
  baseDepth: number | null;
  lastUpdated: string;
  status: string;
  color: string;
}

interface SkiResortsResponse {
  skiResorts: SkiResort[];
}

export async function fetchSkiResorts(): Promise<SkiResort[]> {
  try {
    const data = await graphqlClient.request<SkiResortsResponse>(SKI_RESORTS_QUERY);
    return data.skiResorts;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Failed to fetch ski resorts:', error);
    }
    throw new Error('Failed to fetch ski resort data');
  }
}
```

**Step 2: Commit**

```bash
git add src/services/skiApi.ts
git commit -m "feat(frontend): add ski resorts GraphQL service"
```

---

### Task 11: Create SkiLayer Component

**Files:**
- Create: `src/components/SkiLayer.tsx`
- Create: `src/components/SkiLayer.css`
- Reference: `src/components/WeatherStationsLayer.tsx` (marker pattern)
- Reference: `src/components/TravelLayer.css` (popup styling)

**Step 1: Create component file**

```typescript
import { useState, useEffect, useRef, memo } from 'react';
import maplibregl from 'maplibre-gl';
import { fetchSkiResorts } from '../services/skiApi';
import type { SkiResort } from '../services/skiApi';
import { SKI_COLORS } from '../utils/skiColors';
import { INTERVALS } from '../utils/constants';
import type { MapLibreMap, Marker } from '../types';
import './SkiLayer.css';

interface MarkerEntry {
  marker: Marker;
  element: HTMLDivElement;
  handler: (e: MouseEvent) => void;
}

interface SkiLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
}

// Lucide Mountain icon SVG
const MOUNTAIN_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
       viewBox="0 0 24 24" fill="none" stroke="white"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
  </svg>
`;

function createSkiResortMarker(resort: SkiResort): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'ski-resort-marker';

  const color = SKI_COLORS[resort.color as keyof typeof SKI_COLORS] || SKI_COLORS.yellow;

  el.style.cssText = `
    width: 32px;
    height: 32px;
    background: ${color};
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: box-shadow 0.2s ease, border-width 0.2s ease;
  `;

  el.innerHTML = MOUNTAIN_ICON;

  // Hover glow effect
  el.addEventListener('mouseenter', () => {
    el.style.boxShadow = `0 0 12px ${color}, 0 2px 8px rgba(0, 0, 0, 0.3)`;
    el.style.borderWidth = '3px';
  });

  el.addEventListener('mouseleave', () => {
    el.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.25)';
    el.style.borderWidth = '2px';
  });

  return el;
}

function createPopupHTML(resort: SkiResort): string {
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return `
    <div class="ski-popup-content">
      ${resort.logoUrl ? `<img src="${resort.logoUrl}" alt="${resort.name}" class="resort-logo" />` : ''}
      <h3>${resort.name}</h3>
      <div class="stats-grid">
        <div>❄️ Fresh: ${resort.snowfall24hr !== null ? `${resort.snowfall24hr}"` : 'N/A'}</div>
        <div>🎿 Trails: ${resort.trailsOpen}/${resort.trailsTotal}</div>
        <div>🚡 Lifts: ${resort.liftsOpen}/${resort.liftsTotal}</div>
        <div>🌡️ Temp: ${resort.tempCurrent !== null ? `${resort.tempCurrent}°F` : 'N/A'}</div>
        <div>📊 Base: ${resort.baseDepth !== null ? `${resort.baseDepth}"` : 'N/A'}</div>
        <div>📈 Total: ${resort.snowfallCumulative !== null ? `${resort.snowfallCumulative}"` : 'N/A'}</div>
      </div>
      <div class="last-updated">Updated: ${formatTime(resort.lastUpdated)}</div>
    </div>
  `;
}

function SkiLayer({ map, visible }: SkiLayerProps) {
  const [resorts, setResorts] = useState<SkiResort[]>([]);
  const [_loading, setLoading] = useState(false);
  const markersRef = useRef<MarkerEntry[]>([]);

  // Fetch resorts on mount and every 6 hours
  useEffect(() => {
    if (!map) return;

    const fetchResorts = async (): Promise<void> => {
      if (!map) return;

      setLoading(true);
      try {
        const data = await fetchSkiResorts();
        setResorts(data);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error fetching ski resorts:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchResorts();
    const interval = setInterval(fetchResorts, 6 * 60 * 60 * 1000); // 6 hours
    return () => clearInterval(interval);
  }, [map]);

  // Add markers to map when resorts change
  useEffect(() => {
    if (!map || !visible) {
      // Clear existing markers
      markersRef.current.forEach(({ marker, element, handler }) => {
        if (element && handler) {
          element.removeEventListener('click', handler as EventListener);
        }
        marker.remove();
      });
      markersRef.current = [];
      return;
    }

    // Remove old markers
    markersRef.current.forEach(({ marker, element, handler }) => {
      if (element && handler) {
        element.removeEventListener('click', handler as EventListener);
      }
      marker.remove();
    });
    markersRef.current = [];

    // Add new markers for resorts
    resorts.forEach((resort) => {
      const el = createSkiResortMarker(resort);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([resort.longitude, resort.latitude])
        .addTo(map);

      // Click handler opens popup
      const handleMarkerClick = (e: MouseEvent): void => {
        e.stopPropagation();

        const popup = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: false,
          className: 'ski-popup',
          maxWidth: '320px',
        })
          .setLngLat([resort.longitude, resort.latitude])
          .setHTML(createPopupHTML(resort))
          .addTo(map);

        // Handle logo load errors
        const popupElement = popup.getElement();
        const logoImg = popupElement?.querySelector('.resort-logo') as HTMLImageElement;
        if (logoImg) {
          logoImg.addEventListener('error', () => {
            logoImg.style.display = 'none';
          });
        }
      };

      el.addEventListener('click', handleMarkerClick as EventListener);

      markersRef.current.push({
        marker: marker as Marker,
        element: el,
        handler: handleMarkerClick,
      });
    });

    // Cleanup
    return () => {
      markersRef.current.forEach(({ marker, element, handler }) => {
        if (element && handler) {
          element.removeEventListener('click', handler as EventListener);
        }
        marker.remove();
      });
      markersRef.current = [];
    };
  }, [map, visible, resorts]);

  // No UI panel - markers only
  return null;
}

export default memo(SkiLayer);
```

**Step 2: Create CSS file**

Create: `src/components/SkiLayer.css`

```css
/* Ski Layer Styles - follows TravelLayer.css pattern */

.ski-resort-marker {
  /* Styles are applied inline in JavaScript */
}

/* Popup styles */
.ski-popup .maplibregl-popup-content {
  padding: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 12px !important;
}

.ski-popup .maplibregl-popup-tip {
  border-top-color: rgba(23, 23, 23, 0.95) !important;
}

:not(.dark) .ski-popup .maplibregl-popup-tip {
  border-top-color: rgba(255, 255, 255, 0.98) !important;
}

.ski-popup .maplibregl-popup-close-button {
  color: var(--color-text-secondary);
  font-size: 20px;
  padding: 4px 8px;
  right: 8px;
  top: 8px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.ski-popup .maplibregl-popup-close-button:hover {
  background: transparent;
  opacity: 1;
  color: var(--color-text-primary-alt);
}

/* Popup content */
.ski-popup-content {
  background: var(--color-bg-surface);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  min-width: 280px;
  max-width: 320px;
}

.ski-popup-content h3 {
  margin: 0 0 var(--space-3) 0;
  color: var(--color-text-primary-alt);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  text-align: center;
}

.resort-logo {
  width: 80px;
  height: 60px;
  object-fit: contain;
  margin: 0 auto var(--space-3);
  display: block;
  background: transparent;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  margin-top: var(--space-3);
}

.stats-grid div {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.last-updated {
  margin-top: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border-divider);
  text-align: center;
  font-size: var(--font-size-sm);
  font-style: italic;
  color: var(--color-text-tertiary);
}
```

**Step 3: Commit**

```bash
git add src/components/SkiLayer.tsx src/components/SkiLayer.css
git commit -m "feat(frontend): add SkiLayer component with markers and popups"
```

---

## Phase 4: Integration with Main Map

### Task 12: Add SkiLayer to WeatherMap

**Files:**
- Modify: `src/WeatherMap.tsx`

**Step 1: Import and add component**

In `src/WeatherMap.tsx`:

```typescript
// Add import at top
import SkiLayer from './components/SkiLayer';

// In component, add state for visibility
const [showSkiResorts, setShowSkiResorts] = useState(true);

// Add layer component in JSX (after other layers)
<SkiLayer map={map.current} visible={showSkiResorts} />
```

**Step 2: Add toggle control**

Add toggle button in control panel (follow pattern from other toggles):

```typescript
<button
  onClick={() => setShowSkiResorts(!showSkiResorts)}
  className={`toggle-button ${showSkiResorts ? 'active' : ''}`}
  aria-label="Toggle ski resorts"
>
  ⛷️ Ski Resorts
</button>
```

**Step 3: Test locally**

```bash
npm run dev
```

Verify:
- Ski resort markers appear on map
- Clicking marker shows popup
- Toggle button shows/hides markers
- Light/dark mode works

**Step 4: Commit**

```bash
git add src/WeatherMap.tsx
git commit -m "feat(frontend): integrate SkiLayer into main map"
```

---

## Phase 5: Testing & Documentation

### Task 13: Manual Testing Checklist

**Test in browser (both light and dark mode):**

- [ ] Backend health check: `curl http://localhost:4000/health`
- [ ] GraphQL query works: Test in GraphiQL or curl
- [ ] Markers render at correct coordinates
- [ ] Marker colors match conditions (green/yellow/red)
- [ ] Hover effect works (glow + border)
- [ ] Click opens popup with correct data
- [ ] Logo loads (or hides gracefully on error)
- [ ] Popup styling matches TravelLayer style
- [ ] Toggle button shows/hides markers
- [ ] Mobile responsive (markers clickable, popup readable)

**Step 1: Run all tests**

```bash
npm test
cd backend && npm test
```

Expected: All tests pass

**Step 2: Build for production**

```bash
npm run build
```

Expected: No errors, `dist/` folder created

---

### Task 14: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Step 1: Update README.md**

Add to features section:

```markdown
- ⛷️ Live ski resort conditions with color-coded markers
```

**Step 2: Update CLAUDE.md**

Add to Data Sources table:

```markdown
| **Ski Vermont** | Resort conditions | 6 hr | Twice daily | `https://skivermont.com/conditions` |
```

Add to Common Development Tasks:

```markdown
### 7. Ski Conditions Layer

**Location:** `src/components/SkiLayer.tsx`
**Backend:** `backend/src/services/skiConditions.ts`
**Update frequency:** Twice daily via GitHub Actions (6 AM & 2 PM ET)
**Color coding:** Green (powder + operations), Yellow (decent), Red (limited)
```

**Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: add ski resort conditions feature documentation"
```

---

## Final Steps

### Task 15: Create Pull Request

**Step 1: Push branch**

```bash
git push -u origin vtl-42-add-ski-resort-conditions-layer-to-map
```

**Step 2: Create PR**

```bash
gh pr create --title "feat: add ski resort conditions layer" --body "Closes VTL-42

## Summary
Adds real-time ski resort conditions to the map with color-coded markers and detailed popups.

### Features
- ⛷️ 20+ Vermont ski resorts with live conditions
- 🎨 Color-coded markers (green/yellow/red) based on snow + operations
- 📊 Detailed popups with snow depth, lifts, trails, temperature
- 🔄 Auto-refresh twice daily via GitHub Actions (6 AM & 2 PM ET)
- 🌓 Full light/dark mode support

### Implementation
- Backend: HTML scraping with Cheerio, 12-hour cache
- Frontend: MapLibre markers with Mountain icons
- CI/CD: GitHub Actions cron job

### Testing
- ✅ All unit tests passing (frontend + backend)
- ✅ Manual testing in light/dark modes
- ✅ Mobile responsive
- ✅ Production build succeeds

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Success Criteria

- [ ] Backend scraper successfully parses 15+ resorts
- [ ] GraphQL query returns resort data
- [ ] GitHub Actions cron triggers successfully
- [ ] Markers render at correct Vermont locations
- [ ] Popups show all stats (snow, lifts, trails, temp)
- [ ] Color logic correctly assigns green/yellow/red
- [ ] Light mode styling matches design
- [ ] Dark mode styling matches design
- [ ] No console errors in production build
- [ ] All tests passing (85 frontend + backend tests)
- [ ] CodeRabbit review completed

---

**Estimated Implementation Time:** 6-8 hours (assumes familiarity with codebase)

**Dependencies:**
- Backend running on port 4000
- Frontend running on port 5173
- Valid Protomaps API key in `.env`
- GitHub repository with Actions enabled
