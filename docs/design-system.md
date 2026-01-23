# VT-LiveView Design System

This document describes the design tokens and CSS custom properties used throughout VT-LiveView.

## Overview

The design system is defined in `src/styles/design-system.css` and provides:

- **Color tokens** for light and dark modes
- **Spacing scale** (condensed, 4px base)
- **Typography scale** (condensed sizes)
- **Border radius tokens**
- **Shadow tokens**
- **Transition presets**
- **Z-index scale**

Variables automatically switch between light/dark mode based on the `.dark` class on the root element.

## Usage

```css
/* Use variables instead of hardcoded values */
.my-component {
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  transition: var(--transition-base);
}

/* No need for .dark selector - variables handle it */
```

---

## Color Tokens

### Background Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--color-bg-primary` | `rgba(244, 241, 232, 0.95)` | `rgba(28, 32, 36, 0.97)` | Main app background |
| `--color-bg-secondary` | `#f8f6f0` | `rgba(22, 26, 30, 0.97)` | Secondary surfaces |
| `--color-bg-tertiary` | `#ede9dd` | `rgba(18, 22, 26, 0.97)` | Tertiary surfaces |
| `--color-bg-glass` | `rgba(255, 255, 255, 0.85)` | `rgba(30, 30, 30, 0.9)` | Glassmorphic panels |
| `--color-bg-surface` | `rgba(255, 255, 255, 0.8)` | `rgba(36, 42, 46, 0.7)` | Card/section backgrounds |
| `--color-bg-overlay` | `rgba(0, 0, 0, 0.3)` | `rgba(0, 0, 0, 0.5)` | Modal backdrops |

### Text Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--color-text-primary` | `#333` | `#d4cfc4` | Body text |
| `--color-text-primary-alt` | `#1f2937` | `#f5f5f5` | Emphasized text |
| `--color-text-secondary` | `#4b5563` | `#c0c0c0` | Secondary text |
| `--color-text-tertiary` | `#6b7280` | `#b5b5b5` | Tertiary text |
| `--color-text-muted` | `#9ca3af` | `#a5a5a5` | Muted/disabled text |
| `--color-text-inverse` | `#ffffff` | `#1f2937` | Text on accent backgrounds |

### Vermont Theme Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--color-vermont-green` | `#2d4a2b` | `#b8cdb0` | Primary brand/headings |
| `--color-vermont-green-light` | `rgba(76, 111, 68, 0.8)` | `rgba(137, 165, 124, 0.8)` | Accent elements |
| `--color-vermont-green-subtle` | `rgba(76, 111, 68, 0.15)` | `rgba(137, 165, 124, 0.2)` | Subtle backgrounds |
| `--color-vermont-tan` | `rgba(139, 119, 85, 0.5)` | `rgba(137, 165, 124, 0.5)` | Borders/accents |

### Accent Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--color-accent-primary` | `#3b82f6` | `#d5d5d5` | Buttons, links, active states |
| `--color-accent-hover` | `#2563eb` | `#e5e5e5` | Hover states |
| `--color-accent-subtle` | `rgba(59, 130, 246, 0.1)` | `rgba(213, 213, 213, 0.1)` | Subtle highlights |

### Semantic Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--color-success` | `#22c55e` | `#60d060` | Success states |
| `--color-warning` | `#f59e0b` | `#f5d580` | Warning states |
| `--color-error` | `#ef4444` | `#ff8080` | Error states |
| `--color-info` | `#3b82f6` | `#6ba3ff` | Info states |

### Alert Severity Colors

| Severity | Light BG | Light Border | Dark BG | Dark Border |
|----------|----------|--------------|---------|-------------|
| Extreme | `#d9b5a0` | `#a84632` | `rgba(168, 70, 50, 0.25)` | `#d9856d` |
| Severe | `#d9c4a5` | `#b8753d` | `rgba(184, 117, 61, 0.25)` | `#e5a875` |
| Moderate | `#e5d8b8` | `#a68b45` | `rgba(166, 139, 69, 0.25)` | `#d4ba7d` |
| Minor | `#c4d4d0` | `#5a7c78` | `rgba(90, 124, 120, 0.25)` | `#8db5b0` |

### Border Colors

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--color-border-primary` | `rgba(139, 119, 85, 0.25)` | `rgba(137, 165, 124, 0.25)` | Primary borders |
| `--color-border-secondary` | `rgba(139, 119, 85, 0.2)` | `rgba(137, 165, 124, 0.2)` | Secondary borders |
| `--color-border-subtle` | `rgba(139, 119, 85, 0.12)` | `rgba(118, 141, 115, 0.15)` | Subtle borders |
| `--color-border-divider` | `rgba(210, 205, 190, 0.6)` | `rgba(255, 255, 255, 0.1)` | Dividers |

---

## Spacing Scale

Condensed spacing scale with 4px base unit:

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight spacing, icon gaps |
| `--space-2` | 6px | Small gaps |
| `--space-3` | 8px | Default component gaps |
| `--space-4` | 10px | Card internal padding |
| `--space-5` | 12px | Section padding |
| `--space-6` | 14px | Panel sections |
| `--space-7` | 16px | Large padding |
| `--space-8` | 20px | Panel padding |
| `--space-9` | 24px | Major sections |
| `--space-10` | 32px | Extra large |
| `--space-11` | 40px | Huge |
| `--space-12` | 48px | Maximum |

---

## Typography Scale

Condensed typography scale (reduced 1-2px from typical sizes):

| Token | Value | Usage |
|-------|-------|-------|
| `--font-size-xs` | 9px | Attribution, timestamps |
| `--font-size-sm` | 10px | Labels, badges |
| `--font-size-base` | 11px | Body text |
| `--font-size-md` | 12px | Emphasized body |
| `--font-size-lg` | 13px | Section headers |
| `--font-size-xl` | 14px | Card titles |
| `--font-size-2xl` | 16px | Panel headers |
| `--font-size-3xl` | 18px | Large headers |
| `--font-size-4xl` | 20px | Extra large |
| `--font-size-5xl` | 36px | Temperature display |

### Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `--font-weight-normal` | 400 | Body text |
| `--font-weight-medium` | 500 | Emphasized text |
| `--font-weight-semibold` | 600 | Subheadings |
| `--font-weight-bold` | 700 | Headings |

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `--line-height-tight` | 1.2 | Headings |
| `--line-height-snug` | 1.3 | Compact text |
| `--line-height-normal` | 1.4 | Body text |
| `--line-height-relaxed` | 1.5 | Readable text |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-xs` | 2px | Tiny elements |
| `--radius-sm` | 4px | Small elements, badges |
| `--radius-md` | 6px | Buttons, inputs |
| `--radius-lg` | 8px | Cards |
| `--radius-xl` | 12px | Sections, larger cards |
| `--radius-2xl` | 16px | Panels |
| `--radius-full` | 9999px | Pills, circular |

---

## Shadows

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.05)` | `... 0.2` | Subtle elevation |
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.08)` | `... 0.3` | Small elevation |
| `--shadow-md` | `0 2px 8px rgba(0,0,0,0.1)` | `... 0.4` | Medium elevation |
| `--shadow-lg` | `0 4px 16px rgba(0,0,0,0.12)` | `... 0.5` | Large elevation |
| `--shadow-xl` | `0 8px 32px rgba(0,0,0,0.15)` | `... 0.5` | Extra large |
| `--shadow-inset` | `inset 0 1px 0 rgba(255,255,255,0.5)` | `... 0.03` | Inner highlight |
| `--shadow-glow` | `0 0 8px rgba(59,130,246,0.4)` | `... accent` | Focus glow |

---

## Transitions

| Token | Value | Usage |
|-------|-------|-------|
| `--transition-fast` | `0.15s ease` | Micro-interactions |
| `--transition-base` | `0.2s ease` | Standard transitions |
| `--transition-slow` | `0.3s ease` | Panel slides |
| `--transition-bounce` | `0.3s cubic-bezier(0.4, 0, 0.2, 1)` | Bouncy effects |

---

## Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--z-base` | 1 | Base layer |
| `--z-dropdown` | 10 | Dropdowns |
| `--z-sticky` | 50 | Sticky elements |
| `--z-fixed` | 100 | Fixed elements |
| `--z-overlay` | 150 | Overlays |
| `--z-modal-backdrop` | 200 | Modal backdrops |
| `--z-modal` | 999 | Modals |
| `--z-popover` | 1000 | Popovers |
| `--z-tooltip` | 1100 | Tooltips |

---

## Component Tokens

Pre-defined component dimensions:

| Token | Value | Usage |
|-------|-------|-------|
| `--panel-max-width` | 340px | Controls panel width |
| `--panel-padding` | 20px | Panel internal padding |
| `--section-padding` | 14px | Section padding |
| `--card-padding` | 10px 12px | Card internal padding |
| `--chip-height` | 28px | Filter chip height |
| `--button-height` | 36px | Standard button height |
| `--input-height` | 36px | Standard input height |

---

## Migration Guide

### Replacing Hardcoded Colors

**Before:**
```css
.my-component {
  background: rgba(244, 241, 232, 0.95);
  color: #333;
  border: 1px solid rgba(139, 119, 85, 0.2);
}

.my-component.dark {
  background: rgba(28, 32, 36, 0.97);
  color: #d4cfc4;
  border-color: rgba(137, 165, 124, 0.2);
}
```

**After:**
```css
.my-component {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-primary);
}
/* No .dark selector needed! */
```

### Replacing Spacing Values

**Before:**
```css
.my-component {
  padding: 16px 20px;
  margin-bottom: 24px;
  gap: 8px;
}
```

**After:**
```css
.my-component {
  padding: var(--space-7) var(--space-8);
  margin-bottom: var(--space-9);
  gap: var(--space-3);
}
```

### Removing Redundant Font Imports

Remove these from individual component CSS files:
```css
/* DELETE THIS - now in design-system.css */
@import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&display=swap');
```

---

## Color Audit Results

### Files with Hardcoded Colors (to migrate)

| File | Estimated Colors | Priority |
|------|------------------|----------|
| `WeatherMap.css` | ~80 | High |
| `TravelLayer.css` | ~60 | High |
| `CurrentWeather.css` | ~50 | High |
| `RadarOverlay.css` | ~45 | Medium |
| `DetailPanel.css` | ~25 | Medium |
| `DetailViews.css` | ~40 | Medium |
| `WeatherStationsLayer.css` | ~20 | Low |
| `ThemeToggle.css` | ~10 | Low (start here) |

### Redundant Google Font Imports

Found in 6 files (to be removed after design-system.css is imported):
- `src/WeatherMap.css`
- `src/components/TravelLayer.css`
- `src/components/RadarOverlay.css`
- `src/components/CurrentWeather.css`
- `src/components/DetailPanel.css`
- `src/components/detail-views/DetailViews.css`

---

## Accessibility Notes

- Minimum font size: 9px (use sparingly, only for non-essential text)
- Color contrast: All text colors meet WCAG AA requirements
- Focus states: Use `--shadow-glow` for focus indicators
- Touch targets: Minimum 44px for interactive elements
