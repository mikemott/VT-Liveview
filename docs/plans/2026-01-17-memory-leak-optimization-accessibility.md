# Memory Leak Fixes, Optimization, and Accessibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix memory leaks, optimize re-renders, improve loading states, add error handling with retry, and implement comprehensive accessibility features.

**Architecture:** Prevent memory leaks through proper cleanup functions, reduce re-renders using React.memo and useCallback, add skeleton loaders and timestamps for better UX, implement retry logic for failed API calls, and add ARIA attributes for screen readers.

**Tech Stack:** React 19, TypeScript, MapLibre GL, React Query, CSS animations

---

## Task 1: Extract Cleanup Utilities for TravelLayer

**Files:**
- Create: `src/utils/markerCleanup.ts`
- Modify: `src/components/TravelLayer.tsx:229-402`

**Step 1: Create marker cleanup utility**

Create `src/utils/markerCleanup.ts`:

```typescript
/**
 * Marker Cleanup Utilities
 * Centralized cleanup logic for MapLibre markers to prevent memory leaks
 */

import type { Marker } from '../types';

/**
 * Marker entry with cleanup handler
 */
export interface MarkerEntry {
  marker: Marker;
  element: HTMLDivElement;
  handler: (e: MouseEvent) => void;
}

/**
 * Clean up a single marker entry
 * Removes event listeners and marker from map
 */
export function cleanupMarker(entry: MarkerEntry): void {
  const { marker, element, handler } = entry;

  if (element && handler) {
    element.removeEventListener('click', handler as EventListener);
  }

  marker.remove();
}

/**
 * Clean up an array of marker entries
 * Removes all event listeners and markers from map
 */
export function cleanupMarkers(markers: MarkerEntry[]): void {
  markers.forEach(cleanupMarker);
  markers.length = 0; // Clear array in place
}
```

**Step 2: Update TravelLayer to use cleanup utility**

Modify `src/components/TravelLayer.tsx`:

1. Remove the local `MarkerEntry` interface (lines 24-28)
2. Import from utility:

```typescript
import { cleanupMarkers, type MarkerEntry } from '../utils/markerCleanup';
```

3. Replace all manual cleanup code with `cleanupMarkers()` calls:
   - Line 232-238: Replace with `cleanupMarkers(markersRef.current);`
   - Line 256-262: Replace with `cleanupMarkers(markersRef.current);`
   - Line 385-391: Replace with `cleanupMarkers(markersRef.current);`

**Step 3: Commit**

```bash
git add src/utils/markerCleanup.ts src/components/TravelLayer.tsx
git commit -m "refactor: extract marker cleanup utility to prevent memory leaks"
```

---

## Task 2: Add AbortController to RadarOverlay

**Files:**
- Modify: `src/hooks/useRadarAnimation.ts:133-191`

**Step 1: Add AbortController for fetch race conditions**

Modify `useRadarAnimation.ts` fetchFrames function:

```typescript
// At top of function
const fetchFrames = useCallback(async (signal?: AbortSignal) => {
  try {
    setIsLoading(true);
    setError(null);

    const response = await fetch(RAINVIEWER_API, { signal });
    if (!response.ok) throw new Error('Failed to fetch radar data');

    const data: RainViewerResponse = await response.json();
    const radarData = data.radar;

    if (!radarData?.past?.length) {
      throw new Error('No radar data available');
    }

    // ... rest of function unchanged
  } catch (err) {
    // Don't set error if aborted
    if (err instanceof Error && err.name === 'AbortError') {
      return;
    }

    if (import.meta.env.DEV) {
      console.error('Error fetching radar frames:', err);
    }
    // ... rest of error handling unchanged
  } finally {
    setIsLoading(false);
  }
}, [frameCount]);
```

**Step 2: Use AbortController in effects**

```typescript
// Initial fetch (line 194)
useEffect(() => {
  const abortController = new AbortController();

  void fetchFrames(abortController.signal);

  // Refresh frames every 5 minutes
  const refreshInterval = setInterval(() => {
    void fetchFrames(); // Don't abort interval refreshes
  }, INTERVALS.RADAR_REFRESH);

  return () => {
    abortController.abort(); // Cancel in-flight request on unmount
    clearInterval(refreshInterval);
  };
}, [fetchFrames]);
```

**Step 3: Commit**

```bash
git add src/hooks/useRadarAnimation.ts
git commit -m "fix: add AbortController to prevent radar fetch race conditions"
```

---

## Task 3: Apply React.memo to Layer Components

**Files:**
- Modify: `src/components/TravelLayer.tsx:545-547`
- Modify: `src/components/WeatherStationsLayer.tsx:370-372`

**Step 1: Wrap TravelLayer with React.memo**

Replace export at line 547 in `TravelLayer.tsx`:

```typescript
import { useState, useEffect, useRef, ReactNode, memo } from 'react';

// ... component code ...

export default memo(TravelLayer);
```

**Step 2: Wrap WeatherStationsLayer with React.memo**

Replace export at line 372 in `WeatherStationsLayer.tsx`:

```typescript
import { useState, useEffect, useRef, memo } from 'react';

// ... component code ...

export default memo(WeatherStationsLayer);
```

**Step 3: Verify no unnecessary re-renders**

Run: `npm run dev`
Expected: Components only re-render when props change

**Step 4: Commit**

```bash
git add src/components/TravelLayer.tsx src/components/WeatherStationsLayer.tsx
git commit -m "perf: wrap layer components with React.memo to reduce re-renders"
```

---

## Task 4: Extract Stable Callbacks in WeatherMap

**Files:**
- Modify: `src/WeatherMap.tsx:78-173,175-263`

**Step 1: Wrap addAlertsToMap with useCallback**

Already done at line 78! ✓

**Step 2: Wrap handleAlertClick with useCallback**

Already done at line 176! ✓

**Step 3: Wrap fetchAlerts with useCallback**

Already done at line 266! ✓

**Step 4: Wrap toggleTheme with useCallback**

Already done at line 454! ✓

**Analysis:** All major callbacks are already memoized. No changes needed.

**Step 5: Commit (documentation only)**

```bash
git add docs/plans/2026-01-17-memory-leak-optimization-accessibility.md
git commit -m "docs: verify WeatherMap callbacks are already memoized"
```

---

## Task 5: Add Skeleton Loaders to TravelLayer

**Files:**
- Create: `src/components/TravelLayer.css` (append)
- Modify: `src/components/TravelLayer.tsx:470-476`

**Step 1: Add shimmer animation CSS**

Append to `src/components/TravelLayer.css`:

```css
/* Skeleton Loader */
.incidents-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}

.skeleton-item {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.05) 0%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0.05) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
  height: 60px;
}

.dark .skeleton-item {
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0.1) 0%,
    rgba(0, 0, 0, 0.2) 50%,
    rgba(0, 0, 0, 0.1) 100%
  );
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}
```

**Step 2: Replace loading state with skeleton**

Replace lines 470-476 in `TravelLayer.tsx`:

```tsx
{/* Loading state with skeleton */}
{loading && (
  <div className="incidents-skeleton" aria-live="polite" aria-busy="true">
    <div className="skeleton-item" />
    <div className="skeleton-item" />
    <div className="skeleton-item" />
  </div>
)}
```

**Step 3: Test skeleton loader**

Run: `npm run dev`
Expected: See shimmer animation when loading incidents

**Step 4: Commit**

```bash
git add src/components/TravelLayer.css src/components/TravelLayer.tsx
git commit -m "feat: add skeleton loader to TravelLayer for better loading UX"
```

---

## Task 6: Add Last Updated Timestamps

**Files:**
- Modify: `src/components/TravelLayer.tsx:80-92`
- Modify: `src/components/TravelLayer.tsx:102-116`
- Modify: `src/components/TravelLayer.tsx:476-478` (after skeleton)

**Step 1: Add lastUpdated state**

Add state at line 92:

```typescript
const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
```

**Step 2: Update lastUpdated on successful fetch**

Modify fetchIncidentsData (line 104):

```typescript
try {
  const data = await fetchAllIncidents();
  setIncidents(data);
  setLastUpdated(new Date()); // Add this line
} catch (error) {
```

**Step 3: Display timestamp in UI**

Add after loading skeleton (around line 478):

```tsx
{/* Last updated timestamp */}
{lastUpdated && !loading && (
  <div className="last-updated" aria-live="polite">
    <span style={{ fontSize: '11px', opacity: 0.7 }}>
      Updated {lastUpdated.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      })}
    </span>
  </div>
)}
```

**Step 4: Add CSS for timestamp**

Append to `src/components/TravelLayer.css`:

```css
.last-updated {
  padding: 4px 8px;
  text-align: center;
  font-style: italic;
}
```

**Step 5: Commit**

```bash
git add src/components/TravelLayer.tsx src/components/TravelLayer.css
git commit -m "feat: add last updated timestamp to TravelLayer"
```

---

## Task 7: Add Error States with Retry to TravelLayer

**Files:**
- Modify: `src/components/TravelLayer.tsx:80-92`
- Modify: `src/components/TravelLayer.tsx:95-117`
- Modify: `src/components/TravelLayer.tsx:479-484` (after timestamp)

**Step 1: Add error state**

Add state at line 92:

```typescript
const [error, setError] = useState<string | null>(null);
```

**Step 2: Update error handling in fetch**

Modify fetchIncidentsData (line 106):

```typescript
} catch (error) {
  if (import.meta.env.DEV) {
    console.error('Error fetching travel incidents:', error);
  }
  setError(error instanceof Error ? error.message : 'Failed to load incidents');
} finally {
```

**Step 3: Clear error on successful fetch**

Add at top of try block (line 103):

```typescript
try {
  setError(null); // Clear previous errors
  const data = await fetchAllIncidents();
```

**Step 4: Add retry UI**

Add after last-updated timestamp (around line 485):

```tsx
{/* Error state with retry */}
{error && !loading && (
  <div className="incidents-error" role="alert" aria-live="assertive">
    <p style={{ margin: '0 0 8px 0', color: '#ef4444' }}>
      ⚠️ Failed to load incidents
    </p>
    <p style={{ margin: '0 0 8px 0', fontSize: '12px', opacity: 0.8 }}>
      {error}
    </p>
    <button
      className="retry-button"
      onClick={() => {
        setError(null);
        void fetchIncidentsData();
      }}
      aria-label="Retry loading incidents"
    >
      Retry
    </button>
  </div>
)}
```

**Step 5: Add CSS for error state**

Append to `src/components/TravelLayer.css`:

```css
.incidents-error {
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  text-align: center;
}

.retry-button {
  background: #ef4444;
  color: white;
  border: none;
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease;
}

.retry-button:hover {
  background: #dc2626;
}

.retry-button:focus-visible {
  outline: 2px solid #ef4444;
  outline-offset: 2px;
}
```

**Step 6: Commit**

```bash
git add src/components/TravelLayer.tsx src/components/TravelLayer.css
git commit -m "feat: add error state with retry button to TravelLayer"
```

---

## Task 8: Add ARIA Labels to Icon-Only Buttons

**Files:**
- Modify: `src/components/TravelLayer.tsx:422-424`
- Modify: `src/components/RadarOverlay.tsx:274-282,286-303`
- Modify: `src/WeatherMap.tsx:489-501`

**Step 1: Add ARIA to TravelLayer expand toggle**

Modify line 422 in `TravelLayer.tsx`:

```tsx
<button
  className="expand-toggle"
  aria-label={expanded ? 'Collapse map features' : 'Expand map features'}
  aria-expanded={expanded}
  aria-controls="map-features-content"
>
  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
</button>
```

Add id to content div (line 427):

```tsx
{expanded && (
  <div className="section-content" id="map-features-content">
```

**Step 2: Add ARIA to RadarOverlay buttons**

Update visibility toggle (line 275):

```tsx
<button
  className="visibility-toggle"
  onClick={() => setVisible(!visible)}
  title={visible ? 'Hide radar' : 'Show radar'}
  aria-label={visible ? 'Hide radar overlay' : 'Show radar overlay'}
  aria-pressed={visible}
>
  {visible ? <Eye size={18} /> : <EyeOff size={18} />}
</button>
```

Update control buttons (lines 287-303):

```tsx
<button
  onClick={prevFrame}
  disabled={isLoading || !tilesLoaded}
  aria-label="Previous radar frame"
>
  <SkipBack size={18} />
</button>
<button
  className="play-button"
  onClick={toggle}
  disabled={isLoading || frames.length === 0 || !tilesLoaded}
  aria-label={isPlaying ? 'Pause radar animation' : 'Play radar animation'}
  aria-pressed={isPlaying}
>
  {isPlaying ? <Pause size={20} /> : <Play size={20} />}
</button>
<button
  onClick={nextFrame}
  disabled={isLoading || !tilesLoaded}
  aria-label="Next radar frame"
>
  <SkipForward size={18} />
</button>
<button
  onClick={refresh}
  disabled={isLoading}
  aria-label="Refresh radar data"
>
  <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
</button>
```

**Step 3: Verify ARIA labels in WeatherMap**

Mobile menu toggle already has aria-label and aria-expanded at line 496-497! ✓

**Step 4: Commit**

```bash
git add src/components/TravelLayer.tsx src/components/RadarOverlay.tsx
git commit -m "a11y: add ARIA labels to all icon-only buttons"
```

---

## Task 9: Add role="slider" to Radar Timeline

**Files:**
- Modify: `src/components/RadarOverlay.tsx:313-328`

**Step 1: Add slider semantics to timeline**

Replace timeline section (lines 313-328):

```tsx
<div
  className="radar-timeline"
  role="slider"
  aria-label="Radar timeline"
  aria-valuemin={0}
  aria-valuemax={frames.length - 1}
  aria-valuenow={currentFrame}
  aria-valuetext={`Frame ${currentFrame + 1} of ${frames.length}: ${formatTime(currentFrameData?.time)}`}
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevFrame();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextFrame();
    }
  }}
>
  <div className="timeline-track">
    {frames.map((frame: RadarFrameData, idx: number) => (
      <button
        key={idx}
        className={`timeline-dot ${idx === currentFrame ? 'active' : ''} ${frame.isNowcast ? 'nowcast' : ''}`}
        onClick={() => goToFrame(idx)}
        title={formatTime(frame.time)}
        aria-label={`Go to frame ${idx + 1}: ${formatTime(frame.time)}${frame.isNowcast ? ' (forecast)' : ''}`}
      />
    ))}
  </div>
  <div className="timeline-time">
    {currentFrameData?.isNowcast && <span className="nowcast-badge">Forecast</span>}
    <span>{formatTime(currentFrameData?.time)}</span>
  </div>
</div>
```

**Step 2: Add CSS for keyboard focus**

Append to `src/components/RadarOverlay.css`:

```css
.radar-timeline:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
  border-radius: 6px;
}
```

**Step 3: Commit**

```bash
git add src/components/RadarOverlay.tsx src/components/RadarOverlay.css
git commit -m "a11y: add slider role and keyboard navigation to radar timeline"
```

---

## Task 10: Add Opacity Slider ARIA Attributes

**Files:**
- Modify: `src/components/RadarOverlay.tsx:330-341`

**Step 1: Add ARIA to opacity control**

Replace opacity control section:

```tsx
<div className="opacity-control">
  <label htmlFor="radar-opacity">Opacity</label>
  <input
    id="radar-opacity"
    type="range"
    min="0"
    max="1"
    step="0.1"
    value={opacity}
    onChange={handleOpacityChange}
    aria-label="Radar overlay opacity"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(opacity * 100)}
    aria-valuetext={`${Math.round(opacity * 100)} percent`}
  />
  <span aria-live="polite">{Math.round(opacity * 100)}%</span>
</div>
```

**Step 2: Commit**

```bash
git add src/components/RadarOverlay.tsx
git commit -m "a11y: add ARIA attributes to opacity slider"
```

---

## Task 11: Add Focus-Visible Styles

**Files:**
- Modify: `src/components/TravelLayer.css` (append)
- Modify: `src/components/RadarOverlay.css` (append)
- Modify: `src/WeatherMap.css` (append)

**Step 1: Add focus-visible to TravelLayer**

Append to `src/components/TravelLayer.css`:

```css
/* Keyboard Focus Styles */
.expand-toggle:focus-visible,
.filter-checkbox input:focus-visible,
.incident-item:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.filter-checkbox input:focus-visible {
  outline-offset: 0;
}

/* Make clickable incidents keyboard accessible */
.incident-item.clickable {
  cursor: pointer;
  transition: background 0.2s ease;
}

.incident-item.clickable:hover,
.incident-item.clickable:focus-visible {
  background: rgba(59, 130, 246, 0.1);
}
```

**Step 2: Add focus-visible to RadarOverlay**

Append to `src/components/RadarOverlay.css`:

```css
/* Keyboard Focus Styles */
.visibility-toggle:focus-visible,
.radar-controls button:focus-visible,
.timeline-dot:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

input[type="range"]:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}
```

**Step 3: Add focus-visible to WeatherMap**

Append to `src/WeatherMap.css`:

```css
/* Keyboard Focus Styles */
.mobile-menu-toggle:focus-visible,
.mobile-panel-close:focus-visible,
.alert-item:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Improve alert item keyboard navigation */
.alert-item {
  transition: background 0.2s ease;
}

.alert-item:hover,
.alert-item:focus-visible {
  background: rgba(59, 130, 246, 0.05);
}
```

**Step 4: Commit**

```bash
git add src/components/TravelLayer.css src/components/RadarOverlay.css src/WeatherMap.css
git commit -m "a11y: add focus-visible styles for keyboard navigation"
```

---

## Task 12: Verification and Testing

**Files:**
- None (testing only)

**Step 1: Run Chrome DevTools Memory Profiler**

1. Open Chrome DevTools → Memory tab
2. Take heap snapshot (Baseline)
3. Use app for 10 minutes:
   - Toggle radar on/off 5 times
   - Toggle travel layer on/off 5 times
   - Zoom in/out multiple times
   - Click incidents and weather stations
4. Take another heap snapshot (After 10 min)
5. Compare snapshots

Expected: Heap size stable or minimal growth (<5MB)

**Step 2: Run Lighthouse Accessibility Audit**

Run: `npm run build && npx serve dist`

1. Open Chrome DevTools → Lighthouse
2. Select "Accessibility" only
3. Run audit

Expected: Score > 90

**Step 3: Test keyboard navigation**

1. Use Tab key to navigate through all controls
2. Use Enter/Space to activate buttons
3. Use Arrow keys on radar timeline
4. Verify all interactive elements are reachable

Expected: All controls accessible via keyboard

**Step 4: Test screen reader**

1. Enable VoiceOver (Mac) or NVDA (Windows)
2. Navigate through app
3. Verify all buttons announce their purpose
4. Verify expandable sections announce state

Expected: All interactive elements properly announced

**Step 5: Test error states**

1. Block network in DevTools
2. Wait for incidents to fail loading
3. Verify error message displays
4. Click retry button
5. Unblock network

Expected: Error shows, retry works

**Step 6: Test loading states**

1. Throttle network to "Slow 3G"
2. Reload page
3. Verify skeleton loaders appear

Expected: Shimmer animation visible during loading

**Step 7: Document results**

Create `docs/plans/2026-01-17-verification-results.md`:

```markdown
# VTL-7 Verification Results

## Memory Leak Test (Chrome DevTools)
- Baseline heap: X MB
- After 10 min: Y MB
- Growth: Z MB
- Status: PASS / FAIL

## Lighthouse Accessibility
- Score: XX/100
- Status: PASS (>90) / FAIL

## Keyboard Navigation
- All controls reachable: YES / NO
- Proper focus indicators: YES / NO
- Status: PASS / FAIL

## Screen Reader Test
- Buttons announced: YES / NO
- States announced: YES / NO
- Status: PASS / FAIL

## Error States
- Error message displays: YES / NO
- Retry button works: YES / NO
- Status: PASS / FAIL

## Loading States
- Skeleton loaders appear: YES / NO
- Shimmer animation smooth: YES / NO
- Status: PASS / FAIL
```

**Step 8: Final commit**

```bash
git add docs/plans/2026-01-17-verification-results.md
git commit -m "docs: add VTL-7 verification test results"
```

---

## Summary

**Total Tasks:** 12
**Estimated Completion:** All memory leaks fixed, re-renders optimized, loading/error states improved, accessibility score >90

**Key Improvements:**
- ✅ Memory leaks prevented with proper cleanup and AbortController
- ✅ Re-renders reduced with React.memo
- ✅ UX improved with skeleton loaders and timestamps
- ✅ Error handling improved with retry buttons
- ✅ Accessibility complete with ARIA labels and keyboard nav
- ✅ Focus indicators added for keyboard users

**Blocked By:** None (Frontend migration VTL-3 is complete)

**Verification Checklist:**
- [ ] Chrome DevTools Memory: Heap stable after 10 min
- [ ] Lighthouse Accessibility: Score >90
- [ ] Keyboard navigation: All controls reachable
- [ ] Screen reader: All elements announced
- [ ] Error states: Display and retry work
- [ ] Loading states: Skeleton loaders smooth
