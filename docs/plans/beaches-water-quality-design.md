# Beaches + Water Quality System - Design Document

**Date:** 2026-07-10
**Status:** ✅ IMPLEMENTED (with modifications)
**Related Issue:** PR #95

> **⚠️ IMPLEMENTATION NOTE:**
> The actual implementation differs from this design document. The final version uses:
> - **Data Source:** Burlington ArcGIS REST API (not Beach Day API)
> - **Beach Count:** 40 beaches (not 15-20)
> - **Coverage:** 10 beaches with live monitoring, 30 without data shown as "unknown"
> - **Field Names:** `burlingtonLocationId` (not `beachDayApiId`)
> - **Status Values:** `'open' | 'alert' | 'closed' | 'unknown'` (not `'open' | 'closed' | 'advisory'`)
> - **Additional Field:** `cyanobacteriaCategory` added to Beach interface
>
> **Reason:** After extensive research, Burlington's ArcGIS API is the only free, real-time REST endpoint available for Vermont beach water quality monitoring.

---

## Original Design (Reference Only)

## Overview

Add a seasonal beaches layer with real-time water quality monitoring, similar to ski resort conditions. Features color-coded markers based on water quality grades, E. coli levels, and beach advisories/closures.

## Goals

- Display 15-20 major Vermont beaches on Lake Champlain
- Real-time water quality grades (A-F) from Beach Day API
- Color-coded markers: Green (safe), Yellow (moderate), Red (unsafe/closed)
- Show E. coli levels, water temperature, and advisories
- Auto-show during swimming season (May-September)
- 12-hour cache with fallback to stale data

## Data Sources

### Primary: Beach Day API (Launched June 2026)
- **URL:** https://beachdayapi.com/
- **Coverage:** 12,000+ beaches including EPA BEACH Act sites
- **Data:** Water quality grades (A-F), water temp, E. coli levels, advisories, closures
- **Format:** REST API, JSON responses
- **Pricing:** Free tier with 50 trial credits
- **References:**
  - [Beach Day API Launch](https://www.globenewswire.com/news-release/2026/06/29/3319301/0/en/Beach-Day-API-Launches-Real-Time-Beach-and-Ocean-Data-API-for-Developers.html)
  - [API Website](https://beachdayapi.com/)

### Fallback: Vermont DEC Beach Monitoring
- **Daily monitoring:** Cyanobacteria ("blue-green algae") blooms
- **Twice weekly:** E. coli testing
- **Closure threshold:** E. coli > 235 per 100 mL
- **Data portal:** Vermont IWIS (Integrated Watershed Information System)
- **References:**
  - [VT DEC Lakes Monitoring](https://dec.vermont.gov/watershed/lakes-ponds/monitor)
  - [Burlington Beach Closures](https://www.burlingtonvt.gov/961/Water-Testing-Beach-Closures)
  - [Lake Champlain Water Quality](https://atlas.lcbp.org/issues-in-the-basin/water-quality-monitoring/)

### Beach Locations
- **Total:** 50+ public beaches on Lake Champlain
- **References:**
  - [Lake Champlain Beaches List](https://www.lakechamplainregion.com/outdoors/swimming)
  - [Vermont State Park Beaches](https://vtliving.com/beaches/)
  - [Top 62 Vermont Beaches](https://beaches.close-to-me.com/best-beaches/vermont/)

## Architecture

### 1. Beach Data (Static)

**File:** `backend/src/data/vtBeaches.json`

```json
[
  {
    "id": "north-beach-burlington",
    "name": "North Beach",
    "town": "Burlington",
    "latitude": 44.4925,
    "longitude": -73.2237,
    "parkType": "municipal",
    "amenities": ["parking", "restrooms", "concessions", "lifeguards"],
    "beachDayApiId": "vt-burlington-north-beach"
  },
  {
    "id": "sand-bar-state-park",
    "name": "Sand Bar State Park",
    "town": "Milton",
    "latitude": 44.6468,
    "longitude": -73.2856,
    "parkType": "state_park",
    "amenities": ["parking", "restrooms", "concessions", "boat_launch"],
    "beachDayApiId": "vt-milton-sand-bar"
  }
]
```

**Major Beaches to Include (15-20):**

**Burlington Area:**
- North Beach (Burlington) - 44.4925, -73.2237
- Oakledge Park Beach (Burlington) - 44.4598, -73.2314
- Leddy Park Beach (Burlington) - 44.5008, -73.2314

**State Parks:**
- Sand Bar State Park (Milton) - 44.6468, -73.2856
- Alburg Dunes State Park (Alburg) - 44.9815, -73.3018
- Grand Isle State Park (Grand Isle) - 44.7273, -73.3175
- Knight Point State Park (North Hero) - 44.8453, -73.2893
- Kill Kare State Park (St. Albans) - 44.8342, -73.2156
- Button Bay State Park (Ferrisburgh) - 44.1889, -73.3667
- Kingsland Bay State Park (Ferrisburgh) - 44.2145, -73.3512
- D.A.R. State Park (Addison) - 44.0842, -73.3289

**Island Parks:**
- Burton Island State Park (St. Albans) - 44.8245, -73.2534
- Knight Island State Park (North Hero) - 44.8567, -73.3012

**Other Public Beaches:**
- Colchester Beach (Colchester) - 44.5234, -73.2456
- Bayside Park Beach (Colchester) - 44.4978, -73.2389
- Red Rocks Park Beach (South Burlington) - 44.4456, -73.2398

### 2. Backend Service

**File:** `backend/src/services/beachWaterQuality.ts`

```typescript
import beachData from '../data/vtBeaches.json';

export interface Beach {
  id: string;
  name: string;
  town: string;
  latitude: number;
  longitude: number;
  parkType: string;
  amenities: string[];

  // Water quality data (from Beach Day API)
  waterQualityGrade: 'A' | 'B' | 'C' | 'D' | 'F' | null;
  waterTemp: number | null; // Fahrenheit
  eColiLevel: number | null; // per 100 mL
  lastTested: string | null; // ISO date
  advisory: string | null; // "Cyanobacteria bloom", "High bacteria", etc.
  status: 'open' | 'closed' | 'advisory';
  color: 'green' | 'yellow' | 'red';
  lastUpdated: string; // ISO date
}

interface BeachDayApiResponse {
  beaches: Array<{
    id: string;
    name: string;
    waterQuality: {
      grade: string;
      eColiLevel: number;
      lastTested: string;
    };
    waterTemp: number;
    advisories: string[];
    status: 'open' | 'closed';
  }>;
}

const beachCache = new Map<string, BeachCache>();
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export async function fetchBeachWaterQuality(): Promise<Beach[]> {
  // Check cache
  const cached = beachCache.get('beaches');
  if (cached) return cached.beaches;

  try {
    // Fetch from Beach Day API
    const apiKey = process.env.BEACH_DAY_API_KEY;
    if (!apiKey) {
      throw new Error('BEACH_DAY_API_KEY not configured');
    }

    const response = await fetch(
      'https://api.beachdayapi.com/v1/beaches?state=VT',
      { headers: { 'Authorization': `Bearer ${apiKey}` } }
    );

    if (!response.ok) {
      throw new Error(`Beach Day API error: ${response.status}`);
    }

    const apiData: BeachDayApiResponse = await response.json();

    // Merge with static beach data
    const beaches: Beach[] = beachData.map(staticBeach => {
      const apiBeach = apiData.beaches.find(b =>
        b.id === staticBeach.beachDayApiId
      );

      if (!apiBeach) {
        return {
          ...staticBeach,
          waterQualityGrade: null,
          waterTemp: null,
          eColiLevel: null,
          lastTested: null,
          advisory: null,
          status: 'open' as const,
          color: 'yellow' as const,
          lastUpdated: new Date().toISOString(),
        };
      }

      const color = calculateBeachColor({
        grade: apiBeach.waterQuality.grade,
        status: apiBeach.status,
        advisories: apiBeach.advisories,
      });

      return {
        ...staticBeach,
        waterQualityGrade: apiBeach.waterQuality.grade as Beach['waterQualityGrade'],
        waterTemp: apiBeach.waterTemp,
        eColiLevel: apiBeach.waterQuality.eColiLevel,
        lastTested: apiBeach.waterQuality.lastTested,
        advisory: apiBeach.advisories[0] || null,
        status: apiBeach.status === 'closed' ? 'closed' :
                apiBeach.advisories.length > 0 ? 'advisory' : 'open',
        color,
        lastUpdated: new Date().toISOString(),
      };
    });

    // Cache with 12-hour TTL
    beachCache.set('beaches', {
      beaches,
      fetchedAt: new Date().toISOString(),
    });

    return beaches;

  } catch (error) {
    console.error('Beach water quality fetch failed:', error);

    // Return stale cache if available
    const staleCache = beachCache.get('beaches');
    if (staleCache) {
      console.warn('Using stale beach water quality cache');
      return staleCache.beaches;
    }

    // Last resort: return beaches with no quality data
    return beachData.map(beach => ({
      ...beach,
      waterQualityGrade: null,
      waterTemp: null,
      eColiLevel: null,
      lastTested: null,
      advisory: null,
      status: 'open' as const,
      color: 'yellow' as const,
      lastUpdated: new Date().toISOString(),
    }));
  }
}

function calculateBeachColor(input: {
  grade: string;
  status: string;
  advisories: string[];
}): 'green' | 'yellow' | 'red' {
  const { grade, status, advisories } = input;

  // Closed beaches are red
  if (status === 'closed') return 'red';

  // Advisories are yellow
  if (advisories.length > 0) return 'yellow';

  // Grade-based coloring
  if (grade === 'A' || grade === 'B') return 'green';
  if (grade === 'C') return 'yellow';
  if (grade === 'D' || grade === 'F') return 'red';

  // Default to yellow (unknown)
  return 'yellow';
}
```

### 3. GraphQL Schema

**File:** `backend/src/schema.graphql`

```graphql
type Beach {
  id: ID!
  name: String!
  town: String!
  latitude: Float!
  longitude: Float!
  parkType: String!
  amenities: [String!]!

  # Water quality data
  waterQualityGrade: String
  waterTemp: Int
  eColiLevel: Int
  lastTested: String
  advisory: String
  status: String!
  color: String!
  lastUpdated: String!
}

extend type Query {
  beaches: [Beach!]!
}
```

**File:** `backend/src/resolvers/beach.ts`

```typescript
import { fetchBeachWaterQuality } from '../services/beachWaterQuality.js';

export const beachResolvers = {
  Query: {
    beaches: async () => {
      return await fetchBeachWaterQuality();
    },
  },
};
```

### 4. Frontend Component

**File:** `src/components/BeachLayer.tsx`

Similar structure to `SkiLayer.tsx`:
- Fetches beaches from GraphQL on mount
- Creates MapLibre markers with wave icon
- Color-coded circles (green/yellow/red)
- Hover glow effect
- Popup with water quality details
- Cleanup on unmount

**Wave Icon:**
```typescript
const WAVE_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
       viewBox="0 0 24 24" fill="none" stroke="white"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
    <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
    <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
  </svg>
`;
```

**Popup Content:**
```typescript
function createPopupHTML(beach: Beach): string {
  return `
    <div class="beach-popup">
      <h3>${beach.name}</h3>
      <p class="town">${beach.town}</p>

      <div class="water-quality">
        <span class="grade grade-${beach.waterQualityGrade?.toLowerCase()}">
          Grade: ${beach.waterQualityGrade || 'N/A'}
        </span>
        ${beach.waterTemp ? `<span>Water: ${beach.waterTemp}°F</span>` : ''}
      </div>

      ${beach.eColiLevel ? `
        <div class="ecoli">
          <strong>E. coli:</strong> ${beach.eColiLevel} per 100mL
          <span class="threshold">(Safe: < 235)</span>
        </div>
      ` : ''}

      ${beach.advisory ? `
        <div class="advisory">⚠️ ${beach.advisory}</div>
      ` : ''}

      <div class="status ${beach.status}">
        Status: ${beach.status.toUpperCase()}
      </div>

      ${beach.lastTested ? `
        <div class="last-tested">
          Last tested: ${formatDate(beach.lastTested)}
        </div>
      ` : ''}

      <div class="amenities">
        ${beach.amenities.map(a => `<span class="amenity">${a}</span>`).join('')}
      </div>
    </div>
  `;
}
```

### 5. Frontend API Client

**File:** `src/services/beachApi.ts`

```typescript
import { graphqlClient } from './graphqlClient';
import { gql } from 'graphql-request';

export interface Beach {
  id: string;
  name: string;
  town: string;
  latitude: number;
  longitude: number;
  parkType: string;
  amenities: string[];
  waterQualityGrade: string | null;
  waterTemp: number | null;
  eColiLevel: number | null;
  lastTested: string | null;
  advisory: string | null;
  status: string;
  color: string;
  lastUpdated: string;
}

const BEACHES_QUERY = gql`
  query Beaches {
    beaches {
      id
      name
      town
      latitude
      longitude
      parkType
      amenities
      waterQualityGrade
      waterTemp
      eColiLevel
      lastTested
      advisory
      status
      color
      lastUpdated
    }
  }
`;

export async function fetchBeaches(): Promise<Beach[]> {
  const data = await graphqlClient.request(BEACHES_QUERY);
  return data.beaches;
}
```

### 6. Seasonal Layer Integration

**File:** `src/config/seasonalLayers.ts`

```typescript
import { Waves } from 'lucide-react';
import BeachLayer from '../components/BeachLayer';

export const SEASONAL_LAYERS: LayerConfig[] = [
  // ... existing layers ...
  {
    id: 'beaches',
    label: 'Beaches & Water Quality',
    icon: Waves,
    season: {
      months: [5, 6, 7, 8, 9], // May-September
      label: 'Swimming Season'
    },
    component: BeachLayer
  },
];
```

## Implementation Plan

### Phase 1: Backend Data Setup
1. Create `backend/src/data/vtBeaches.json` with 15-20 major beaches
2. Manually geocode each beach using OpenStreetMap Nominatim
3. Research Beach Day API IDs for each beach (or use coordinates matching)

### Phase 2: Backend Service
1. Create `backend/src/services/beachWaterQuality.ts`
2. Implement Beach Day API integration (with API key from env)
3. Add 12-hour LRU cache
4. Implement color calculation logic
5. Add fallback to static data when API fails

### Phase 3: GraphQL Integration
1. Add Beach type to `backend/src/schema.graphql`
2. Create `backend/src/resolvers/beach.ts`
3. Register resolver in `backend/src/resolvers/index.ts`
4. Test GraphQL query

### Phase 4: Frontend Component
1. Create `src/services/beachApi.ts`
2. Create `src/components/BeachLayer.tsx`
3. Create `src/components/BeachLayer.css`
4. Add wave icon and color-coded markers
5. Implement popup with water quality details

### Phase 5: Seasonal Layer Integration
1. Add beaches to `src/config/seasonalLayers.ts`
2. Import BeachLayer in `src/WeatherMap.tsx`
3. Test seasonal visibility (May-September)

### Phase 6: Testing & Polish
1. Test Beach Day API integration (sign up for API key)
2. Verify fallback behavior when API fails
3. Test color coding logic with various water quality grades
4. Verify popup styling in light/dark modes
5. Test on mobile devices

## Environment Variables

**Backend (`backend/.env`):**
```bash
BEACH_DAY_API_KEY=your_api_key_here  # Get from https://beachdayapi.com/
```

## Files to Create

**Backend:**
- `backend/src/data/vtBeaches.json` - Static beach locations
- `backend/src/services/beachWaterQuality.ts` - Water quality service
- `backend/src/resolvers/beach.ts` - GraphQL resolver
- `backend/src/types/beach.ts` - TypeScript types

**Frontend:**
- `src/services/beachApi.ts` - Frontend API client
- `src/components/BeachLayer.tsx` - Beach layer component
- `src/components/BeachLayer.css` - Beach layer styles
- `src/utils/beachColors.ts` - Color constants

## Files to Modify

- `backend/src/schema.graphql` - Add Beach type
- `backend/src/resolvers/index.ts` - Import beach resolver
- `src/config/seasonalLayers.ts` - Add beaches layer
- `src/WeatherMap.tsx` - Import BeachLayer
- `backend/.env.example` - Add BEACH_DAY_API_KEY

## Alternative: Manual Water Quality (No API)

If Beach Day API doesn't cover Vermont beaches or is too expensive, we can:

1. **Scrape Vermont DEC data** from https://anrweb.vt.gov/DEC/_DEC/LayMonitoring.aspx
2. **Manual updates** - Check Burlington's beach closure page and update manually
3. **Community submissions** - Allow users to report conditions (future enhancement)

## Success Criteria

- [ ] 15+ Vermont beaches displayed on map
- [ ] Water quality grades shown (A-F or equivalent)
- [ ] Color-coded markers (green/yellow/red)
- [ ] Beach advisories/closures displayed
- [ ] E. coli levels shown when available
- [ ] Automatic visibility during swimming season (May-Sept)
- [ ] Mobile-responsive popups
- [ ] 12-hour cache with stale fallback
- [ ] Graceful degradation when API fails

## Data Attribution

- **Beach Day API** - Real-time water quality data
- **Vermont DEC** - Beach monitoring programs
- **EPA BEACH Act** - Water quality standards
- **OpenStreetMap Nominatim** - Beach geocoding

## Future Enhancements

- Historical water quality trends
- Cyanobacteria bloom alerts
- Beach crowding indicators
- Parking availability
- Lifeguard hours
- Beach webcams integration
- User-submitted beach photos
- Push notifications for beach closures
