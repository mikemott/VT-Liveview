# Creemee Stands Map Feature - Design Document

**Date:** 2026-01-29
**Status:** Ready for Implementation
**Related Issue:** TBD

## Overview

Add a seasonal map layer displaying Vermont's top 50 creemee stands with automatic visibility during creemee season (April-September). This feature introduces a configuration-driven seasonal layer system that will also support future features like ski resorts, lake conditions, and fall foliage.

## Goals

- Display curated list of Vermont's best creemee stands on the map
- Implement reusable seasonal layer architecture
- Maintain clean map UX (avoid clutter from 400+ licensed stands)
- Source data from reputable Vermont food/travel sites
- Auto-show during creemee season, collapsible when out-of-season

## Data Source

**Primary:** [Find & Go Seek Creemee Stands](https://findandgoseek.net/creemee-stands)
**Enrichment:** Travel Like a Local VT, Seven Days Best Of 2024, Vermont Public

**Approach:** Curated top 50 stands with geocoded coordinates
**Geocoding:** OpenStreetMap Nominatim API (free, no key required)

## Architecture

### 1. Seasonal Layer System (New)

**Configuration Registry:**
```typescript
// src/config/seasonalLayers.ts
export interface SeasonConfig {
  months: number[];
  label: string;
}

export interface LayerConfig {
  id: string;
  label: string;
  icon: React.ComponentType;
  season?: SeasonConfig;
  component: React.ComponentType<LayerProps>;
}

export const SEASONAL_LAYERS: LayerConfig[] = [
  {
    id: 'creemeeStands',
    label: 'Creemee Stands',
    icon: IceCream,
    season: { months: [4, 5, 6, 7, 8, 9], label: 'Creemee Season' },
    component: CreemeeLayer
  },
  {
    id: 'skiResorts',
    label: 'Ski Resorts',
    icon: Mountain,
    season: { months: [11, 12, 1, 2, 3], label: 'Ski Season' },
    component: SkiLayer
  },
  // Future: lakeConditions, fallFoliage
];
```

**Seasonal Detection Hook:**
```typescript
// src/hooks/useSeasonalLayers.ts
export function useSeasonalLayers() {
  const currentMonth = new Date().getMonth() + 1;

  const isInSeason = (config: LayerConfig): boolean => {
    if (!config.season) return true;
    return config.season.months.includes(currentMonth);
  };

  const inSeason = SEASONAL_LAYERS.filter(isInSeason);
  const outOfSeason = SEASONAL_LAYERS.filter(c => !isInSeason(c));

  return { inSeason, outOfSeason, isInSeason };
}
```

**Unified Layer State:**
```typescript
// WeatherMap.tsx
const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean | null>>({
  weatherStations: true,        // Core layer
  skiResorts: null,             // null = auto (follow season)
  creemeeStands: null,          // null = auto
});

const isLayerVisible = (layerId: string): boolean => {
  const manual = layerVisibility[layerId];
  if (manual !== null) return manual;  // User override

  const config = SEASONAL_LAYERS.find(l => l.id === layerId);
  return config ? isInSeason(config) : false;
};
```

### 2. Data Layer

**Static Data File:**
```json
// backend/src/data/creemeeStands.json
[
  {
    "id": "burlington-bay-market",
    "name": "Burlington Bay Market & Cafe",
    "town": "Burlington",
    "latitude": 44.4759,
    "longitude": -73.2121,
    "description": "Maple creemee is their best seller. Battery Street near waterfront.",
    "specialties": ["Maple Creemee"],
    "featured": true
  }
]
```

**Build Script (One-time):**
```typescript
// backend/src/scripts/buildCreemeeData.ts
// Scrapes Find & Go Seek list
// Geocodes via Nominatim (1 req/sec rate limit)
// Outputs to data/creemeeStands.json
```

**Backend Service:**
```typescript
// backend/src/services/creemee.ts
import creemeeData from '../data/creemeeStands.json';

export interface CreemeeStand {
  id: string;
  name: string;
  town: string;
  latitude: number;
  longitude: number;
  description?: string;
  specialties?: string[];
  featured: boolean;
}

export async function fetchCreemeeStands(): Promise<CreemeeStand[]> {
  return creemeeData as CreemeeStand[];
}
```

**GraphQL Extension:**
```graphql
# backend/src/schema.graphql
type CreemeeStand {
  id: ID!
  name: String!
  town: String!
  latitude: Float!
  longitude: Float!
  description: String
  specialties: [String!]
  featured: Boolean!
}

extend type Query {
  creemeeStands: [CreemeeStand!]!
}
```

### 3. Frontend Component

**CreemeeLayer.tsx:**
- Fetches stands from GraphQL on mount
- Creates MapLibre markers (cream-colored circles with ice cream icon)
- Shows popups on click with stand details
- Follows SkiLayer.tsx pattern for consistency
- Cleanup on unmount

**Visual Design:**
- Marker: 32px cream/wheat circle, brown border, ice cream cone SVG
- Hover: Scale + glow effect
- Popup: Vintage topographic theme matching existing design
- Colors: Cream background (#F5DEB3), brown accent (#8B4513)

**Frontend API Client:**
```typescript
// src/services/creemeeApi.ts
export async function fetchCreemeeStands(): Promise<CreemeeStand[]> {
  const data = await graphqlClient.request(CREEMEE_STANDS_QUERY);
  return data.creemeeStands;
}
```

### 4. UI Integration

**Controls Panel Updates:**
- Remove ski toggle from TravelLayer (decouple)
- Create new `LayerControls.tsx` component
- Two sections: "In-Season" and "Show Off-Season" (expandable)
- In-season layers always visible
- Out-of-season layers hidden in dropdown

**Layout:**
```
┌─────────────────────────────────┐
│ MAP FEATURES                    │
│ ☐ Weather Stations              │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ SEASONAL FEATURES               │
│ ☐ Creemee Stands  (In Season)   │
│                                  │
│ ▶ Show Off-Season (2 layers)    │
└─────────────────────────────────┘

When expanded:
│ ▼ Show Off-Season (2 layers)    │
│   ☐ Ski Resorts  (Nov-Mar)      │
│   ☐ Fall Foliage (Sep-Oct)      │
```

## Implementation Plan

### Phase 1: Seasonal Layer System
1. Create `src/config/seasonalLayers.ts`
2. Create `src/hooks/useSeasonalLayers.ts`
3. Refactor WeatherMap.tsx layer state to unified model
4. Create `src/components/LayerControls.tsx`
5. Move ski toggle out of TravelLayer into LayerControls

### Phase 2: Data Collection
1. Write `backend/src/scripts/buildCreemeeData.ts`
2. Run script to geocode Find & Go Seek list (~50 stands)
3. Manually verify top 20 coordinates
4. Save to `backend/src/data/creemeeStands.json`

### Phase 3: Backend Integration
1. Create `backend/src/services/creemee.ts`
2. Add GraphQL schema types
3. Create resolver in `backend/src/resolvers/creemee.ts`
4. Test GraphQL query

### Phase 4: Frontend Component
1. Create `src/services/creemeeApi.ts`
2. Create `src/components/CreemeeLayer.tsx`
3. Create `src/components/CreemeeLayer.css`
4. Add CreemeeLayer to WeatherMap.tsx
5. Test marker rendering and popups

### Phase 5: Testing & Polish
1. Verify seasonal logic (change system date)
2. Test in-season/out-of-season UI transitions
3. Verify manual toggle overrides work
4. Check mobile responsiveness
5. Test popup styling in light/dark modes

## Files to Create

**Backend:**
- `backend/src/scripts/buildCreemeeData.ts`
- `backend/src/data/creemeeStands.json`
- `backend/src/services/creemee.ts`
- `backend/src/resolvers/creemee.ts`

**Frontend:**
- `src/config/seasonalLayers.ts`
- `src/hooks/useSeasonalLayers.ts`
- `src/components/LayerControls.tsx`
- `src/components/CreemeeLayer.tsx`
- `src/components/CreemeeLayer.css`
- `src/services/creemeeApi.ts`

**Documentation:**
- Update CLAUDE.md with seasonal layer system
- Add creemee data source attribution

## Files to Modify

- `src/WeatherMap.tsx` - Add CreemeeLayer, refactor layer state
- `src/components/TravelLayer.tsx` - Remove ski/weather station toggles
- `backend/src/schema.graphql` - Add CreemeeStand type
- `backend/src/resolvers/index.js` - Import creemee resolver

## Future Enhancements

- User submissions: "Suggest a creemee stand" form
- Ratings/reviews integration
- Filter by specialty (maple, vanilla, unique flavors)
- Distance sorting from user location
- "Open now" status (requires hours data)
- Vermont Maple Creemee Trail integration

## Success Criteria

- [ ] 50+ creemee stands displayed on map
- [ ] Automatically visible April-September
- [ ] Collapsible when out-of-season
- [ ] User can manually toggle on/off
- [ ] Markers styled consistently with design system
- [ ] Popups show stand details
- [ ] Mobile-responsive
- [ ] No performance impact (markers clean up properly)
- [ ] Seasonal system supports future layers (ski, lakes)

## Data Attribution

- **Find & Go Seek** - Primary curated list
- **Travel Like a Local VT** - Specialty details
- **Seven Days VT** - Community favorites
- **Vermont Public** - Featured recommendations
- **OpenStreetMap Nominatim** - Geocoding service
