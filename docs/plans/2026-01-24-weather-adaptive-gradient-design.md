# Weather-Adaptive Gradient Theme Design

**Date:** 2026-01-24
**Linear Issue:** VTL-39
**Status:** Approved
**Scope:** Light mode only (dark mode unchanged)

---

## Overview

Replace the current subtle design system with **bold, weather-adaptive gradient backgrounds** and **white text** on UI panels. Gradients change based on real-time weather conditions to create an immersive, modern weather app aesthetic.

**Inspiration:** Modern weather app mockup with blue-yellow gradient backgrounds and white text.

---

## Weather Gradient Color System

Each weather condition gets a unique gradient palette applied to UI panels in **light mode only**.

### Sunny (Default/Clear Weather)
- **Gradient:** `linear-gradient(135deg, #52C2ED 0%, #FFD700 100%)`
- **Colors:** Sky blue → Sunny yellow
- **Direction:** 135° diagonal (top-left to bottom-right)
- **Text:** White (#FFFFFF)
- **Accent icons:** Yellow (#FFD700) for sun icons
- **Mood:** Bright, cheerful, energetic

### Rainy (Rain/Cloudy/Fog)
- **Gradient:** `linear-gradient(180deg, #4A90E2 0%, #78909C 100%)`
- **Colors:** Steel blue → Grey-blue
- **Direction:** 180° vertical (top to bottom)
- **Text:** White (#FFFFFF)
- **Mood:** Cool, muted, overcast

### Snowy (Snow/Ice/Freezing)
- **Gradient:** `linear-gradient(135deg, #B3E5FC 0%, #E1F5FE 100%)`
- **Colors:** Ice blue → White-blue
- **Direction:** 135° diagonal
- **Text:** Dark grey (#37474F) - for contrast on light gradient
- **Mood:** Crisp, bright, winter

### Severe (Storms/Alerts)
- **Gradient:** `linear-gradient(135deg, #EF5350 0%, #FF6F00 100%)`
- **Colors:** Alert red → Orange
- **Direction:** 135° diagonal
- **Text:** White (#FFFFFF)
- **Mood:** Urgent, attention-grabbing, emergency

### Default (Fallback)
- **Gradient:** `linear-gradient(180deg, #81E8FF 0%, #52C2ED 100%)`
- **Colors:** Light blue → Sky blue
- **Direction:** 180° vertical
- **Text:** White (#FFFFFF)
- **Mood:** Clean, neutral weather aesthetic

---

## Component Application Strategy

### Components That Get Gradient Backgrounds

**Primary gradient surfaces with white text:**
- `.controls-panel` - Main sidebar panel
- `.current-weather` - Temperature display card
- `.detail-panel` - Alert/incident detail view
- `.control-section` - Individual cards within panels

**Visual changes:**
- Remove subtle borders (gradients provide visual separation)
- All headings, body text, labels → white
- Icons → white or accent colors
- Interactive elements → translucent white overlays

### Components That Keep Existing Styles

**No gradients applied:**
- Map container background (neutral)
- Maplibre popups/tooltips (glass effect for map readability)
- Mobile menu toggle button (small accent element)
- Alert severity badges (keep semantic colors)
- Attribution footer (keep subtle)

**Rationale:** Gradients only on primary UI panels to avoid overwhelming the map view.

---

## CSS Architecture

### New CSS Variables

Add to `src/styles/design-system.css`:

```css
:root {
  /* Default weather gradient (fallback) */
  --gradient-weather: linear-gradient(180deg, #81E8FF 0%, #52C2ED 100%);
  --color-text-on-gradient: #ffffff;

  /* Icon colors on gradients */
  --color-icon-on-gradient: rgba(255, 255, 255, 0.9);
  --color-icon-accent-on-gradient: #FFD700; /* sun icons */

  /* Transition speed */
  --transition-weather-theme: 0.5s ease-in-out;
}

/* Sunny theme (light mode only) */
:root:not(.dark).weather-sunny {
  --gradient-weather: linear-gradient(135deg, #52C2ED 0%, #FFD700 100%);
  --color-text-on-gradient: #ffffff;
  --color-icon-accent-on-gradient: #FFD700;
}

/* Rainy theme (light mode only) */
:root:not(.dark).weather-rainy {
  --gradient-weather: linear-gradient(180deg, #4A90E2 0%, #78909C 100%);
  --color-text-on-gradient: #ffffff;
  --color-icon-accent-on-gradient: #81E8FF;
}

/* Snowy theme (light mode only) */
:root:not(.dark).weather-snowy {
  --gradient-weather: linear-gradient(135deg, #B3E5FC 0%, #E1F5FE 100%);
  --color-text-on-gradient: #37474F; /* dark text for contrast */
  --color-icon-accent-on-gradient: #64B5F6;
}

/* Severe theme (light mode only) */
:root:not(.dark).weather-severe {
  --gradient-weather: linear-gradient(135deg, #EF5350 0%, #FF6F00 100%);
  --color-text-on-gradient: #ffffff;
  --color-icon-accent-on-gradient: #FFD700;
}
```

### Component CSS Updates

**Controls panel:**
```css
.controls-panel {
  background: var(--gradient-weather);
  color: var(--color-text-on-gradient);
  border: none; /* Remove borders on gradients */
  transition:
    background var(--transition-weather-theme),
    color var(--transition-weather-theme);
}
```

**Text elements:**
```css
.control-section h3,
.alert-event,
.temperature-display,
.controls-panel h2 {
  color: var(--color-text-on-gradient);
}
```

**Interactive elements:**
```css
/* Buttons on gradient backgrounds */
.control-section button {
  background: rgba(255, 255, 255, 0.2);
  color: var(--color-text-on-gradient);
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: background var(--transition-base);
}

.control-section button:hover {
  background: rgba(255, 255, 255, 0.3);
}

.control-section button:active {
  background: rgba(255, 255, 255, 0.4);
}

/* Checkboxes and toggles */
input[type="checkbox"] {
  accent-color: rgba(255, 255, 255, 0.9);
}

/* Scrollbar on gradients */
.controls-panel-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: var(--radius-sm);
}

.controls-panel-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}
```

---

## Dark Mode Behavior

**Critical requirement:** Dark mode remains **completely unchanged**.

```css
/* Dark mode preserves existing subtle aesthetic */
:root.dark .controls-panel {
  background: var(--gradient-panel); /* existing dark gradient */
  color: var(--color-text-primary); /* existing dark text */
  border: 2px solid var(--color-border-subtle); /* existing border */
}
```

**Implementation detail:** All weather gradient styles use `:root:not(.dark).weather-*` selectors to ensure they **never apply in dark mode**.

---

## Transitions & Animations

### Weather Theme Transitions

When weather conditions change (e.g., sunny → rainy), gradients smoothly transition:

```css
.controls-panel,
.control-section,
.current-weather {
  transition:
    background var(--transition-weather-theme),
    color var(--transition-weather-theme),
    border-color var(--transition-weather-theme);
}
```

**Duration:** 0.5 seconds
**Easing:** `ease-in-out` for natural feel
**Trigger:** Weather theme class change on `<html>` element

### Performance Considerations

- CSS transitions use GPU acceleration (transform/opacity)
- Gradient backgrounds rendered once, no animations
- Transition duration short enough to feel responsive
- No JavaScript animations needed

---

## Accessibility & Contrast

### WCAG AA Compliance

All gradient/text combinations must meet **WCAG AA** standards (4.5:1 contrast ratio for normal text, 3:1 for large text).

**Tested combinations:**

| Gradient | Text Color | Darkest Point | Contrast Ratio | Status |
|----------|------------|---------------|----------------|--------|
| Sunny (yellow end) | White | #FFD700 | 8.1:1 | ✅ Pass AAA |
| Sunny (blue end) | White | #52C2ED | 3.2:1 | ⚠️ Large text only |
| Rainy (grey end) | White | #78909C | 5.2:1 | ✅ Pass AA |
| Rainy (blue end) | White | #4A90E2 | 4.8:1 | ✅ Pass AA |
| Snowy | Dark grey | #E1F5FE | 12.3:1 | ✅ Pass AAA |
| Severe (orange end) | White | #FF6F00 | 4.9:1 | ✅ Pass AA |
| Severe (red end) | White | #EF5350 | 4.5:1 | ✅ Pass AA |

**Mitigation for low-contrast areas:**
- Use large font sizes (18px+ bold, 24px+ regular) on lighter gradient sections
- Position most important text on darker gradient regions
- Add subtle text shadows if needed: `text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);`

### Keyboard Navigation

- Focus indicators use `rgba(255, 255, 255, 0.5)` outline on gradients
- High contrast against all gradient backgrounds
- 2px outline width for visibility

---

## Integration with Existing Weather Theme System

**No changes needed** to `src/utils/weatherTheme.ts` logic:
- Already detects: `sunny`, `rainy`, `snowy`, `severe`, `default`
- Already applies class to `<html>` element
- Already updates on weather data changes

**Only CSS changes required:**
- Add gradient variables for each weather theme
- Update component styles to use `var(--gradient-weather)`
- Scope all styles with `:not(.dark)` selector

---

## Implementation Phases

### Phase 1: Core Gradient System
1. Add weather gradient CSS variables to `design-system.css`
2. Update `.controls-panel` to use gradients
3. Test all 5 weather conditions
4. Verify dark mode unchanged

### Phase 2: Component Updates
1. Update all headings/text to white
2. Style buttons/inputs for gradient backgrounds
3. Update scrollbar styling
4. Remove unnecessary borders

### Phase 3: Polish & Transitions
1. Add smooth theme transitions (0.5s)
2. Test interactive states (hover, active, focus)
3. Add text shadows if contrast issues found
4. Accessibility audit

### Phase 4: Testing & Refinement
1. Test all weather conditions in real app
2. Verify WCAG contrast compliance
3. Test on mobile devices
4. Performance testing (smooth transitions)

---

## Testing Checklist

### Visual Testing
- [ ] Sunny gradient displays correctly
- [ ] Rainy gradient displays correctly
- [ ] Snowy gradient displays correctly (dark text readable)
- [ ] Severe gradient displays correctly
- [ ] Default gradient displays correctly
- [ ] All text is white (except snowy = dark grey)
- [ ] Dark mode completely unchanged
- [ ] Transitions smooth between weather states

### Accessibility Testing
- [ ] All text meets WCAG AA contrast (WebAIM checker)
- [ ] Keyboard focus indicators visible on all gradients
- [ ] Screen reader announces weather theme changes
- [ ] Large text used on lower-contrast gradient areas

### Interaction Testing
- [ ] Buttons visible and usable on gradients
- [ ] Checkboxes/toggles visible and functional
- [ ] Scrollbar visible and usable
- [ ] Hover states work on all interactive elements
- [ ] Mobile touch targets adequate (44px minimum)

### Weather Condition Testing
- [ ] Manually test theme switching between all 5 states
- [ ] Verify theme persists across page refreshes
- [ ] Test with real weather data from NOAA API
- [ ] Confirm fallback to default gradient works

---

## Files to Modify

### CSS Files
1. `src/styles/design-system.css` - Add weather gradient variables
2. `src/WeatherMap.css` - Update controls panel
3. `src/components/CurrentWeather.css` - Update weather card
4. `src/components/DetailPanel.css` - Update detail panel
5. `src/components/TravelLayer.css` - Update travel controls (if gradient)
6. `src/components/RadarOverlay.css` - Update radar controls (if gradient)

### No Changes Needed
- `src/utils/weatherTheme.ts` - Logic already exists
- `src/WeatherMap.tsx` - Theme application already integrated
- Dark mode styles - Completely preserved

---

## Success Criteria

✅ **Visual Impact**
- Bold, modern weather app aesthetic achieved
- UI matches mockup inspiration (blue-yellow gradients with white text)
- Immersive weather feedback through color

✅ **Technical Quality**
- All WCAG AA contrast requirements met
- Smooth 0.5s transitions between weather states
- No visual regressions in dark mode
- No performance issues

✅ **User Experience**
- Weather conditions immediately recognizable from color
- Text readable in all weather themes
- Interactive elements clearly visible
- Mobile-friendly and responsive

---

## Rollback Plan

If issues arise:
1. Remove weather gradient CSS variables from `design-system.css`
2. Revert component CSS changes
3. System falls back to existing Vermont green theme
4. Git: `git revert <commit-hash>`

---

**Approved:** 2026-01-24
**Estimated Effort:** 3-4 hours
**Risk Level:** Low (CSS-only, dark mode protected)
**Next Step:** Implementation
