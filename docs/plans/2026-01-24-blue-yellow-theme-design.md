# Blue/Yellow Theme Implementation Design

**Date:** 2026-01-24
**Linear Issues:** VTL-39, VTL-40
**Approach:** Option A - Replace green baseline, keep weather-adaptive system

## Overview

Replace the Vermont green theme with a modern blue/yellow color scheme while preserving the existing weather-adaptive theming system. Blue serves as the primary accent color, yellow provides highlights and special emphasis.

## Color Palette

### Primary Colors (Default/Baseline Theme)

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| **Sky Blue** | Primary | #52C2ED | Main accent color, buttons, primary borders, links |
| **Light Blue** | Accent | #81E8FF | Secondary highlights, hover states, subtle accents |
| **Dark Blue** | Active | #3A7AE0 | Active states, pressed buttons, focus indicators |
| **Sunny Yellow** | Highlight | #FFD700 | Sun icons, warnings, special badges, "now" indicators |

### Gradient Definitions

```css
--gradient-primary: linear-gradient(135deg, #52C2ED 0%, #81E8FF 100%);
--gradient-sky: linear-gradient(180deg, #81E8FF 0%, #52C2ED 100%);
--gradient-sunny: linear-gradient(90deg, #FFD700 0%, #FDB813 100%);
```

## Implementation Strategy

### Phase 1: Update Design System Variables

**File:** `src/styles/design-system.css`

Replace all Vermont green variables in `:root` (light mode) with blue equivalents:

```css
/* OLD - Remove */
--color-vermont-green: #15803d;
--color-vermont-green-light: #22c55e;
--color-accent-primary: #15803d;

/* NEW - Add */
--color-sky-blue: #52C2ED;
--color-sky-blue-light: #81E8FF;
--color-sky-blue-dark: #3A7AE0;
--color-sunny-yellow: #FFD700;
--color-accent-primary: #52C2ED;
--color-accent-hover: #3A7AE0;
```

### Phase 2: Update Weather Theme Overrides

**Weather themes remain unchanged:**
- Sunny theme: Keep golden yellow (#FDB813)
- Rainy theme: Keep steel blue (#4A90E2)
- Snowy theme: Keep ice blue (#64B5F6)
- Severe theme: Keep alert red (#EF5350)

**Rationale:** Weather themes are contextual overlays. They should maintain their distinct identities to provide clear weather feedback.

### Phase 3: Component Updates

#### Buttons
- Primary buttons: Blue background (#52C2ED)
- Hover: Dark blue (#3A7AE0)
- Active/pressed: Darker blue with reduced opacity

#### Icons
- Default icons: Use text color
- Sun icons: Sunny yellow (#FFD700)
- Weather-related: Context-appropriate colors

#### Borders & Shadows
- Default borders: Sky blue with low opacity
- Shadows: Blue-tinted instead of gray
- Glow effects: Sky blue

### Phase 4: Dark Mode Adjustments

Dark mode should use **muted blues** instead of green:

```css
:root.dark {
  --color-accent-primary: #81E8FF;  /* Lighter blue for dark bg */
  --color-accent-hover: #52C2ED;
  /* Remove all green references */
}
```

## Migration Checklist

- [ ] Update `:root` CSS variables in design-system.css
- [ ] Update `:root.dark` CSS variables
- [ ] Test all buttons (primary, secondary, disabled states)
- [ ] Test all form controls (inputs, checkboxes, toggles)
- [ ] Test borders and dividers
- [ ] Test shadows and glow effects
- [ ] Verify weather themes still override correctly
- [ ] Check contrast ratios (WCAG AA compliance)
- [ ] Test dark mode thoroughly
- [ ] Update documentation

## Files to Modify

1. **src/styles/design-system.css** - Main color system (lines 22-252, 259-362)
2. **docs/design-system.md** - Update documentation to reference blue/yellow
3. **docs/weather-adaptive-themes.md** - Note that default theme is now blue/yellow

## Files NOT to Modify

- `src/utils/weatherTheme.ts` - No changes needed
- `src/WeatherMap.tsx` - No changes needed (uses CSS variables)
- Component files - Should automatically pick up new colors via CSS variables

## Color Mapping Reference

| Old (Green) | New (Blue) | Variable |
|-------------|-----------|----------|
| #15803d (forest green) | #52C2ED (sky blue) | --color-accent-primary |
| #166534 (dark green) | #3A7AE0 (dark blue) | --color-accent-hover |
| #22c55e (light green) | #81E8FF (light blue) | --color-accent-secondary |
| rgba(34, 197, 94, 0.25) | rgba(82, 194, 237, 0.25) | --color-accent-subtle |
| rgba(34, 197, 94, 0.1) | rgba(82, 194, 237, 0.1) | --color-accent-faint |

## Testing Strategy

### Visual Testing
1. Load app in light mode → Should see blue accents
2. Toggle to dark mode → Should see muted blue accents
3. Wait for weather data → Weather themes should override baseline
4. Test all interactive elements (buttons, inputs, toggles)
5. Check popup/modal styling

### Contrast Testing
- Run axe DevTools or WAVE
- Verify all text meets WCAG AA (4.5:1 minimum)
- Test yellow highlights for readability

### Cross-Browser Testing
- Chrome/Edge (Chromium)
- Firefox
- Safari

## Success Criteria

- ✅ No green colors visible in default state
- ✅ Blue used for all primary accents
- ✅ Yellow used sparingly for highlights
- ✅ Weather themes still work correctly
- ✅ Dark mode uses muted blues
- ✅ All contrast ratios meet WCAG AA
- ✅ Smooth transitions between themes

## Rollback Plan

If issues arise:
1. Revert `src/styles/design-system.css` changes
2. Git: `git checkout HEAD -- src/styles/design-system.css`
3. Original green theme will be restored

---

**Approved:** Pending
**Estimated Effort:** 2-3 hours
**Risk Level:** Low (CSS-only changes, uses existing variable system)
