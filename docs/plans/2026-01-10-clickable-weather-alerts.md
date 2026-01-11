# Clickable Weather Alerts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make weather alert items in the sidebar clickable to smoothly fly the map to the affected area.

**Architecture:** Add click handler that calculates bounding box from alert polygon geometry and uses MapLibre's `fitBounds()` to animate the map view. Enhance with keyboard accessibility and visual feedback.

**Tech Stack:** React 19, MapLibre GL JS 5.15.0, existing alert GeoJSON data

---

## Task 1: Add Click Handler Function

**Files:**
- Modify: `src/WeatherMap.jsx:124-143` (add after `addAlertsToMap` function)

**Step 1: Add the handleAlertClick function**

Add this function after the `addAlertsToMap` callback (around line 124):

```javascript
// Handle alert item click to fly to affected area
const handleAlertClick = useCallback((alert) => {
  if (!map.current || !alert.geometry) return;

  // Calculate bounding box from polygon coordinates
  const coords = alert.geometry.coordinates[0];
  let minLng = Infinity, maxLng = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  coords.forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  });

  // Fly to bounds with smooth animation
  map.current.fitBounds(
    [[minLng, minLat], [maxLng, maxLat]],
    {
      padding: 80,        // 80px buffer on all sides
      duration: 1500,     // 1.5 second smooth animation
      maxZoom: 15         // Prevent excessive zoom on tiny polygons
    }
  );
}, []);
```

**Step 2: Run build to verify no syntax errors**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit the handler function**

```bash
git add src/WeatherMap.jsx
git commit -m "feat: add click handler for alert navigation

Add handleAlertClick function that calculates bounding box from alert
geometry and uses MapLibre fitBounds to animate map to affected area.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Wire Up Click Handler to Alert Items

**Files:**
- Modify: `src/WeatherMap.jsx:299-308` (alert items rendering)

**Step 1: Add onClick handler to alert items**

Update the alert items div (lines 299-308) to add the onClick handler:

```javascript
{alerts.map((alert, index) => (
  <div
    key={index}
    className={`alert-item severity-${alert.properties.severity?.toLowerCase()}`}
    onClick={() => handleAlertClick(alert)}
  >
    <div className="alert-event">{alert.properties.event}</div>
    <div className="alert-headline">{alert.properties.headline}</div>
  </div>
))}
```

**Step 2: Run build to verify**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Test manually in development**

Run: `npm run dev`
Actions:
1. Open http://localhost:5173
2. Wait for alerts to load
3. Click an alert in the sidebar
Expected: Map smoothly flies to show the alert area

**Step 4: Commit the onClick handler**

```bash
git add src/WeatherMap.jsx
git commit -m "feat: wire up alert click to map navigation

Connect onClick handler to alert items so clicking flies to area.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add Keyboard Accessibility

**Files:**
- Modify: `src/WeatherMap.jsx:299-308` (alert items)

**Step 1: Add keyboard event handler and ARIA attributes**

Update the alert items to support keyboard navigation:

```javascript
{alerts.map((alert, index) => (
  <div
    key={index}
    className={`alert-item severity-${alert.properties.severity?.toLowerCase()}`}
    onClick={() => handleAlertClick(alert)}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleAlertClick(alert);
      }
    }}
    role="button"
    tabIndex={0}
    aria-label={`Zoom to ${alert.properties.event} affected area`}
  >
    <div className="alert-event">{alert.properties.event}</div>
    <div className="alert-headline">{alert.properties.headline}</div>
  </div>
))}
```

**Step 2: Run build to verify**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Test keyboard navigation**

Run: `npm run dev`
Actions:
1. Open http://localhost:5173
2. Press Tab to navigate to an alert item
3. Press Enter or Space
Expected: Map flies to the alert area

**Step 4: Commit accessibility enhancements**

```bash
git add src/WeatherMap.jsx
git commit -m "feat: add keyboard accessibility to alerts

Add onKeyDown handler for Enter/Space keys, role=button, tabIndex,
and aria-label for screen reader support.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Enhance CSS Interactivity Styles

**Files:**
- Modify: `src/WeatherMap.css:169-213` (alert item styles)

**Step 1: Add focus and active states to alert-item**

Update the `.alert-item` styles (around line 169):

```css
.alert-item {
  padding: 12px;
  border-radius: 8px;
  border-left: 4px solid;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, background-color 0.2s;
  outline: none;
}

.alert-item:hover {
  transform: translateX(4px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.alert-item:active {
  transform: scale(0.98) translateX(4px);
}

.alert-item:focus-visible {
  outline: 2px solid #3a86ff;
  outline-offset: 2px;
}
```

**Step 2: Add dark mode hover enhancement**

Add after the dark mode alert styles (around line 350):

```css
.controls-panel.dark .alert-item:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.controls-panel.dark .alert-item:focus-visible {
  outline-color: #88bbdd;
}
```

**Step 3: Run build to verify**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Test visual feedback**

Run: `npm run dev`
Actions:
1. Hover over alert items - should see transform and shadow
2. Click alert item - should see slight scale down
3. Tab to alert - should see blue outline
4. Toggle dark mode - test hover in dark theme
Expected: All states show appropriate visual feedback

**Step 5: Commit CSS enhancements**

```bash
git add src/WeatherMap.css
git commit -m "style: enhance alert item interactivity

Add active state scale effect, focus-visible outline for keyboard
users, and dark mode hover enhancement.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Manual Testing and Verification

**Files:**
- None (manual testing only)

**Step 1: Comprehensive functionality test**

Run: `npm run dev`

Test checklist:
- [ ] Click alert in sidebar flies to correct area
- [ ] Animation is smooth (1.5s duration)
- [ ] Alert polygon fits in viewport with padding
- [ ] Hover shows transform and shadow
- [ ] Active click shows scale effect
- [ ] Tab navigation works
- [ ] Enter key triggers navigation
- [ ] Space key triggers navigation
- [ ] Focus outline visible when tabbing
- [ ] Works in light theme
- [ ] Works in dark theme
- [ ] Multiple rapid clicks handled gracefully
- [ ] No console errors

**Step 2: Test edge cases**

Test scenarios:
- Click multiple different alerts in sequence
- Rapidly click the same alert multiple times
- Click alert while already viewing that area
- Interrupt animation by manually panning
- Test with both small and large alert polygons

**Step 3: Verify mobile/touch behavior**

If possible, test on mobile or use browser dev tools device emulation:
- Touch interaction triggers navigation
- Hover states don't interfere on touch devices

**Step 4: Document completion**

Create a simple test report noting:
- All items from checklist completed successfully
- Any issues discovered and resolved
- Screenshots or notes about visual feedback

---

## Testing Checklist (Comprehensive)

### Functionality
- [ ] Click alert navigates to correct map area
- [ ] Animation duration is smooth (1.5 seconds)
- [ ] Full alert polygon visible with padding
- [ ] Works with different alert severities
- [ ] Multiple clicks handled correctly
- [ ] Rapid clicks don't break animation

### Accessibility
- [ ] Tab key navigates to alert items
- [ ] Enter key triggers navigation
- [ ] Space key triggers navigation
- [ ] Focus indicator visible
- [ ] Screen reader announces button role
- [ ] ARIA label descriptive

### Visual Feedback
- [ ] Cursor changes to pointer on hover
- [ ] Hover state shows transform and shadow
- [ ] Active state shows scale effect
- [ ] Focus outline visible for keyboard users
- [ ] Works in light theme
- [ ] Works in dark theme

### Edge Cases
- [ ] No errors if alert has no geometry
- [ ] Animation can be interrupted
- [ ] Works with statewide alerts (large)
- [ ] Works with small localized alerts
- [ ] No console errors or warnings

### Performance
- [ ] No lag when clicking alerts
- [ ] Animation is GPU-accelerated (smooth 60fps)
- [ ] No memory leaks with repeated clicks
- [ ] Build size unchanged (no new dependencies)

---

## Implementation Notes

**Development Environment:**
- Working directory: `.worktrees/clickable-weather-alerts`
- Branch: `feature/clickable-weather-alerts`
- Base: `main` branch at commit `65a23ff`

**Dependencies:**
- No new dependencies required
- Uses existing MapLibre GL JS
- Uses existing alert GeoJSON data

**Build Commands:**
- Development: `npm run dev` (http://localhost:5173)
- Production build: `npm run build`
- Preview build: `npm run preview`

**Manual Testing Required:**
Since project has no automated test suite, thorough manual testing is essential after each task.

---

## Post-Implementation

After all tasks complete:

1. **Final verification build**
   ```bash
   npm run build
   npm run preview
   ```

2. **Return to main worktree**
   ```bash
   cd ../../  # Back to main worktree
   ```

3. **Use finishing-a-development-branch skill** (REQUIRED)
   - Reviews work against plan
   - Guides merge/PR decision
   - Cleanup worktree if needed

---

## Success Criteria

Implementation is complete when:
- [x] Click handler calculates bounds correctly
- [x] Map flies to alert area with smooth animation
- [x] Keyboard navigation fully functional
- [x] Visual feedback clear in both themes
- [x] No console errors
- [x] All manual tests pass
- [x] Code committed to feature branch
- [x] Production build succeeds
