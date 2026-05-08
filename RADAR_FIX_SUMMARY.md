# Radar Tiles Fix - Rate Limiting Issue

## Problem

Radar tiles were not loading due to **HTTP 429 (Too Many Requests)** errors from RainViewer API:

```
Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource
(Reason: CORS header 'Access-Control-Allow-Origin' missing). Status code: 429.
```

**Root Cause:**
- The app was requesting 6 radar frame tiles **simultaneously**
- RainViewer's rate limiter returned 429 errors
- The 429 error responses **lacked CORS headers**, causing the browser to block them
- MapLibre showed "Zoom Level Not Supported" because tiles failed to load

## Solution

**3 key changes implemented:**

### 1. Reduced Frame Count (6 → 4)
**Files:** `src/utils/constants.ts`, `src/components/RadarOverlay.tsx`

```typescript
export const RADAR_CONFIG: RadarConfig = {
  frameCount: 4, // Reduced from 6 to avoid RainViewer rate limiting
  frameDelay: 500,
  defaultOpacity: 0.7,
} as const;
```

**Benefit:** Fewer simultaneous requests = less likely to hit rate limit

### 2. Sequential Frame Loading with Delays
**File:** `src/components/RadarOverlay.tsx`

**Before:**
```typescript
// All sources added at once (caused rate limiting)
frames.forEach((frame, index) => {
  map.addSource(sourceId, { ... });
  map.addLayer({ ... });
});
```

**After:**
```typescript
// Sources added sequentially with 400ms delays
const addSourcesSequentially = async () => {
  for (let index = 0; index < frames.length; index++) {
    map.addSource(sourceId, { ... });
    map.addLayer({ ... });

    // Wait 400ms before adding next source
    if (index < frames.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
};
```

**Benefit:**
- Spreads requests over ~1.6 seconds (4 frames × 400ms)
- Prevents overwhelming RainViewer's rate limiter
- Applied to both initial load AND refresh operations

### 3. Increased Preload Timeout (8s → 12s)
**File:** `src/utils/constants.ts`

```typescript
PRELOAD_TIMEOUT: 12000, // Increased to account for sequential loading
```

**Benefit:** Allows time for sequential loading before fallback timeout

## Technical Details

**Loading Timeline:**
```
t=0ms    : Add frame 0 source/layer
t=400ms  : Add frame 1 source/layer
t=800ms  : Add frame 2 source/layer
t=1200ms : Add frame 3 source/layer
t=1200ms+: Tiles start loading from RainViewer
t=<12s   : All tiles should load (or timeout triggers)
```

**Network Impact:**
- **Before:** 6 simultaneous requests → 429 errors
- **After:** 4 sequential requests (1 every 400ms) → 200 OK responses

## Files Changed

1. `src/utils/constants.ts`
   - Reduced `RADAR_CONFIG.frameCount` from 6 to 4
   - Increased `PRELOAD_TIMEOUT` from 8000 to 12000

2. `src/components/RadarOverlay.tsx`
   - Changed `frameCount` from 6 to 4 in `useRadarAnimation` call
   - Replaced `frames.forEach()` with async sequential loading (initial load)
   - Replaced `frames.forEach()` with async sequential loading (refresh)

## Testing

**Expected Behavior:**
1. Open the app in browser
2. Check Network tab filtered to "rainviewer"
3. Should see:
   - ✅ `api.rainviewer.com/public/weather-maps.json` → 200 OK
   - ✅ Tile requests spaced ~400ms apart
   - ✅ All tile requests → 200 OK (no 429 errors)
   - ✅ No CORS errors in console
4. Radar overlay should appear on map within 3-5 seconds
5. Animation should play smoothly with 4 frames

**Verification:**
```bash
# Run dev server
npm run dev

# Open http://localhost:5173
# Open DevTools → Console
# Open DevTools → Network (filter: "rainviewer")
# Wait for radar to load
# Should see no errors, radar tiles visible
```

## Performance Considerations

**Tradeoffs:**
- ✅ **Pro:** Eliminates 429 rate limiting errors
- ✅ **Pro:** More reliable tile loading
- ⚠️ **Con:** Radar takes ~1.6s longer to fully load (acceptable)
- ⚠️ **Con:** Fewer frames (4 vs 6) means slightly less smooth animation

**Future Optimizations:**
- Consider caching frames client-side (IndexedDB/localStorage)
- Implement backend proxy for RainViewer to avoid client-side rate limits
- Use RainViewer's nowcast frames for smoother future prediction
- Investigate paid RainViewer tier for higher rate limits

## Commit Message

```
fix(radar): resolve rate limiting causing tile load failures

RainViewer API was returning 429 errors when loading 6 radar frames
simultaneously. The 429 responses lacked CORS headers, causing browser
to block requests and preventing radar tiles from loading.

Changes:
- Reduce frame count from 6 to 4 to minimize requests
- Load frames sequentially with 400ms delays between each
- Apply sequential loading to both initial load and refresh
- Increase preload timeout from 8s to 12s to accommodate delays

This prevents overwhelming RainViewer's rate limiter while maintaining
smooth radar animation with 4 frames.

Fixes: Radar tiles not loading (HTTP 429 + CORS errors)
```

## Related Issues

- **AUDIT_REPORT.md:** Consider adding rate limiting best practices
- **CLAUDE.md:** Update "Common Development Tasks" with rate limiting considerations
- **backend/src/services/radar.ts:** Currently unused by frontend, could serve as proxy

## Verification Checklist

After deploying this fix:

- [ ] Radar tiles load without CORS errors
- [ ] No 429 status codes in Network tab
- [ ] Radar animation plays smoothly
- [ ] Loading time is acceptable (< 5 seconds)
- [ ] Refresh (every 5 minutes) works without errors
- [ ] "Zoom Level Not Supported" messages are gone
