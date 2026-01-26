# Ski Conditions Layer Design
**Date:** 2026-01-25
**Feature:** Real-time ski resort conditions on VT-LiveView map

## Overview

Add a new map layer displaying live ski conditions for 20+ Vermont ski resorts, scraped from skivermont.com twice daily. Users get a quick visual overview via color-coded markers and detailed stats in popups.

## User Experience

**Quick Glance (Map Markers):**
- Circular markers with Mountain icon (follows WeatherStationsLayer pattern)
- Color-coded by combined metric (snow + operations):
  - **Green**: Fresh powder (≥2") + great operations (≥70% open) - "Go now!"
  - **Yellow**: Decent conditions (≥0.5" snow OR ≥40% open) - "Check details"
  - **Red**: Limited or closed - "Poor conditions"

**Detailed View (Popups):**
Click marker to see:
- Resort logo
- Fresh snow (24-hour)
- Trails open/total
- Lifts open/total
- Current temperature
- Base depth
- Last updated timestamp

**Popup styling matches existing incident popups** (construction, closure, flooding) with light/dark mode support.

---

## Architecture & Data Flow

```
GitHub Actions (6 AM & 2 PM ET)
  ↓ POST request
Backend /api/ski-conditions/refresh
  ↓ Fetch HTML
skivermont.com/conditions
  ↓ Parse with Cheerio
Backend Memory Cache (12-hour TTL)
  ↓ GraphQL query
Frontend (React Query, 6-hour cache)
  ↓ Display
MapLibre markers + popups
```

### Why GitHub Actions Cron?
- Fly.io auto-stop/start machines would break internal setInterval
- GitHub Actions cron is reliable and free
- Works even when backend is scaled down
- Easy manual testing with `workflow_dispatch`

---

## Data Structure

### GraphQL Schema
```graphql
type SkiResort {
  id: ID!
  name: String!
  latitude: Float!
  longitude: Float!
  logoUrl: String
  snowfall24hr: Float      # inches, null if not reported
  snowfallCumulative: Float
  liftsOpen: Int!
  liftsTotal: Int!
  trailsOpen: Int!
  trailsTotal: Int!
  tempCurrent: Int         # Fahrenheit, null if not reported
  tempHigh: Int
  tempLow: Int
  baseDepth: Int           # inches, null if not reported
  lastUpdated: String!     # ISO timestamp from page
  status: String!          # "open", "partial", "closed"
  color: String!           # "green", "yellow", "red" (computed)
}

type Query {
  skiResorts: [SkiResort!]!
}
```

### Hardcoded Lookup Tables

**Coordinates** (skivermont.com doesn't provide lat/lon):
```javascript
const RESORT_COORDS = {
  'Bolton Valley': { lat: 44.4064, lon: -72.8725 },
  'Killington': { lat: 43.6046, lon: -72.8197 },
  'Stowe': { lat: 44.5303, lon: -72.7817 },
  // ... 17 more resorts (manual curation)
};
```

**Logos** (manually curated from resort websites):
```javascript
const RESORT_LOGOS = {
  'Bolton Valley': 'https://boltonvalley.com/logo.png',
  'Killington': 'https://killington.com/logo.png',
  'Stowe': 'https://stowe.com/logo.png',
  // ... 17 more resorts (one-time effort, ~30 minutes)
};
```

---

## Color-Coding Logic (Tiered Priority)

**Implementation in `src/utils/skiColors.js`:**

```javascript
export function calculateResortColor(resort) {
  const { snowfall24hr, trailsOpen, trailsTotal, liftsOpen, liftsTotal } = resort;

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
  if (hasGoodSnow && goodOperations) return 'green';   // Best conditions
  if (hasDecentSnow && decentOperations) return 'yellow'; // Decent
  if (decentOperations) return 'yellow';  // Open but no snow
  return 'red';  // Poor or closed
}

export const SKI_COLORS = {
  green: '#22c55e',   // Fresh powder + great operations
  yellow: '#eab308',  // Moderate conditions
  red: '#ef4444',     // Limited or closed
};
```

**Why this logic?**
- Intuitive: Powder + operations = green
- Handles edge cases: Fully open but no snow = yellow (not green)
- Easy to explain in UI tooltips

---

## Backend Implementation

### New File: `backend/src/services/skiConditions.js`

**Key features:**
- Cheerio HTML parsing (already used for VT 511 XML)
- LRU cache with 12-hour TTL (follows `noaa.js` pattern)
- Graceful degradation (returns stale cache on scrape failure)
- Sentry error tracking (if configured)

**Scraping Strategy:**
```javascript
export async function fetchSkiConditions() {
  try {
    const response = await fetch('https://skivermont.com/conditions');
    const html = await response.text();
    const $ = cheerio.load(html);

    const resorts = [];

    $('.resort-card').each((i, elem) => {
      const name = $(elem).find('.resort-name').text().trim();

      // Parse snowfall "2 - 1" => 2" in 24hr
      const snowfallText = $(elem).find('.snowfall').text();
      const snowMatch = snowfallText.match(/(\d+)\s*-/);
      const snowfall24hr = snowMatch ? parseFloat(snowMatch[1]) : null;

      // Parse lifts "14/20"
      const liftsText = $(elem).find('.lifts').text();
      const liftsMatch = liftsText.match(/(\d+)\/(\d+)/);

      // ... parse trails, temps, etc.

      resorts.push({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        ...RESORT_COORDS[name],
        logoUrl: RESORT_LOGOS[name],
        snowfall24hr,
        // ... other fields
        color: calculateResortColor(data),
        lastUpdated: new Date().toISOString()
      });
    });

    // Validate: should have at least 15 resorts
    if (resorts.length < 15) {
      throw new Error('HTML structure may have changed');
    }

    // Cache with 12-hour TTL
    skiConditionsCache.set('resorts', resorts);
    return resorts;

  } catch (error) {
    // Log to Sentry if configured
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(error);
    }

    // Return stale cache if available
    if (skiConditionsCache.has('resorts')) {
      return skiConditionsCache.get('resorts');
    }

    // Last resort: empty array
    return [];
  }
}
```

### New Endpoint: `/api/ski-conditions/refresh`

```javascript
// In backend/src/server.js
fastify.post('/api/ski-conditions/refresh', async (request, reply) => {
  try {
    await fetchSkiConditions(); // Force refresh
    return { success: true, updated: new Date().toISOString() };
  } catch (error) {
    reply.code(500);
    return { success: false, error: error.message };
  }
});
```

### GraphQL Resolver

```javascript
// In backend/src/resolvers/skiConditions.js
export const skiResolvers = {
  Query: {
    skiResorts: async () => {
      return await fetchSkiConditions();
    }
  }
};
```

---

## Frontend Implementation

### New Component: `src/components/SkiLayer.jsx`

**Follows WeatherStationsLayer pattern:**
- Custom DOM markers (not GeoJSON symbols)
- MapLibre Marker API for precise control
- Hover effects on markers
- Click handlers for popups

**Marker Creation:**
```javascript
function createSkiResortMarker(resort) {
  const el = document.createElement('div');
  el.className = 'ski-resort-marker';

  const bgColor = resort.color === 'green' ? '#22c55e' :
                  resort.color === 'yellow' ? '#eab308' : '#ef4444';

  el.style.cssText = `
    width: 32px;
    height: 32px;
    background: ${bgColor};
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: box-shadow 0.2s ease, border-width 0.2s ease;
  `;

  // Embed Lucide Mountain icon SVG
  el.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
         viewBox="0 0 24 24" fill="none" stroke="white"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
    </svg>
  `;

  // Hover glow effect
  el.addEventListener('mouseenter', () => {
    el.style.boxShadow = `0 0 12px ${bgColor}, 0 2px 8px rgba(0, 0, 0, 0.3)`;
    el.style.borderWidth = '3px';
  });

  el.addEventListener('mouseleave', () => {
    el.style.boxSadow = '0 2px 6px rgba(0, 0, 0, 0.25)';
    el.style.borderWidth = '2px';
  });

  return el;
}
```

**Popup Content:**
```javascript
const popupHTML = `
  <div class="ski-popup-content">
    <img src="${resort.logoUrl}" alt="${resort.name}" class="resort-logo" />
    <h3>${resort.name}</h3>
    <div class="stats-grid">
      <div>❄️ Fresh: ${resort.snowfall24hr || 'N/A'}"</div>
      <div>🎿 Trails: ${resort.trailsOpen}/${resort.trailsTotal}</div>
      <div>🚡 Lifts: ${resort.liftsOpen}/${resort.liftsTotal}</div>
      <div>🌡️ Temp: ${resort.tempCurrent || 'N/A'}°F</div>
      <div>📊 Base: ${resort.baseDepth || 'N/A'}"</div>
    </div>
    <div class="last-updated">Updated: ${formatTime(resort.lastUpdated)}</div>
  </div>
`;
```

### New Styles: `src/components/SkiLayer.css`

**Follows TravelLayer.css pattern** for light/dark mode consistency:

```css
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

.ski-popup-content {
  background: var(--color-bg-surface);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  min-width: 280px;
}

.resort-logo {
  width: 80px;
  height: 60px;
  object-fit: contain;
  margin: 0 auto var(--space-3);
  display: block;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  margin-top: var(--space-3);
}
```

---

## GitHub Actions Cron

**New File: `.github/workflows/ski-conditions-cron.yml`**

```yaml
name: Update Ski Conditions
on:
  schedule:
    - cron: '0 11 * * *'  # 6 AM ET (11 UTC)
    - cron: '0 19 * * *'  # 2 PM ET (19 UTC)
  workflow_dispatch: # Manual trigger for testing

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger ski conditions update
        run: |
          curl -f https://vt-liveview-api.fly.dev/api/ski-conditions/refresh || exit 1

      - name: Notify on failure
        if: failure()
        run: echo "⚠️ Ski conditions update failed"
```

**Testing:**
- Use "Run workflow" button in GitHub Actions UI
- Verify backend logs show scraping attempt
- Check GraphQL query returns fresh data

---

## Error Handling & Monitoring

**Resilience Strategy:**
1. **Scraping fails** → Return stale cache (up to 12 hours old)
2. **Cache empty** → Return empty array (frontend shows "no data")
3. **Partial parse** → Validate minimum 15 resorts before caching
4. **GitHub Actions fail** → Email notification to repo owner
5. **Sentry enabled** → All exceptions logged to dashboard

**Frontend Handling:**
```javascript
const { data: resorts, error } = useQuery({
  queryKey: ['ski-conditions'],
  queryFn: fetchSkiConditions,
  staleTime: 6 * 60 * 60 * 1000, // 6 hours
  retry: 2,
});

if (error) {
  return <div className="ski-error">⚠️ Ski conditions unavailable</div>;
}
```

---

## Implementation Phases

### Phase 1: Backend Foundation (Day 1)
- [ ] Create `backend/src/services/skiConditions.js` with scraper
- [ ] Manually curate RESORT_COORDS lookup table (20 resorts)
- [ ] Manually curate RESORT_LOGOS lookup table (20 resorts)
- [ ] Add GraphQL schema updates to `backend/src/schema.graphql`
- [ ] Add resolver in `backend/src/resolvers/skiConditions.js`
- [ ] Add `/api/ski-conditions/refresh` endpoint to server.js
- [ ] Test scraping locally with `curl`

### Phase 2: GitHub Actions Cron (Day 1)
- [ ] Create `.github/workflows/ski-conditions-cron.yml`
- [ ] Test with `workflow_dispatch` manual trigger
- [ ] Verify cache updates at 6 AM and 2 PM ET
- [ ] Confirm email notifications on failure

### Phase 3: Frontend Layer (Day 2)
- [ ] Create `src/components/SkiLayer.jsx`
- [ ] Create `src/components/SkiLayer.css`
- [ ] Create `src/utils/skiColors.js` (color-coding logic)
- [ ] Add Mountain icon markers (inline SVG)
- [ ] Add popups with resort logos and stats
- [ ] Test light/dark mode styling

### Phase 4: Integration (Day 2)
- [ ] Add SkiLayer to `WeatherMap.tsx` (import and render)
- [ ] Add toggle control in filter panel
- [ ] Add filter chip for ski resorts (follows TravelLayer pattern)
- [ ] Test visibility toggle, marker clicks, popups
- [ ] Verify no performance issues with 20 markers

### Phase 5: Polish & Launch (Day 3)
- [ ] Verify all 20 resort logos display correctly
- [ ] Test color-coding logic with various snow conditions
- [ ] Mobile responsiveness check (popups, marker size)
- [ ] Update README.md with ski conditions feature
- [ ] Create Linear issue for tracking
- [ ] Create PR with `Closes VTL-XXX`
- [ ] Deploy to production via Cloudflare Pages

**Estimated Total Time:** 2-3 days of development

---

## Testing Checklist

- [ ] Scraper successfully parses 20+ resorts
- [ ] Color logic correctly assigns green/yellow/red
- [ ] Markers render at correct coordinates
- [ ] Popups show all stats (snow, lifts, trails, temp)
- [ ] Resort logos load (no broken images)
- [ ] Light mode popup styling matches design
- [ ] Dark mode popup styling matches design
- [ ] GitHub Actions cron triggers at 6 AM and 2 PM ET
- [ ] Cache serves stale data on scrape failure
- [ ] Empty state handles gracefully (no resorts)
- [ ] Mobile: markers clickable, popups readable
- [ ] No console errors in production build

---

## Future Enhancements (Out of Scope)

- Nordic/cross-country ski areas (22 listed on skivermont.com)
- Terrain park status indicators
- Webcam links in popups
- Historical snow tracking (graphs)
- Push notifications for powder alerts
- User favorites (localStorage)

---

## Risk Assessment

**Low Risk:**
- Backend cache pattern proven (already used in noaa.js)
- Frontend layer pattern proven (already used in TravelLayer)
- GitHub Actions cron widely used

**Medium Risk:**
- HTML scraping fragile if skivermont.com redesigns
  - **Mitigation:** Validate minimum resorts, return stale cache, Sentry alerts
- Logo URLs may break if resorts change websites
  - **Mitigation:** Fallback to default Mountain icon if logo fails to load

**High Risk:**
- None identified

---

## Open Questions

- ✅ **Resolved:** Use GitHub Actions cron instead of setInterval
- ✅ **Resolved:** Use Mountain icon for markers
- ✅ **Resolved:** Follow TravelLayer popup styling exactly
- ✅ **Resolved:** Manual logo curation (one-time ~30 min effort)

---

## Success Metrics

- All 20 Vermont alpine resorts display on map
- Color-coding accurately reflects conditions
- Data updates twice daily without manual intervention
- Zero production errors in first week
- Positive user feedback (if tracked)

---

**Design approved:** 2026-01-25
**Ready for implementation:** Yes
