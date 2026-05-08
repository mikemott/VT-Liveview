# Why the First Fix Didn't Work

## The Problem with Sequential Loading

**What we tried:**
```
Time: 0ms     400ms    800ms    1200ms
      ↓       ↓        ↓        ↓
      Frame0  Frame1   Frame2   Frame3  (4 sources added with delays)
```

**What actually happened:**
```
Frame 0 added at 0ms:
  → MapLibre loads tiles for viewport: tile(8,75,89), tile(8,75,90), tile(8,76,89)...
  → ~100 tiles loaded simultaneously ❌

Frame 1 added at 400ms:
  → MapLibre loads tiles for viewport: tile(8,75,89), tile(8,75,90), tile(8,76,89)...
  → ~100 MORE tiles loaded simultaneously ❌

Frame 2 added at 800ms:
  → Another ~100 tiles... ❌

Frame 3 added at 1200ms:
  → Another ~100 tiles... ❌

Total: ~400 tiles in rapid succession → 429 Rate Limit Hit
```

## The Real Issue

When you add a MapLibre raster source with `visibility: 'visible'`, it **immediately loads all tiles** needed to cover the visible map area. At zoom level 8 over Vermont, that's **50-100 individual tile images per frame**.

The sequential source loading (400ms delays) wasn't enough because:
- ✅ We added sources slowly (good)
- ❌ But each source loaded 100 tiles at once (bad)
- Result: Still 400 simultaneous tile requests

## The Lazy Loading Solution

**New approach:** Use `visibility: 'none'` to prevent tile loading until needed.

### How MapLibre Handles Visibility

```typescript
// visibility: 'visible' → Loads tiles immediately
map.addLayer({
  layout: { visibility: 'visible' }
});
// → MapLibre: "I need tiles! Downloading tile(8,75,89).png, tile(8,75,90).png..."

// visibility: 'none' → Doesn't load any tiles
map.addLayer({
  layout: { visibility: 'none' }
});
// → MapLibre: "Layer is hidden, no need to load tiles yet."
```

### Implementation

**Step 1: Add all layers as hidden**
```typescript
// Add 4 sources/layers with visibility: 'none'
for (let i = 0; i < 4; i++) {
  map.addSource(`radar-source-${i}`, { ... });
  map.addLayer({
    id: `radar-layer-${i}`,
    layout: { visibility: 'none' }  // Hidden = no tiles loaded
  });
}
```

At this point: **0 tiles loaded** ✅

**Step 2: Show only the current frame**
```typescript
// User is viewing frame 3 (most recent)
map.setLayoutProperty('radar-layer-3', 'visibility', 'visible');
```

Now MapLibre loads **~100 tiles for frame 3 only** ✅

**Step 3: When animation advances to next frame**
```typescript
// Hide previous frame
map.setLayoutProperty('radar-layer-3', 'visibility', 'none');

// Show next frame (frame 0)
map.setLayoutProperty('radar-layer-0', 'visibility', 'visible');
```

MapLibre loads **~100 tiles for frame 0** (and may cache from previous load if same tiles)

## Request Comparison

### Before (Sequential with visibility: 'visible')
```
t=0ms:    Frame 0 → 100 tiles
t=400ms:  Frame 1 → 100 tiles
t=800ms:  Frame 2 → 100 tiles
t=1200ms: Frame 3 → 100 tiles
─────────────────────────────
Total: 400 tiles in 1.2 seconds → 429 Rate Limit ❌
```

### After (Lazy loading with visibility: 'none')
```
t=0ms:    Add all 4 sources/layers (all hidden) → 0 tiles
t=0ms:    Show frame 3 → 100 tiles
User clicks "next frame":
t=Xms:    Hide frame 3, show frame 0 → 100 tiles (on-demand)
─────────────────────────────
Total: 100 tiles per action → No rate limit ✅
```

## Code Changes

### Before (Attempt 1)
```typescript
// Problem: visibility: 'visible' triggers immediate tile loading
map.addLayer({
  id: layerId,
  layout: {
    visibility: 'visible'  // ❌ Loads tiles immediately
  },
  paint: {
    'raster-opacity': 0    // Transparent but still loading tiles!
  }
});
```

### After (Lazy Loading)
```typescript
// Solution: visibility: 'none' defers tile loading
map.addLayer({
  id: layerId,
  layout: {
    visibility: index === currentFrame ? 'visible' : 'none'  // ✅ Only current frame loads
  },
  paint: {
    'raster-opacity': opacity
  }
});

// When switching frames:
frames.forEach((_, index) => {
  const shouldShow = index === currentFrame && visible;
  map.setLayoutProperty(layerId, 'visibility', shouldShow ? 'visible' : 'none');
  if (shouldShow) {
    map.setPaintProperty(layerId, 'raster-opacity', opacity);
  }
});
```

## Why This Works

1. **Controlled Loading**: Tiles load **only when needed** (when frame becomes visible)
2. **Low Concurrency**: Maximum ~100 tiles loaded at once (1 frame worth)
3. **Caching**: MapLibre caches tiles, so revisiting a frame is fast
4. **No Delays Needed**: No artificial timeouts or rate limiting on our end
5. **Natural Throttling**: User can't switch frames faster than tiles can load

## Expected Behavior

**Initial Load:**
- Map loads basemap tiles
- 4 radar sources/layers added (all hidden)
- Current frame (most recent) set to visible
- ~100 radar tiles load for that frame
- Radar appears on map

**During Animation:**
- Frame advances (e.g., frame 3 → frame 0)
- Previous frame hidden (`visibility: 'none'`)
- New frame shown (`visibility: 'visible'`)
- ~100 new tiles load on-demand
- Brief loading indicator possible (normal behavior)
- No 429 errors because we're within rate limits

**Result:**
- ✅ Radar tiles load successfully
- ✅ No CORS errors
- ✅ No "Zoom Level Not Supported"
- ✅ Animation works (may pause briefly when loading new frame)
- ✅ Total tile requests stay under RainViewer's limit
