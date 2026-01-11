# Clickable Weather Alerts Design

**Date:** 2026-01-10
**Status:** Ready for Implementation

## Overview

Make weather advisory alerts in the sidebar clickable so users can fly to the affected area on the map with smooth animation. This creates an intuitive connection between the alert list and map visualization.

## Current State

- Weather alerts display as colored polygons on the map (lines 58-93 in WeatherMap.jsx)
- Alert polygons have click handlers that show popups (lines 96-122)
- Sidebar lists active alerts with event name and headline (lines 295-310)
- Alert list items are static, non-interactive elements

## Proposed Changes

### User Interaction Flow

1. User clicks an alert item in the sidebar
2. Map smoothly animates to show the full extent of the affected area
3. Alert polygon is fully visible with comfortable padding
4. User can see exactly where the alert applies geographically

### Implementation Details

#### 1. Add Click Handler Function

Create `handleAlertClick(alert)` in WeatherMap.jsx:

```javascript
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
      padding: 80,
      duration: 1500,
      maxZoom: 15
    }
  );
}, []);
```

**Parameters explained:**
- `padding: 80` - 80px buffer on all sides so alert doesn't touch screen edges
- `duration: 1500` - 1.5 second animation for smooth, comfortable flight
- `maxZoom: 15` - Prevents zooming too close on small polygons (street-level cap)

#### 2. Make Alert Items Clickable

Update alert rendering (lines 299-308):

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

#### 3. CSS Updates

Add to WeatherMap.css:

```css
.alert-item {
  cursor: pointer;
  transition: background-color 0.2s, transform 0.1s;
  border-radius: 4px;
  outline: none;
}

.alert-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.alert-item:active {
  transform: scale(0.98);
}

.alert-item:focus-visible {
  outline: 2px solid #3a86ff;
  outline-offset: 2px;
}

/* Dark theme adjustments */
.dark .alert-item:hover {
  background-color: rgba(255, 255, 255, 0.15);
}
```

## Technical Considerations

### Bounds Calculation

- Alert geometry format: `{ type: 'Polygon', coordinates: [[[lng, lat], ...]] }`
- Calculate min/max longitude and latitude from coordinate array
- Use MapLibre's `fitBounds()` with calculated bounds

### Animation Behavior

- MapLibre handles smooth interpolation automatically
- User can interrupt animation by manually interacting with map
- Rapid clicks will cancel previous animation and start new one
- Animation works seamlessly in both light and dark themes

### Edge Cases

| Case | Handling |
|------|----------|
| Alert has no geometry | Early return (skip action) |
| User already viewing area | Animation still runs (provides confirmation) |
| Very large alert (statewide) | `maxZoom: 15` prevents zooming too far out |
| Very small alert | `maxZoom: 15` prevents zooming too close |
| Multiple rapid clicks | MapLibre cancels previous, starts new (default behavior) |

## Accessibility

- **Keyboard navigation**: Alert items focusable with `tabIndex={0}`
- **Keyboard activation**: Enter and Space keys trigger click
- **Screen readers**: `role="button"` and descriptive `aria-label`
- **Focus indicators**: Visible outline on focus for keyboard users
- **Semantic HTML**: Proper button role for interactive elements

## User Experience

### Visual Feedback
1. Cursor changes to pointer on hover
2. Background lightens on hover
3. Slight scale effect on click (tactile feedback)
4. Smooth 1.5s map animation provides natural progress indication

### Performance
- No additional API calls required (geometry already loaded)
- Bounds calculation is fast (simple iteration)
- Animation is GPU-accelerated by MapLibre
- No impact on existing functionality

## Testing Checklist

- [ ] Click alert in sidebar flies to correct area
- [ ] Animation is smooth and comfortable
- [ ] All alert areas fit in viewport with padding
- [ ] Works with small and large alerts
- [ ] Hover states visible in both themes
- [ ] Keyboard navigation works (Tab, Enter, Space)
- [ ] Focus indicators visible
- [ ] Screen reader announces properly
- [ ] Works on mobile/touch devices
- [ ] Multiple rapid clicks handled gracefully
- [ ] No console errors or warnings

## Files Modified

1. `src/WeatherMap.jsx`
   - Add `handleAlertClick` function
   - Add onClick handler to alert items
   - Add keyboard event handlers
   - Add ARIA attributes

2. `src/WeatherMap.css`
   - Add cursor styles
   - Add hover/active states
   - Add focus indicators
   - Add theme-specific adjustments

## Future Enhancements (Not in Scope)

- Highlight alert polygon during flight animation
- Auto-open popup after flying to alert
- Close other popups before flying
- Animation speed based on distance
- Custom easing curves

## Implementation Estimate

**Complexity:** Low
**Risk:** Low
**Dependencies:** None

This is a straightforward enhancement using existing MapLibre features. No new dependencies or major refactoring required.
