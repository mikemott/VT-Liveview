# Lake Temperature Tracker - Design Document

**Issue:** VTL-11
**Date:** 2026-01-31
**Status:** Phase 1 MVP - Water Temperature Only

## Overview

Add real-time water temperature tracking for Vermont lakes to help residents and tourists find the best swimming conditions. This is Phase 1 (MVP) focusing on USGS water temperature data with a curated list of lakes providing comprehensive geographic coverage across Vermont.

## Scope

### In Scope (Phase 1)
- Real-time water temperature from USGS sensors
- 15-25 curated Vermont lakes (major destinations + regional coverage)
- Color-coded temperature comfort indicators (cold/comfortable/warm)
- Lake markers with temperature badges
- Popup with lake details (current temp, timestamp, comfort level)
- Backend GraphQL endpoint with LRU caching
- 15-minute auto-refresh matching USGS update frequency

### Out of Scope (Future Phases)
- Algae bloom warnings (VT DEC data)
- Beach status & closures
- Ice-out tracking (seasonal)
- Temperature history graphs
- User submissions

## Architecture

### System Flow

```
Frontend (LakeLayer.tsx)
    ↓ GraphQL query every 15 minutes
Backend GraphQL (/graphql - lakeTemperatures query)
    ↓ Fetch & transform
USGS Water Services API
    ↓ Returns temperature readings
Backend cache (LRU, 15min TTL)
    ↓ Cached lake data
Frontend renders markers with temperature badges
```

### Component Structure

**Backend Components:**
1. `backend/src/services/lakes.ts` - USGS API integration with curated lake list
2. `backend/src/schema.graphql` - GraphQL type definitions
3. `backend/src/resolvers/index.ts` - GraphQL resolver for lakeTemperatures query

**Frontend Components:**
1. `src/services/lakeApi.ts` - GraphQL query wrapper with TypeScript types
2. `src/components/LakeLayer.tsx` - Map layer component with markers
3. `src/components/LakeLayer.css` - Styling for markers and popups
4. `src/WeatherMap.tsx` - Integration point (add LakeLayer)

## Data Model

### Backend Types

```typescript
interface LakeDefinition {
  id: string;
  name: string;
  usgsGaugeId: string;
  latitude: number;
  longitude: number;
  description?: string;
}

interface LakeTemperature {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  temperatureFahrenheit: number | null;
  comfortLevel: 'cold' | 'comfortable' | 'warm';
  timestamp: string;
  usgsGaugeId: string;
}
```

### Temperature Comfort Levels

- **Cold** (< 65°F): Blue marker - too cold for most swimmers
- **Comfortable** (65-75°F): Green marker - ideal swimming temperature
- **Warm** (> 75°F): Orange marker - warm water

### Curated Lake List (15-25 lakes)

**Northern Vermont:**
- Lake Champlain (Burlington) - USGS 04294500
- Lake Memphremagog - USGS 04294413
- Lake Willoughby
- Lake Carmi

**Central Vermont:**
- Lake Dunmore
- Lake Bomoseen
- Silver Lake (Barnard)
- Harriman Reservoir

**Southern Vermont:**
- Lake Morey
- Lake Rescue
- Somerset Reservoir

*Note: USGS gauge IDs to be researched and validated during implementation*

## API Integration

### USGS Water Services API

**Endpoint:** `https://waterservices.usgs.gov/nwis/iv/`

**Parameters:**
- `sites`: Comma-separated USGS gauge IDs
- `parameterCd`: `00010` (water temperature)
- `format`: `json`
- `siteStatus`: `active`

**Example Request:**
```
https://waterservices.usgs.gov/nwis/iv/?sites=04294500&parameterCd=00010&format=json&siteStatus=active
```

**Response Structure:**
```json
{
  "value": {
    "timeSeries": [{
      "sourceInfo": {
        "siteName": "LAKE CHAMPLAIN AT BURLINGTON VT",
        "geoLocation": {
          "geogLocation": {
            "latitude": 44.47583333,
            "longitude": -73.21222222
          }
        }
      },
      "values": [{
        "value": [{
          "value": "22.1",
          "dateTime": "2026-01-31T14:00:00.000-05:00"
        }]
      }]
    }]
  }
}
```

*Note: Temperature returned in Celsius, needs conversion to Fahrenheit*

### Caching Strategy

- **Backend LRU Cache:** Max 100 entries, 15-minute TTL
- **Cache Key:** `lake-temps-all` (single cache entry for all lakes)
- **Rationale:** USGS updates every 15 minutes, batch fetch all lakes in single request
- **Pattern:** Follow ski resort caching pattern

## User Interface

### Marker Design

**Visual Appearance:**
- Circular marker (32px diameter)
- Water drop icon (Lucide Droplet icon)
- Background color by comfort level (blue/green/orange)
- White border (2px)
- Temperature badge overlay showing current temp (e.g., "72°")
- Box shadow for depth
- Hover glow effect (matches ski resort pattern)

### Popup Content

```
[Lake Icon/Name]
Lake Champlain (Burlington)

Temperature: 72°F
Comfort: Comfortable for swimming
USGS Station: 04294500

Last Updated: Jan 31, 2:00 PM
```

### Layer Controls

- Add toggle in map controls panel
- Label: "Lake Temperatures"
- Icon: Droplet icon
- Default: Visible (summer months), hidden (winter months) - TBD based on seasonal system

## Implementation Plan

### Phase 1: Backend Implementation

1. Research and validate USGS gauge IDs for curated lakes
2. Create `backend/src/services/lakes.ts`:
   - Curated lake definitions with USGS IDs
   - `fetchLakeTemperatures()` function
   - USGS API integration with error handling
   - Temperature unit conversion (C to F)
   - Comfort level calculation
   - LRU caching (15min TTL)
3. Update `backend/src/schema.graphql`:
   - Add `LakeTemperature` type
   - Add `lakeTemperatures` query
4. Update `backend/src/resolvers/index.ts`:
   - Add resolver for `lakeTemperatures`

### Phase 2: Frontend API Layer

1. Create `src/services/lakeApi.ts`:
   - TypeScript interfaces matching backend types
   - GraphQL query definition
   - `fetchLakeTemperatures()` function

### Phase 3: Frontend UI Component

1. Create `src/components/LakeLayer.tsx`:
   - MapLibre marker management
   - Temperature badge rendering
   - Color coding by comfort level
   - Popup creation with lake details
   - Auto-refresh every 15 minutes
2. Create `src/components/LakeLayer.css`:
   - Marker styling
   - Popup styling
   - Dark mode support

### Phase 4: Integration

1. Update `src/WeatherMap.tsx`:
   - Import and render LakeLayer
   - Add visibility control
   - Wire up layer toggle

### Phase 5: Testing

1. Verify USGS API integration works
2. Test marker rendering and color coding
3. Verify popups display correctly
4. Test auto-refresh behavior
5. Verify dark mode compatibility
6. Test mobile responsiveness

## Error Handling

### Backend
- Handle USGS API failures gracefully (return null temperature)
- Log errors in development only
- Return partial data if some lakes fail

### Frontend
- Show "N/A" for lakes with no temperature data
- Display friendly error message if entire query fails
- Gracefully handle missing/malformed data

## Performance Considerations

- **Batch requests:** Fetch all lakes in single USGS API call
- **Backend caching:** 15-minute TTL reduces API load
- **Frontend caching:** React Query 15-minute stale time
- **Marker optimization:** Reuse marker elements, don't recreate on updates
- **Mobile optimization:** Responsive markers, touch-friendly popups

## Success Metrics

- Users can see lake temperature in <2 clicks
- Temperature data updates every 15 minutes
- Covers 15-25 major Vermont lakes with geographic spread
- Color coding provides instant visual feedback
- Mobile-friendly markers and popups

## Future Enhancements (Phase 2+)

1. **Algae bloom warnings** - VT DEC data integration
2. **Beach status** - Public beach closures and conditions
3. **Ice-out tracking** - Seasonal spring feature
4. **Temperature history** - 7-day trend graphs
5. **Lake boundaries** - GeoJSON polygons for major lakes
6. **User submissions** - Crowdsource temps for lakes without sensors

## References

- USGS Water Services API: https://waterservices.usgs.gov/
- USGS Parameter Codes: https://help.waterdata.usgs.gov/parameter_cd
- VT Lakes Database: https://dec.vermont.gov/watershed/lakes-ponds
- Linear Issue: VTL-11
