# VT 511 Traffic Flow Visualization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add real-time traffic flow visualization showing red/yellow colored road segments for slow/moderate traffic using VT 511 free data feeds.

**Architecture:** Backend fetches and combines VT 511 `trafficCondData` (speed readings) with `networkData` (road geometries), filters for speeds <55 mph, and returns GeoJSON. Frontend displays as toggleable MapLibre layer with medium lines (4px) and darker outline (2px).

**Tech Stack:** Fastify (backend), MapLibre GL (rendering), React Query (caching), VT 511 XML feeds (free data source)

---

## Task 1: Add Backend Traffic Flow Service

**Files:**
- Create: `backend/src/services/trafficFlow.js`

**Step 1: Create traffic flow service skeleton**

Create `backend/src/services/trafficFlow.js`:

```javascript
/**
 * VT 511 Traffic Flow Service
 * Combines traffic condition data with network topology to generate
 * GeoJSON for real-time traffic visualization
 */

const VT_511_BASE = 'https://nec-por.ne-compass.com/NEC.XmlDataPortal/api/c2c';

// Simple cache for traffic flow data (5 minute TTL)
let cachedData = null;
let cacheTimestamp = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Parse XML string to DOM
 */
function parseXML(xmlString) {
  // Use DOMParser in Node.js context - will need to install 'xmldom' package
  const { DOMParser } = require('xmldom');
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'text/xml');
}

/**
 * Get text content from XML element
 */
function getElementText(parent, tagName) {
  try {
    if (!parent) return null;
    const elements = parent.getElementsByTagName(tagName);
    if (elements.length === 0) return null;
    return elements[0].textContent || null;
  } catch (error) {
    return null;
  }
}

/**
 * Convert microdegree coordinates to decimal degrees
 */
function microDegreesToDecimal(microDegrees) {
  try {
    const value = parseFloat(microDegrees);
    if (isNaN(value)) return 0;
    return value / 1000000;
  } catch (error) {
    return 0;
  }
}

/**
 * Determine color based on speed threshold
 * Red: 0-35 mph (slow)
 * Yellow: 35-55 mph (moderate)
 */
function getSpeedColor(speed) {
  if (speed < 35) {
    return '#dc2626'; // red-600
  } else if (speed < 55) {
    return '#f59e0b'; // amber-500
  }
  return null; // Don't show speeds >= 55
}

/**
 * Fetch and parse traffic condition data
 */
async function fetchTrafficConditions() {
  const url = `${VT_511_BASE}?networks=Vermont&dataTypes=trafficCondData`;
  const response = await fetch(url);
  const xmlText = await response.text();
  const xmlDoc = parseXML(xmlText);

  const trafficMap = new Map();
  const trafficElements = xmlDoc.getElementsByTagName('traffic');

  for (let i = 0; i < trafficElements.length; i++) {
    const element = trafficElements[i];
    const segmentId = element.getAttribute('id');
    const speedText = getElementText(element, 'speed');

    if (segmentId && speedText) {
      const speed = parseFloat(speedText);
      if (!isNaN(speed) && speed < 55) {
        trafficMap.set(segmentId, {
          speed,
          volume: getElementText(element, 'volume'),
          timestamp: getElementText(element, 'timestamp')
        });
      }
    }
  }

  return trafficMap;
}

/**
 * Fetch and parse network topology data
 */
async function fetchNetworkTopology() {
  const url = `${VT_511_BASE}?networks=Vermont&dataTypes=networkData`;
  const response = await fetch(url);
  const xmlText = await response.text();
  const xmlDoc = parseXML(xmlText);

  const networkMap = new Map();
  const linkElements = xmlDoc.getElementsByTagName('link');

  for (let i = 0; i < linkElements.length; i++) {
    const element = linkElements[i];
    const segmentId = element.getAttribute('id');

    if (!segmentId) continue;

    // Get start location
    const startLoc = element.getElementsByTagName('startLocation')[0];
    if (!startLoc) continue;

    const startLat = getElementText(startLoc, 'lat');
    const startLon = getElementText(startLoc, 'lon');

    if (!startLat || !startLon) continue;

    const coordinates = [
      [microDegreesToDecimal(startLon), microDegreesToDecimal(startLat)]
    ];

    // Get midpoints if available
    const midpointsContainer = element.getElementsByTagName('midpoints')[0];
    if (midpointsContainer) {
      const points = midpointsContainer.getElementsByTagName('point');
      const sortedPoints = Array.from(points).sort((a, b) => {
        const orderA = parseInt(getElementText(a, 'order') || '0');
        const orderB = parseInt(getElementText(b, 'order') || '0');
        return orderA - orderB;
      });

      for (let j = 0; j < sortedPoints.length; j++) {
        const point = sortedPoints[j];
        const lat = getElementText(point, 'lat');
        const lon = getElementText(point, 'lon');
        if (lat && lon) {
          coordinates.push([
            microDegreesToDecimal(lon),
            microDegreesToDecimal(lat)
          ]);
        }
      }
    }

    // Get end location
    const endLoc = element.getElementsByTagName('endLocation')[0];
    if (endLoc) {
      const endLat = getElementText(endLoc, 'lat');
      const endLon = getElementText(endLoc, 'lon');
      if (endLat && endLon) {
        coordinates.push([
          microDegreesToDecimal(endLon),
          microDegreesToDecimal(endLat)
        ]);
      }
    }

    // Get road name
    let roadName = getElementText(element, 'roadway') || 'Unknown Road';
    const city = getElementText(element, 'city');
    if (city) {
      roadName += ` in ${city}`;
    }

    networkMap.set(segmentId, {
      coordinates,
      roadName,
      speedLimit: getElementText(element, 'speedLimit')
    });
  }

  return networkMap;
}

/**
 * Combine traffic and network data into GeoJSON
 */
async function getTrafficFlowGeoJSON() {
  // Check cache
  const now = Date.now();
  if (cachedData && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedData;
  }

  // Fetch both data sources in parallel
  const [trafficMap, networkMap] = await Promise.all([
    fetchTrafficConditions(),
    fetchNetworkTopology()
  ]);

  // Combine into GeoJSON features
  const features = [];

  for (const [segmentId, trafficData] of trafficMap.entries()) {
    const networkData = networkMap.get(segmentId);

    if (!networkData || networkData.coordinates.length < 2) {
      continue;
    }

    const color = getSpeedColor(trafficData.speed);
    if (!color) continue; // Skip speeds >= 55 mph

    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: networkData.coordinates
      },
      properties: {
        segmentId,
        speed: trafficData.speed,
        volume: trafficData.volume,
        roadName: networkData.roadName,
        speedLimit: networkData.speedLimit,
        color,
        timestamp: trafficData.timestamp || new Date().toISOString()
      }
    });
  }

  const geoJSON = {
    type: 'FeatureCollection',
    features
  };

  // Update cache
  cachedData = geoJSON;
  cacheTimestamp = now;

  return geoJSON;
}

export { getTrafficFlowGeoJSON };
```

**Step 2: Install xmldom dependency**

Run: `cd backend && npm install xmldom`
Expected: Package installed successfully

**Step 3: Commit**

```bash
git add backend/src/services/trafficFlow.js backend/package.json backend/package-lock.json
git commit -m "feat(backend): add VT 511 traffic flow service with GeoJSON generation"
```

---

## Task 2: Add Backend Traffic Flow Endpoint

**Files:**
- Modify: `backend/src/server.js:69` (after closures endpoint)

**Step 1: Import traffic flow service**

Add import at top of `backend/src/server.js` after line 8:

```javascript
import { getTrafficFlowGeoJSON } from './services/trafficFlow.js';
```

**Step 2: Add traffic flow endpoint**

Add after the `/api/vt511/closures` endpoint (after line 69):

```javascript
  fastify.get('/api/vt511/traffic-flow', async (request, reply) => {
    try {
      const geoJSON = await getTrafficFlowGeoJSON();
      reply
        .header('Cache-Control', 'public, max-age=300') // 5 minute cache
        .type('application/json')
        .send(geoJSON);
    } catch (error) {
      fastify.log.error('Failed to fetch traffic flow data:', error);
      reply.code(500).send({ error: 'Failed to fetch VT 511 traffic flow data' });
    }
  });
```

**Step 3: Test endpoint manually**

Run backend: `cd backend && npm run dev`
Test: `curl http://localhost:4000/api/vt511/traffic-flow | jq .`
Expected: GeoJSON with features array containing road segments

**Step 4: Commit**

```bash
git add backend/src/server.js
git commit -m "feat(backend): add /api/vt511/traffic-flow endpoint with caching"
```

---

## Task 3: Create Frontend Traffic Flow API Service

**Files:**
- Create: `src/services/trafficFlowApi.js`

**Step 1: Create traffic flow API service**

Create `src/services/trafficFlowApi.js`:

```javascript
/**
 * Traffic Flow API Service
 * Fetches real-time traffic flow data from VT 511 via backend proxy
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

/**
 * Fetch traffic flow GeoJSON from backend
 * @returns {Promise<Object>} GeoJSON FeatureCollection of traffic segments
 */
export async function fetchTrafficFlow() {
  try {
    const url = `${BACKEND_URL}/api/vt511/traffic-flow`;
    const response = await fetch(url);

    if (!response.ok) {
      if (import.meta.env.DEV) {
        console.warn('Traffic flow data not available:', response.status);
      }
      return {
        type: 'FeatureCollection',
        features: []
      };
    }

    const geoJSON = await response.json();
    return geoJSON;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error fetching traffic flow:', error);
    }
    return {
      type: 'FeatureCollection',
      features: []
    };
  }
}
```

**Step 2: Commit**

```bash
git add src/services/trafficFlowApi.js
git commit -m "feat(frontend): add traffic flow API service"
```

---

## Task 4: Create Traffic Flow Layer Component

**Files:**
- Create: `src/components/TrafficFlowLayer.jsx`
- Create: `src/components/TrafficFlowLayer.css`

**Step 1: Create TrafficFlowLayer component**

Create `src/components/TrafficFlowLayer.jsx`:

```javascript
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTrafficFlow } from '../services/trafficFlowApi';
import './TrafficFlowLayer.css';

function TrafficFlowLayer({ map, visible }) {
  const [segmentCount, setSegmentCount] = useState(0);

  // Fetch traffic flow data with React Query
  const { data: trafficData, isLoading } = useQuery({
    queryKey: ['traffic-flow'],
    queryFn: fetchTrafficFlow,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    enabled: visible // Only fetch when layer is visible
  });

  // Add/update traffic flow layer on map
  useEffect(() => {
    if (!map || !visible || !trafficData) {
      // Remove layers if hidden or no data
      if (map && map.getLayer('traffic-flow-outline')) {
        map.removeLayer('traffic-flow-outline');
      }
      if (map && map.getLayer('traffic-flow')) {
        map.removeLayer('traffic-flow');
      }
      if (map && map.getSource('traffic-flow')) {
        map.removeSource('traffic-flow');
      }
      setSegmentCount(0);
      return;
    }

    // Update segment count
    setSegmentCount(trafficData.features?.length || 0);

    // Add or update source
    if (map.getSource('traffic-flow')) {
      map.getSource('traffic-flow').setData(trafficData);
    } else {
      map.addSource('traffic-flow', {
        type: 'geojson',
        data: trafficData
      });

      // Add outline layer (darker, thicker)
      map.addLayer({
        id: 'traffic-flow-outline',
        type: 'line',
        source: 'traffic-flow',
        paint: {
          'line-color': '#000000',
          'line-width': 6,
          'line-opacity': 0.4
        }
      });

      // Add main traffic flow layer (colored by speed)
      map.addLayer({
        id: 'traffic-flow',
        type: 'line',
        source: 'traffic-flow',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 4,
          'line-opacity': 0.9
        }
      });

      // Add click handler for segment details
      map.on('click', 'traffic-flow', (e) => {
        if (e.features.length === 0) return;

        const feature = e.features[0];
        const props = feature.properties;

        const popupContent = `
          <div style="padding: 8px;">
            <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">
              ${props.roadName}
            </h3>
            <p style="margin: 4px 0; font-size: 13px;">
              <strong>Current Speed:</strong> ${props.speed} mph
            </p>
            ${props.speedLimit ? `
              <p style="margin: 4px 0; font-size: 13px;">
                <strong>Speed Limit:</strong> ${props.speedLimit} mph
              </p>
            ` : ''}
            ${props.volume ? `
              <p style="margin: 4px 0; font-size: 13px;">
                <strong>Volume:</strong> ${props.volume} vehicles
              </p>
            ` : ''}
            <p style="margin: 8px 0 0 0; font-size: 11px; color: #6b7280; font-style: italic;">
              VT 511 Traffic Data
            </p>
          </div>
        `;

        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(popupContent)
          .addTo(map);
      });

      // Change cursor on hover
      map.on('mouseenter', 'traffic-flow', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'traffic-flow', () => {
        map.getCanvas().style.cursor = '';
      });
    }
  }, [map, visible, trafficData]);

  if (!visible) return null;

  return (
    <div className="traffic-flow-info">
      {isLoading && (
        <div className="traffic-loading">
          <div className="loading-spinner-small"></div>
          <span>Loading traffic...</span>
        </div>
      )}
      {!isLoading && segmentCount > 0 && (
        <div className="traffic-stats">
          <span className="stat-label">Traffic Segments:</span>
          <span className="stat-value">{segmentCount}</span>
        </div>
      )}
      {!isLoading && segmentCount === 0 && (
        <div className="traffic-empty">
          <span>✓ All roads flowing normally</span>
        </div>
      )}
      <div className="traffic-legend">
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#dc2626' }}></span>
          <span className="legend-label">Slow (&lt;35 mph)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color" style={{ backgroundColor: '#f59e0b' }}></span>
          <span className="legend-label">Moderate (35-55 mph)</span>
        </div>
      </div>
    </div>
  );
}

export default TrafficFlowLayer;
```

**Step 2: Create TrafficFlowLayer styles**

Create `src/components/TrafficFlowLayer.css`:

```css
.traffic-flow-info {
  margin-top: 12px;
}

.traffic-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-control);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.loading-spinner-small {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-color);
  border-top-color: var(--text-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.traffic-stats {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-control);
  border-radius: 6px;
  font-size: 13px;
  margin-bottom: 8px;
}

.stat-label {
  color: var(--text-secondary);
}

.stat-value {
  font-weight: 600;
  color: var(--text-primary);
}

.traffic-empty {
  padding: 8px 12px;
  background: var(--bg-control);
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 8px;
}

.traffic-legend {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: var(--bg-control);
  border-radius: 6px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.legend-color {
  width: 24px;
  height: 4px;
  border-radius: 2px;
}

.legend-label {
  color: var(--text-secondary);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

**Step 3: Add missing maplibregl import**

Update `src/components/TrafficFlowLayer.jsx` line 1:

```javascript
import { useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { useQuery } from '@tanstack/react-query';
import { fetchTrafficFlow } from '../services/trafficFlowApi';
import './TrafficFlowLayer.css';
```

**Step 4: Commit**

```bash
git add src/components/TrafficFlowLayer.jsx src/components/TrafficFlowLayer.css
git commit -m "feat(frontend): add TrafficFlowLayer component with legend and popups"
```

---

## Task 5: Integrate Traffic Flow Layer into WeatherMap

**Files:**
- Modify: `src/WeatherMap.jsx`

**Step 1: Import TrafficFlowLayer**

Add import after line 7 in `src/WeatherMap.jsx`:

```javascript
import TrafficFlowLayer from './components/TrafficFlowLayer';
```

**Step 2: Add traffic flow state**

Add state variable after line 39:

```javascript
const [showTrafficFlow, setShowTrafficFlow] = useState(false);
```

**Step 3: Add TrafficFlowLayer component to JSX**

Find where `<TravelLayer>` is rendered (search for it in the component) and add `<TrafficFlowLayer>` right after it:

```javascript
<TrafficFlowLayer
  map={map.current}
  visible={showTrafficFlow}
/>
```

**Step 4: Add toggle control in controls panel**

Find the controls panel section in the JSX (look for where weather stations toggle is) and add traffic flow toggle:

```javascript
<div className="control-section">
  <label className="control-label">
    <input
      type="checkbox"
      checked={showTrafficFlow}
      onChange={(e) => setShowTrafficFlow(e.target.checked)}
    />
    <span>Traffic Flow</span>
  </label>
  {showTrafficFlow && (
    <TrafficFlowLayer
      map={map.current}
      visible={showTrafficFlow}
    />
  )}
</div>
```

**Step 5: Test in browser**

Run: `npm run dev`
Expected:
1. See "Traffic Flow" toggle in controls panel
2. Toggle it on to see red/yellow road segments
3. Click segments to see speed popup
4. Verify legend shows at bottom of control panel

**Step 6: Commit**

```bash
git add src/WeatherMap.jsx
git commit -m "feat: integrate traffic flow layer with toggle control"
```

---

## Task 6: Update Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

**Step 1: Update CLAUDE.md features section**

Update the "Core Features" section in `CLAUDE.md` (around line 10) to add:

```markdown
- 🚦 Real-time traffic flow (VT 511 speed data on 96 road segments)
```

**Step 2: Update CLAUDE.md architecture diagram**

Update the "External Free Public APIs" section in `CLAUDE.md` to add traffic flow:

```markdown
│ ├── Vermont 511 (traffic, construction, closures, traffic flow)  │
```

**Step 3: Update CLAUDE.md data sources table**

Update the "Data Sources & Update Frequencies" table to add:

```markdown
| **VT 511 Traffic Flow** | Real-time speed data | 5 min | Real-time | `/api/vt511/traffic-flow` |
```

**Step 4: Update README.md features**

Add to README.md features section:

```markdown
- 🚦 **Real-Time Traffic Flow** - Color-coded road segments showing slow/moderate traffic conditions
```

**Step 5: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: add traffic flow feature to documentation"
```

---

## Task 7: Testing & Verification

**Step 1: Manual testing checklist**

Test the following:
- [ ] Backend endpoint returns GeoJSON: `curl http://localhost:4000/api/vt511/traffic-flow`
- [ ] Frontend toggle appears in controls panel
- [ ] Toggle on shows colored road segments
- [ ] Red segments appear for speeds < 35 mph
- [ ] Yellow segments appear for speeds 35-55 mph
- [ ] No segments appear for speeds >= 55 mph
- [ ] Clicking segment shows popup with speed info
- [ ] Legend displays correctly at bottom
- [ ] Segment count updates when data refreshes
- [ ] Layer cleans up when toggled off
- [ ] Data refreshes every 5 minutes automatically

**Step 2: Check console for errors**

Open browser console (F12) and verify:
- No JavaScript errors
- No failed network requests
- DEV mode logs show traffic flow fetching (if any)

**Step 3: Test caching**

1. Toggle traffic flow on
2. Wait for data to load
3. Open Network tab (F12)
4. Toggle off and on again quickly
5. Verify: Should see cached response (or no new request)

**Step 4: Test edge cases**

- [ ] Test with backend offline - should show empty state
- [ ] Test with no slow traffic - should show "All roads flowing normally"
- [ ] Test zoom in/out - segments should stay visible at all zoom levels
- [ ] Test with other layers enabled (radar, incidents) - no conflicts

---

## Task 8: Final Cleanup

**Step 1: Check for console.log statements**

Search for unwanted console.log:
```bash
grep -rn "console\.log" src/components/TrafficFlowLayer.jsx src/services/trafficFlowApi.js backend/src/services/trafficFlow.js
```

Expected: None found, or all wrapped in `if (import.meta.env.DEV)` checks

**Step 2: Remove xmldom from frontend if accidentally installed**

Check frontend package.json:
```bash
cat package.json | grep xmldom
```

Expected: No match (xmldom should only be in backend)

**Step 3: Verify .env.example is not needed**

Since VT 511 is free and requires no API key, verify no new env vars needed.

**Step 4: Final commit**

```bash
git add .
git commit -m "chore: final cleanup for traffic flow feature"
```

---

## Implementation Complete! 🎉

**What you built:**
- ✅ Backend service combining VT 511 traffic + network data
- ✅ GeoJSON endpoint with 5-minute caching
- ✅ Frontend toggleable layer with color-coded segments
- ✅ Interactive popups showing speed details
- ✅ Legend and segment count display
- ✅ Automatic 5-minute refresh with React Query
- ✅ Free data source (no API keys needed)

**Usage:**
- 96 road segments covered (I-89, I-91, major routes)
- Only shows problem areas (red/yellow, hides green)
- Updates every 5 minutes
- Zero API costs (100% free VT 511 data)

**Next Steps (Optional):**
- Add traffic camera integration (97 cameras available)
- Add travel time segments (tvtStatusData feed)
- Add traffic volume visualization
- Add road weather station data (essData feed)
