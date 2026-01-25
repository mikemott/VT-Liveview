# Weather-Adaptive Light Mode Themes

## Overview

VT-LiveView now features an **adaptive color system** that automatically adjusts the UI colors based on current weather conditions. The interface dynamically shifts its color palette, shadows, and borders to create an immersive, weather-responsive experience.

## How It Works

### 1. Theme Detection

The system monitors two data sources:
- **Current weather description** from NOAA (e.g., "Clear", "Rain", "Snow", "Thunderstorm")
- **Active severe weather alerts** (Severe/Extreme severity)

Based on these conditions, one of four weather themes is applied:

| Theme | Conditions | Color Palette |
|-------|-----------|---------------|
| **Sunny** | Clear, sunny, fair weather | Golden yellows (#FDB813), warm shadows |
| **Rainy** | Rain, drizzle, cloudy, fog | Steel blues (#4A90E2), cool grays |
| **Snowy** | Snow, ice, freezing conditions | Ice blues (#64B5F6), crisp whites |
| **Severe** | Thunderstorms, severe alerts | Alert reds (#EF5350), urgent styling |

### 2. Automatic Updates

- Weather data refreshes **every 5 minutes**
- Theme transitions happen **instantly** when conditions change
- Only applies in **light mode** (dark mode uses standard dark theme)

### 3. Visual Changes

Each weather theme modifies:
- ✨ **Glass panel backgrounds** - Opacity and tint
- 🎨 **Accent colors** - Buttons, borders, highlights
- 📝 **Text colors** - Adjusted for contrast
- 🌟 **Shadows** - Color and intensity
- 🔲 **Borders** - Tint and opacity

## Implementation Details

### File Structure

```
src/
├── utils/
│   └── weatherTheme.ts          # Theme detection and application logic
├── styles/
│   └── design-system.css        # Weather theme CSS variables
└── WeatherMap.tsx               # Integration point
```

### Key Functions

#### `getWeatherTheme(description, hasSevereAlert)`
Analyzes weather description string and alert status to determine appropriate theme.

```typescript
const theme = getWeatherTheme("Partly Cloudy", false);
// Returns: 'sunny'
```

#### `applyWeatherTheme(theme)`
Applies CSS class to document root to activate theme.

```typescript
applyWeatherTheme('rainy');
// Adds class "weather-rainy" to <html> element
```

#### `hasSevereAlerts(alerts)`
Checks if any severe or extreme alerts are active.

```typescript
const severe = hasSevereAlerts(alertFeatures);
// Returns: true if Severe/Extreme alerts exist
```

### CSS Variable System

All weather themes use **CSS Custom Properties** (variables) for easy customization:

```css
:root.weather-sunny {
  --color-accent-primary: #FDB813;    /* Golden yellow */
  --color-bg-glass: rgba(255, 255, 255, 0.75);
  --shadow-xl: 0 8px 32px rgba(253, 184, 19, 0.15);
}

:root.weather-severe {
  --color-accent-primary: #EF5350;    /* Alert red */
  --color-bg-glass: rgba(255, 255, 255, 0.75);
  --shadow-xl: 0 8px 32px rgba(239, 83, 80, 0.2);
}
```

### React Integration

Weather themes are managed in the `WeatherMap` component:

```typescript
// State tracking
const [currentWeatherData, setCurrentWeatherData] = useState<CurrentWeatherData | null>(null);
const [weatherTheme, setWeatherTheme] = useState<WeatherTheme>('default');

// Fetch weather data every 5 minutes
useEffect(() => {
  const fetchWeather = async () => {
    const weatherData = await fetchCurrentWeather(mapCenter.lat, mapCenter.lng);
    setCurrentWeatherData(weatherData);
  };

  fetchWeather();
  const interval = setInterval(fetchWeather, 5 * 60 * 1000);
  return () => clearInterval(interval);
}, [mapCenter.lat, mapCenter.lng]);

// Apply theme based on conditions
useEffect(() => {
  if (isDark) {
    applyWeatherTheme('default');  // Dark mode = no weather themes
    return;
  }

  const hasSevere = hasSevereAlerts(alerts);
  const theme = getWeatherTheme(currentWeatherData?.description, hasSevere);

  if (theme !== weatherTheme) {
    setWeatherTheme(theme);
    applyWeatherTheme(theme);
  }
}, [isDark, currentWeatherData, alerts, weatherTheme]);
```

## Theme Details

### ☀️ Sunny Theme

**Triggered by:** Clear, Sunny, Fair, Partly Cloudy

**Visual Characteristics:**
- Warm golden accents (#FDB813)
- Bright, cheerful atmosphere
- Soft, warm shadows
- High contrast for readability

**Use Cases:**
- Clear days
- Bright sunshine
- Low humidity conditions

### 🌧️ Rainy Theme

**Triggered by:** Rain, Drizzle, Showers, Cloudy, Fog, Overcast

**Visual Characteristics:**
- Cool steel blue accents (#4A90E2)
- Muted, subdued colors
- Softer contrast
- Calming atmosphere

**Use Cases:**
- Wet weather
- Overcast skies
- Light precipitation
- Foggy conditions

### ❄️ Snowy Theme

**Triggered by:** Snow, Sleet, Ice, Freezing, Blizzard, Flurries

**Visual Characteristics:**
- Ice blue accents (#64B5F6)
- Crisp, clean whites
- Higher glass opacity
- Cool, winter aesthetic

**Use Cases:**
- Winter precipitation
- Icy conditions
- Cold weather events

### ⚠️ Severe Theme

**Triggered by:** Severe/Extreme alerts, Thunderstorms, Tornadoes, Lightning

**Visual Characteristics:**
- Alert red accents (#EF5350)
- Urgent, high-contrast styling
- Stronger borders (2px vs 1px)
- Attention-grabbing shadows
- Secondary warning orange (#FF6F00)

**Use Cases:**
- Active severe weather warnings
- Thunderstorm conditions
- Emergency situations
- Critical alerts

## Customization

### Adding a New Weather Theme

1. **Add theme to TypeScript type:**
```typescript
// src/utils/weatherTheme.ts
export type WeatherTheme = 'sunny' | 'rainy' | 'snowy' | 'severe' | 'foggy'; // Added 'foggy'
```

2. **Add detection logic:**
```typescript
// src/utils/weatherTheme.ts
if (desc.includes('fog') || desc.includes('mist')) {
  return 'foggy';
}
```

3. **Define CSS variables:**
```css
/* src/styles/design-system.css */
:root.weather-foggy {
  --color-accent-primary: #9E9E9E;
  --color-bg-glass: rgba(255, 255, 255, 0.65);
  /* ... more variables ... */
}
```

### Modifying Existing Themes

Edit the CSS variables in `src/styles/design-system.css`:

```css
:root.weather-sunny {
  /* Change golden yellow to orange */
  --color-accent-primary: #FF9800;  /* Changed from #FDB813 */
  --color-accent-hover: #F57C00;
}
```

### Adjusting Theme Sensitivity

Modify detection rules in `src/utils/weatherTheme.ts`:

```typescript
// Make sunny theme only apply to perfectly clear conditions
if (desc === 'clear' || desc === 'sunny') {  // More strict
  return 'sunny';
}
```

## Testing

### Manual Testing

1. **Test theme detection:**
```typescript
import { getWeatherTheme } from './utils/weatherTheme';

console.log(getWeatherTheme('Clear', false));        // 'sunny'
console.log(getWeatherTheme('Rain Showers', false)); // 'rainy'
console.log(getWeatherTheme('Heavy Snow', false));   // 'snowy'
console.log(getWeatherTheme('Clear', true));         // 'severe' (alert override)
```

2. **Test theme application:**
```typescript
import { applyWeatherTheme } from './utils/weatherTheme';

applyWeatherTheme('sunny');
// Check: document.documentElement.classList contains 'weather-sunny'

applyWeatherTheme('rainy');
// Check: 'weather-sunny' removed, 'weather-rainy' added
```

3. **Visual testing:**
- Wait for weather data to load
- Toggle between light/dark mode
- Observe color changes as weather conditions change
- Check all UI panels (weather, radar, detail panel)

## Browser Compatibility

Weather themes use:
- ✅ **CSS Custom Properties** - All modern browsers
- ✅ **CSS Classes** - Universal support
- ✅ **No vendor prefixes needed**

**Minimum browser versions:**
- Chrome 49+
- Firefox 31+
- Safari 9.1+
- Edge 15+

## Performance

**Impact:** Minimal
- Theme changes require only **CSS class update** (no re-render)
- CSS variables use browser's native implementation
- Weather data fetched **once per 5 minutes**
- No additional bundle size (uses existing design system)

## Future Enhancements

Potential improvements:
- 🌅 **Time-of-day themes** - Sunrise/sunset gradients
- 🌈 **Transition animations** - Smooth color shifts
- 🎨 **Custom theme builder** - User-defined color schemes
- 🌡️ **Temperature-based tints** - Hot (warm) vs cold (cool) colors
- 🌪️ **Animated backgrounds** - Weather-specific subtle effects

## Troubleshooting

### Theme not changing

**Check:**
1. Is dark mode enabled? (Themes only work in light mode)
2. Are weather requests succeeding? (Check network tab)
3. Is weather description being parsed correctly? (Check console in DEV mode)

### Wrong theme applied

**Debug:**
```typescript
// Add to WeatherMap.tsx useEffect
if (import.meta.env.DEV) {
  console.log('Weather description:', currentWeatherData?.description);
  console.log('Detected theme:', theme);
  console.log('Has severe alerts:', hasSevere);
}
```

### CSS not applying

**Verify:**
1. `design-system.css` is imported in `main.jsx`
2. Weather theme class exists on `<html>` element
3. CSS variables are defined for the theme
4. Component styles use CSS variables (not hardcoded colors)

## Resources

- **Design System:** `src/styles/design-system.css`
- **Theme Logic:** `src/utils/weatherTheme.ts`
- **Integration:** `src/WeatherMap.tsx` (lines 505-546)
- **Mockups:** `/mockups/` directory

---

**Last Updated:** 2026-01-23
**Author:** VT-LiveView Team
**Version:** 1.0
