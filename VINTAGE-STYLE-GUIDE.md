# VT LiveView - Vintage Topographic Style Guide

## Overview
VT LiveView uses a 1960s-70s vintage topographic map aesthetic inspired by classic USGS maps and national park signage. The design balances period-authentic styling with modern readability and usability.

**Last Updated:** 2026-01-27

---

## Color Palette

### Primary Colors

**Vermont Olive-Sage Green** - The core brand color
- Main: `#5d7c5a` - Headers, active text, primary UI elements
- Light: `#7a9576` - Secondary text, icon colors
- Lighter: Calculated lighter shade for borders
- Subtle: `rgba(93, 124, 90, 0.12)` - Borders, dividers
- Faint: `rgba(93, 124, 90, 0.06)` - Button backgrounds, inactive states

**Usage:**
```css
color: var(--color-vermont-green);           /* Main green */
color: var(--color-vermont-green-light);     /* Lighter variant */
border: 1px solid var(--color-vermont-green-subtle);   /* Borders */
background: var(--color-vermont-green-faint);          /* Inactive buttons */
```

### Background Colors

**Cream/Beige Tones** - Warm, vintage paper feel
- Primary: `#fbfdf4` - Main background gradient start
- Secondary: `#f9fbf2` - Main background gradient end
- Panel gradient: Fully opaque, no transparency
  ```css
  --gradient-panel: linear-gradient(180deg, #fbfdf4 0%, #f9fbf2 100%);
  ```

**CRITICAL:** Panels use 100% opaque backgrounds (no rgba transparency) to ensure consistent color regardless of map content behind them.

### Cyan Blue Accent

**Reserved for special interactive elements only** - `#cef3e6`

**Use sparingly on:**
- Radar timeline dots (active state)
- Slider thumbs
- Success checkmarks
- Header divider line

**With glow effect:**
```css
box-shadow: 0 0 12px rgba(206, 243, 230, 0.6);
```

**Important:** Do not overuse - user feedback: "Might be overdoing the cyan glow"

### Incident/Filter Chip Colors

All chips use **muted vintage colors** with controlled opacity for subtlety:

| Type | Color | Background Opacity | Border Opacity |
|------|-------|-------------------|----------------|
| Weather Stations | Soft blue | `rgba(88, 139, 174, 0.2)` | `rgba(88, 139, 174, 0.4)` |
| Accidents | Terracotta red | `rgba(204, 102, 82, 0.2)` | `rgba(204, 102, 82, 0.4)` |
| Construction | Goldenrod | `rgba(218, 165, 32, 0.2)` | `rgba(218, 165, 32, 0.4)` |
| Closures | Rose pink | `rgba(219, 112, 147, 0.2)` | `rgba(219, 112, 147, 0.4)` |
| Flooding | Teal | `rgba(72, 157, 153, 0.2)` | `rgba(72, 157, 153, 0.4)` |
| Hazards | Burnt orange | `rgba(214, 126, 44, 0.2)` | `rgba(214, 126, 44, 0.4)` |

**Key principle:** Background at 0.2, border at 0.4 opacity for subtle but distinguishable active states.

### Radar Intensity Legend

Vintage pastel gradient from light to severe precipitation:

```css
linear-gradient(
  to right,
  #b8d4e6 0%,      /* Hazy blue - light rain */
  #a8c9db 15%,
  #98bed0 25%,
  #b8d4b0 40%,     /* Pale sage - moderate */
  #c8d9a8 50%,
  #e8d89e 60%,     /* Creamy butter yellow - heavy */
  #e8bc8e 70%,
  #dba088 80%,     /* Soft peachy terracotta - very heavy */
  #cc8678 90%,
  #b87268 100%     /* Dusty rose/salmon - severe */
);
```

**Design philosophy:** Light and vintage looking, not muddy or neon.

---

## Typography

### Font Families

**Montserrat** - Bold, uppercase section headers
```css
font-family: 'Montserrat', sans-serif;
font-weight: 700;
letter-spacing: 0.08em;
text-transform: uppercase;
```
**Usage:** "WEATHER RADAR", "MAP FEATURES"

**Space Mono** - Monospace for technical/data elements
```css
font-family: 'Space Mono', monospace;
```
**Usage:**
- Main title "VT LIVE VIEW" (letter-spacing: 0.15em)
- Section labels (letter-spacing: 0.10em)
- Temperature values
- Forecast temperatures
- Technical labels

**Public Sans** - Body text and UI elements
```css
font-family: var(--font-family);  /* Public Sans */
```
**Usage:** Default for most interface text

### Text Colors

Following the olive-sage green palette:
```css
--color-vermont-green: #5d7c5a;        /* Primary headers, active text */
--color-vermont-green-light: #7a9576;  /* Secondary text, icons */
```

Avoid generic grays - always use the green palette for cohesion.

---

## Interactive Elements

### Buttons & Controls

**Inactive state** (default):
```css
background: var(--color-vermont-green-faint);     /* rgba(93, 124, 90, 0.06) */
border: 1px solid var(--color-vermont-green-subtle); /* rgba(93, 124, 90, 0.12) */
color: var(--color-vermont-green);
```

**Hover state:**
```css
background: var(--color-vermont-green-subtle);
border-color: var(--color-vermont-green-lighter);
transform: translateY(-1px);
```

**Active/Pressed state** - Letterpress effect for tactile feel:
```css
transform: translateY(0);
box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
```

**Examples:** Radar controls (play, reload, skip), filter chips when active, visibility toggles

### Slider Thumbs

Cyan blue with specific styling:
```css
width: 20px;
height: 20px;
border-radius: var(--radius-full);
background: #cef3e6 !important;  /* Requires !important to override browser defaults */
border: 2px solid rgba(55, 65, 81, 0.2);
box-shadow:
  0 0 8px rgba(206, 243, 230, 0.4),
  0 2px 4px rgba(0, 0, 0, 0.1) !important;
```

**Interaction states:**
- Hover: `transform: scale(1.1)`
- Active: `transform: scale(0.95)`

**Critical:** Both webkit and moz vendor prefixes needed, with !important flags.

### Filter Chips

**Inactive:**
```css
background: var(--color-vermont-green-faint);
border: 1px solid var(--color-vermont-green-subtle);
color: var(--color-vermont-green);
```

**Active:**
- Category-specific color at 0.2 background / 0.4 border opacity
- Letterpress inset shadow: `inset 0 1px 2px rgba(0, 0, 0, 0.1)`
- Drop shadow (NOT glow): `0 2px 4px rgba([category-color], 0.18)`
- Full border-radius for pill shape

### Forecast Cards (Weather Widget)

Styled to match filter chip aesthetic:
```css
background: var(--color-vermont-green-faint);
border: 1px solid var(--color-vermont-green-subtle);
box-shadow: 0 2px 4px rgba(93, 124, 90, 0.08);
```

**Hover:**
```css
transform: translateY(-1px);
background: var(--color-vermont-green-subtle);
border-color: var(--color-vermont-green-lighter);
```

**Sizing:**
- Width: 70px
- Padding: `var(--space-3) var(--space-2)`
- Icon size: 28px
- Gap between cards: `var(--space-3)`

---

## Decorative Elements

### Section Headers

Montserrat font with decorative gradient underlines:
```css
h3 {
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: var(--font-size-xl);
  text-transform: uppercase;
  color: var(--color-vermont-green);
  letter-spacing: 0.08em;
  position: relative;
  padding-bottom: var(--space-3);
}

h3::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg,
    rgba(93, 124, 90, 0.4) 0%,
    rgba(93, 124, 90, 0.15) 85%,
    transparent 100%
  );
}
```

### Main Header Divider

Cyan blue gradient with hazy glow:
```css
border-bottom: 3px solid transparent;
border-image: linear-gradient(90deg,
  transparent 0%,
  rgba(206, 243, 230, 0.4) 20%,
  rgba(206, 243, 230, 0.8) 50%,
  rgba(206, 243, 230, 0.4) 80%,
  transparent 100%
) 1;
box-shadow: 0 3px 20px rgba(206, 243, 230, 0.35);
```

### Success Checkmark

Cyan blue with dark outline for visibility:
```css
color: #cef3e6;
text-shadow:
  -1px -1px 0 rgba(55, 65, 81, 0.4),
  1px -1px 0 rgba(55, 65, 81, 0.4),
  -1px 1px 0 rgba(55, 65, 81, 0.4),
  1px 1px 0 rgba(55, 65, 81, 0.4),    /* 4-directional outline */
  0 2px 4px rgba(55, 65, 81, 0.3),    /* Drop shadow */
  0 0 12px rgba(206, 243, 230, 0.6);  /* Cyan glow */
```

---

## Spacing & Layout

### Compacted Design Philosophy

The vintage aesthetic uses **tighter spacing** than modern designs:
- Radar section: Reduced margins from `space-7` to `space-4`
- Weather widget: Reduced padding from `space-7/space-8` to `space-5/space-6`
- Forecast section: Reduced from `space-5` to `space-4`

### Dividers

- **Use sparingly** - removed divider lines between major sections
- Section dividers: `1px solid var(--color-vermont-green-subtle)`
- Attribution section: **Removed entirely** to reduce UI height

---

## Panel Backgrounds

### Critical Configuration

Both controls panel and weather widget use identical styling:

```css
background: var(--gradient-panel);
/* NO backdrop-filter - removed for consistent appearance */
/* NO inset shadow - removed as it washes out the background */
box-shadow: var(--shadow-lg);  /* or shadow-xl for larger panels */
```

**Gradient definition:**
```css
--gradient-panel: linear-gradient(180deg, #fbfdf4 0%, #f9fbf2 100%);
```

**CRITICAL DECISIONS:**
1. **100% opaque** - No rgba transparency to ensure consistent color
2. **No backdrop-filter blur** - Removed because it caused color inconsistency
3. **No inset shadows** - Removed `--shadow-inset` as it created a washed-out overlay
4. **Solid hex colors only** - Ensures panels look identical regardless of map behind them

**Problem solved:** Controls panel previously looked faded compared to weather widget due to inset shadow overlay and semi-transparent background.

---

## Animations & Transitions

### Easing

Use organic, vintage-appropriate timing:
```css
transition: all var(--transition-base);  /* cubic-bezier(0.4, 0, 0.2, 1) */
```

Avoid snappy or bouncy animations - keep them smooth and subtle.

### Weather Widget Expand Indicator

Subtle, slow bounce animation:
```css
animation: subtle-bounce 3s ease-in-out infinite;

@keyframes subtle-bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateX(-50%) translateY(0);
  }
  40% {
    transform: translateX(-50%) translateY(-2px);  /* Small movement */
  }
  60% {
    transform: translateX(-50%) translateY(-1px);
  }
}
```

**Design note:** 3s duration (slower than default 2s) for gentle vintage feel.

---

## Design Principles

### Core Philosophy

1. **Tactile Physicality** - Buttons feel like physical objects being pressed (letterpress effect)
2. **Organic Easing** - Smooth, natural transitions; avoid snappy/bouncy
3. **Subtle Not Flashy** - Effects should enhance without being obvious
4. **Readability First** - Dark text on light backgrounds, good contrast
5. **Vintage But Functional** - Period aesthetic shouldn't compromise usability
6. **Cyan Blue Restraint** - Use sparingly for maximum impact
7. **Consistent Transparency** - Active chips at 0.2 background, 0.4 border
8. **Opaque Panels** - No transparency in panel backgrounds

### What NOT To Do

❌ **Harsh neon glows or bright colors** - Keep everything muted and vintage
❌ **Muddy, dark colors that lack distinction** - Balance between muted and readable
❌ **Over-use of cyan blue accent** - Reserve for special moments only
❌ **Fast, snappy animations** - Use slower, organic timing
❌ **Heavy drop shadows** - Keep shadows subtle (2-4px)
❌ **Generic system fonts** - Always use Montserrat, Space Mono, or Public Sans
❌ **High opacity backgrounds** - Semi-transparent panels cause color inconsistency
❌ **Backdrop blur effects** - Removed from all panels for color consistency
❌ **Inset shadows on panels** - Creates washed-out appearance
❌ **Multiple shadow layers** - Simplified to single shadow per element

---

## Component-Specific Styling

### Weather Widget

**Temperature Display:**
```css
.temp-value {
  font-family: 'Space Mono', monospace;
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-6xl);
  color: var(--color-vermont-green);
  letter-spacing: -0.02em;
}

.temp-unit {
  font-family: 'Space Mono', monospace;
  color: var(--color-vermont-green-light);
}
```

**Weather Metrics:**
```css
.weather-metrics {
  font-size: var(--font-size-md);
  color: var(--color-vermont-green);
}

.weather-metrics svg {
  color: var(--color-vermont-green-light);
}
```

**Forecast Title:**
```css
.forecast-title {
  font-family: 'Space Mono', monospace;
  font-size: var(--font-size-sm);
  text-transform: uppercase;
  letter-spacing: 0.10em;
  color: var(--color-vermont-green);
}
```

### Radar Controls

**Play Button** (always "pressed"):
```css
.play-button {
  background: var(--color-vermont-green-subtle) !important;
  border-color: var(--color-vermont-green-lighter) !important;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}
```

**Timeline Dots:**
- Inactive: Transparent background, cream border
- Active: Cyan blue (#cef3e6) with glow
- Nowcast (forecast): Dashed border style

### Filter Chips

**Inactive chips match radar buttons:**
```css
background: var(--color-vermont-green-faint);
border: 1px solid var(--color-vermont-green-subtle);
color: var(--color-vermont-green);
```

**Active chips get category color + letterpress:**
```css
background: rgba([category-color], 0.2);
border-color: rgba([category-color], 0.4);
box-shadow:
  inset 0 1px 2px rgba(0, 0, 0, 0.1),
  0 2px 4px rgba([category-color], 0.18);
```

---

## Responsive Design

### Mobile Adjustments

**Weather Widget:**
```css
@media (max-width: 768px) {
  .current-weather {
    padding: var(--space-4) var(--space-5);
  }

  .temp-value {
    font-size: var(--font-size-5xl);
  }

  .weather-metrics {
    font-size: var(--font-size-sm);
  }
}
```

**Controls Panel:**
- Full width on mobile with slide-in animation
- Reduced padding for compact spacing
- Scrollable content area with thin custom scrollbar

---

## Implementation Notes

### CSS Variable Usage

Always prefer CSS variables for consistency:
```css
/* CORRECT */
color: var(--color-vermont-green);
padding: var(--space-5);
border-radius: var(--radius-lg);

/* AVOID */
color: #5d7c5a;
padding: 12px;
border-radius: 8px;
```

### Browser Compatibility

**Slider thumbs require vendor prefixes:**
```css
/* Both needed */
::-webkit-slider-thumb { }
::-moz-range-thumb { }
```

**Scrollbar styling:**
```css
/* Standard */
scrollbar-width: thin;
scrollbar-color: var(--color-vermont-tan-light) transparent;

/* Webkit */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-thumb { }
```

### Z-Index Layers

```css
--z-base: 1;
--z-dropdown: 1000;
--z-sticky: 1100;
--z-fixed: 1200;
--z-modal-backdrop: 1300;
--z-modal: 1400;
--z-popover: 1500;
--z-tooltip: 1600;
```

---

## Common Patterns

### Adding a New Section Header

```css
.section-header {
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: var(--font-size-xl);
  text-transform: uppercase;
  color: var(--color-vermont-green);
  letter-spacing: 0.08em;
  position: relative;
  padding-bottom: var(--space-3);
  margin-bottom: var(--space-5);
}

.section-header::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg,
    rgba(93, 124, 90, 0.4) 0%,
    rgba(93, 124, 90, 0.15) 85%,
    transparent 100%
  );
}
```

### Adding a New Button

```css
.vintage-button {
  background: var(--color-vermont-green-faint);
  border: 1px solid var(--color-vermont-green-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  color: var(--color-vermont-green);
  transition: var(--transition-base);
}

.vintage-button:hover:not(:disabled) {
  background: var(--color-vermont-green-subtle);
  border-color: var(--color-vermont-green-lighter);
  transform: translateY(-1px);
}

.vintage-button:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

.vintage-button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
```

### Adding a New Filter Chip

```css
.filter-chip {
  background: var(--color-vermont-green-faint);
  border: 1px solid var(--color-vermont-green-subtle);
  border-radius: var(--radius-full);
  padding: var(--space-2) var(--space-4);
  color: var(--color-vermont-green);
  transition: var(--transition-base);
}

.filter-chip.active {
  background: rgba([category-color], 0.2);
  border-color: rgba([category-color], 0.4);
  color: [category-dark-color];
  box-shadow:
    inset 0 1px 2px rgba(0, 0, 0, 0.1),
    0 2px 4px rgba([category-color], 0.18);
}
```

---

## Testing Checklist

When adding new UI elements, verify:

- [ ] Uses olive-sage green palette (no generic grays)
- [ ] Typography uses Montserrat, Space Mono, or Public Sans
- [ ] Inactive buttons match radar control styling
- [ ] Active states include letterpress effect
- [ ] Hover states use `translateY(-1px)`
- [ ] Transitions use organic timing
- [ ] Spacing follows compacted design (space-3, space-4, space-5)
- [ ] No cyan blue accent overuse
- [ ] Borders use `--color-vermont-green-subtle`
- [ ] Panel backgrounds are 100% opaque
- [ ] No backdrop-filter blur on panels
- [ ] No inset shadows on panels
- [ ] Mobile responsive adjustments included

---

## Version History

- **2026-01-27:** Complete style guide based on vintage topographic redesign
  - Documented weather widget styling
  - Panel background opacity fixes
  - Removal of backdrop-filter and inset shadows
  - Filter chip color refinements
  - Letterpress effect implementation
  - Radar intensity legend colors
  - Success checkmark styling
  - Typography choices and usage

---

## Questions?

For implementation questions or clarification, reference:
- `/src/styles/design-system.css` - CSS variable definitions
- `/src/components/RadarOverlay.css` - Radar controls styling example
- `/src/components/TravelLayer.css` - Filter chip styling example
- `/src/components/CurrentWeather.css` - Weather widget styling example
