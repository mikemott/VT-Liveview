# VTL-19: Traffic Flow API Research

## Executive Summary

**Recommendation: TomTom Traffic Flow API**

TomTom offers the best combination of generous free tier, vector tile support (works with MapLibre), and straightforward integration. The free tier of 50,000 daily tile requests is more than sufficient for a Vermont-focused app.

---

## API Comparison

| Provider | Free Tier | Format | MapLibre Compatible | Vermont Coverage |
|----------|-----------|--------|---------------------|------------------|
| **TomTom** | 50,000 tiles/day | Vector (PBF) | Yes (native) | Good on interstates |
| **HERE** | 5,000 tx/month (250K general) | Raster PNG | Yes (tile layer) | Good on interstates |
| **Mapbox** | Requires sales contact | Vector | Native (but we use MapLibre) | Unknown |
| **VTrans** | Free | N/A | N/A | No real-time flow API |

---

## Detailed Analysis

### 1. TomTom Traffic Flow API

**Pricing:**
- Free tier: 50,000 tile requests/day + 2,500 non-tile requests/day
- Overage: $0.08 per 1,000 tiles
- No credit card required to start

**Technical Details:**
- Vector tiles in Protocol Buffer format (PBF)
- Endpoint: `https://api.tomtom.com/traffic/map/4/tile/flow/{type}/{z}/{x}/{y}.pbf?key={API_KEY}`
- Updates every ~5 minutes
- Zoom levels 0-22 supported

**Traffic Properties Available:**
- `traffic_level`: Speed (absolute kph or relative 0.0-1.0)
- `road_type`: Motorway, Major road, Secondary road, etc.
- `road_closure`: Boolean for closed roads
- `traffic_road_coverage`: one_side or full coverage

**Pros:**
- Generous free tier (50K/day = ~1.5M/month)
- Vector tiles work natively with MapLibre
- Good documentation
- Can style based on speed/congestion values

**Cons:**
- Rural Vermont coverage may be sparse
- Requires Protocol Buffer parsing

**Sources:**
- [TomTom Pricing](https://developer.tomtom.com/pricing)
- [Vector Flow Tiles API](https://developer.tomtom.com/traffic-api/documentation/traffic-flow/vector-flow-tiles)

---

### 2. HERE Traffic API

**Pricing:**
- Traffic API: First 5,000 transactions free, then $2.50/1K
- General platform: 250,000 transactions/month free
- No payment info required to start

**Technical Details:**
- Raster tiles (PNG) - 256x256 pixels
- Endpoint: `https://[1..4].traffic.maps.ls.hereapi.com/traffic/6.0/tiles/{z}/{x}/{y}/256/png32?apiKey={API_KEY}`
- Updates every 1-5 minutes
- Color-coded: Green (free flow), Orange (moderate), Red (congested), Black (blocked)

**Pros:**
- Simple raster overlay - no parsing needed
- Pre-styled with standard traffic colors
- JamFactor metric (0-10 scale)

**Cons:**
- Lower free tier than TomTom
- Raster tiles less flexible for custom styling
- Must use their color scheme

**Sources:**
- [HERE Pricing](https://www.here.com/get-started/pricing)
- [Traffic Flow Tile Overlays](https://www.here.com/docs/bundle/traffic-api-developer-guide-v6/page/topics/example-traffic-flow-tile-overlays.html)

---

### 3. Mapbox Traffic

**Pricing:**
- Requires contacting Mapbox Sales
- Traffic data is NOT included in standard free tier
- Pricing is custom/negotiated

**Technical Details:**
- Vector tileset: `mapbox-traffic-v1`
- Updates every ~8 minutes
- Integrates with Mapbox GL JS

**Pros:**
- High-quality data
- Native integration with Mapbox ecosystem

**Cons:**
- We use MapLibre, not Mapbox GL JS (licensing)
- No public pricing - must contact sales
- Likely expensive for commercial use

**Sources:**
- [Mapbox Pricing](https://www.mapbox.com/pricing)
- [Mapbox Traffic v1 Tileset](https://docs.mapbox.com/data/tilesets/reference/mapbox-traffic-v1/)

---

### 4. VTrans / New England 511

**Findings:**
- **No real-time traffic flow API available**
- VTrans has traffic count data (historical, not real-time)
- New England 511 shows incidents but not flow
- Waze partnership provides incident data, not speed/flow
- RWIS stations provide weather, not traffic speed

**What's Available:**
- Traffic Data Management System (historical counts)
- Road Weather Information Stations (RWIS)
- Incident data via 511 (we already use this)

**Sources:**
- [VTrans Traffic Data](https://vtrans.vermont.gov/operations/OSB/data/traffic)
- [New England 511](https://newengland511.org/)

---

## Vermont Coverage Concerns

All traffic flow APIs rely on **crowdsourced GPS data** from:
- Navigation apps (Waze, Google Maps, TomTom, HERE)
- Connected vehicles
- Fleet management systems

**Coverage Quality by Road Type:**

| Road Type | Expected Coverage | Notes |
|-----------|-------------------|-------|
| I-89 | Good | Major corridor, high traffic |
| I-91 | Good | Major corridor, high traffic |
| US-7 | Moderate | Depends on segment |
| US-2 | Moderate | Burlington area good, rural sparse |
| VT Routes | Poor to None | Low sample size |
| Local Roads | None | Insufficient data |

**Key Insight:** Traffic flow data quality is directly proportional to traffic volume. Rural Vermont roads may show no data or stale data due to insufficient probe vehicles.

**Mitigation Strategy:**
- Limit traffic flow layer to interstates (I-89, I-91) initially
- Add US routes only if data quality is acceptable
- Show "no data available" gracefully for uncovered segments

---

## Cost Estimation

**Assumptions:**
- 100 daily active users
- Each user loads map 3x/day
- 20 tiles per map load (viewport coverage)
- Total: 100 × 3 × 20 = 6,000 tiles/day

**TomTom:**
- Free tier: 50,000 tiles/day
- Our usage: ~6,000 tiles/day
- **Cost: $0/month** (well within free tier)

**HERE:**
- Free tier: 5,000 transactions/month (traffic-specific)
- Our usage: ~180,000 tiles/month
- **Cost: ~$437/month** (175K × $2.50/1K)

**Verdict:** TomTom's free tier is 10x more generous and sufficient for our needs.

---

## Implementation Plan

### Phase 1: TomTom Prototype (Recommended)

1. **Sign up for TomTom Developer account**
   - https://developer.tomtom.com/
   - Get API key (instant, no credit card)

2. **Add vector tile source to MapLibre**
   ```javascript
   map.addSource('traffic-flow', {
     type: 'vector',
     tiles: [
       'https://api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.pbf?key=YOUR_KEY'
     ],
     minzoom: 6,
     maxzoom: 18
   });
   ```

3. **Add traffic flow layer**
   ```javascript
   map.addLayer({
     id: 'traffic-flow-line',
     type: 'line',
     source: 'traffic-flow',
     'source-layer': 'Traffic flow',
     paint: {
       'line-color': [
         'interpolate',
         ['linear'],
         ['get', 'traffic_level'],
         0, '#ff0000',    // Stopped
         0.25, '#ff6600', // Heavy
         0.5, '#ffcc00',  // Moderate
         0.75, '#99cc00', // Light
         1, '#00cc00'     // Free flow
       ],
       'line-width': 3
     },
     filter: ['in', 'road_type', 'Motorway', 'International road', 'Major road']
   });
   ```

4. **Add toggle control** (similar to radar layer)

5. **Test Vermont coverage**
   - Verify I-89, I-91 data quality
   - Check US-7, US-2 coverage
   - Document gaps

### Phase 2: Production Polish

- Add loading states
- Handle API errors gracefully
- Add "last updated" timestamp
- Consider caching strategy (but traffic data shouldn't be cached long)

---

## Decision Matrix

| Criteria | TomTom | HERE | Mapbox | VTrans |
|----------|--------|------|--------|--------|
| Free tier sufficient | 10 | 3 | ? | N/A |
| MapLibre compatible | 9 | 7 | 5 | N/A |
| Vermont coverage | 7 | 7 | 7 | 0 |
| Ease of integration | 8 | 7 | 4 | N/A |
| Documentation | 9 | 8 | 9 | N/A |
| **Total** | **43** | **32** | **25** | **0** |

---

## Recommendation

**Go with TomTom Traffic Flow API**

- Free tier is sufficient (50K tiles/day vs our ~6K)
- Vector tiles work natively with MapLibre
- Good documentation and developer experience
- Can filter to show only major roads (interstates)
- Low risk - can prototype quickly and validate Vermont coverage

**Next Step:** Create TomTom developer account and build prototype focusing on I-89/I-91 corridors.

---

## References

- [TomTom Developer Portal](https://developer.tomtom.com/)
- [TomTom Pricing](https://developer.tomtom.com/pricing)
- [TomTom Vector Flow Tiles](https://developer.tomtom.com/traffic-api/documentation/traffic-flow/vector-flow-tiles)
- [HERE Pricing](https://www.here.com/get-started/pricing)
- [HERE Traffic API](https://developer.here.com/documentation/traffic/dev_guide/topics/what-is.html)
- [Mapbox Traffic Tiles](https://docs.mapbox.com/data/tilesets/reference/mapbox-traffic-v1/)
- [VTrans Traffic Data](https://vtrans.vermont.gov/operations/OSB/data/traffic)
- [FHWA Crowdsourcing for Operations](https://www.fhwa.dot.gov/innovation/everydaycounts/edc_5/docs/crowdsourcing-factsheet.pdf)
