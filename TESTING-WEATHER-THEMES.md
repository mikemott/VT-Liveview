# Testing Weather-Adaptive Themes Locally

## Quick Start

### Option 1: Automated Script (Recommended)

```bash
./test-weather-themes.sh
```

This script will:
- ✅ Check for required environment variables
- ✅ Install dependencies if needed
- ✅ Create backend/.env if missing
- ✅ Start both frontend (port 5173) and backend (port 4000)
- ✅ Show logs from both servers

### Option 2: Manual Setup

**Terminal 1 - Backend:**
```bash
cd backend
npm install
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm install
npm run dev
```

**Browser:**
```
http://localhost:5173
```

## What to Test

### 1. **Light Mode Activation**
- Click the theme toggle button (sun/moon icon, top-left in controls panel)
- Switch to **light mode** (sun icon)
- Weather themes ONLY work in light mode

### 2. **Observe Color Changes**
Watch the UI panels change colors based on current Montpelier, VT weather:

| If Weather Is... | Colors You'll See |
|-----------------|-------------------|
| ☀️ Clear/Sunny | Golden yellows, warm shadows |
| 🌧️ Rain/Cloudy | Steel blues, cool grays |
| ❄️ Snow/Ice | Ice blues, crisp whites |
| ⚠️ Severe Storm | Alert reds, urgent styling |

### 3. **What Changes**
Look at these UI elements for color shifts:
- **Weather panel** (top-left) - background glass, borders
- **Radar controls** (bottom-left) - buttons, sliders
- **Detail panel** (right side) - when you click something
- **All borders and shadows** - should match weather theme

### 4. **What Stays the Same**
These should NOT change:
- ❌ Fonts (Public Sans)
- ❌ Icons (Lucide icons)
- ❌ Layout/spacing
- ❌ Component sizes
- ❌ Text content

## Testing Different Weather Conditions

Since weather changes slowly, use the **mockups** to preview all themes:

```bash
# Open mockups in browser
open mockups/index.html
```

Or visit individual mockups:
- `mockups/light-mode-sunny.html`
- `mockups/light-mode-rainy.html`
- `mockups/light-mode-snowy.html`
- `mockups/light-mode-severe.html`

## Verification Checklist

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Map loads correctly
- [ ] Weather data displays in top-left panel
- [ ] Light mode toggle works
- [ ] In light mode, UI colors change based on weather
- [ ] In dark mode, UI uses standard dark theme (no weather colors)
- [ ] Mobile view works (resize browser)
- [ ] All panels remain functional
- [ ] No console errors in browser DevTools

## Debugging

### Backend Not Starting

**Check logs:**
```bash
cat backend.log
```

**Common issues:**
- Port 4000 already in use: `lsof -ti:4000` (kill process)
- Missing dependencies: `cd backend && npm install`

### Frontend Not Starting

**Check logs:**
```bash
cat frontend.log
```

**Common issues:**
- Port 5173 already in use: `lsof -ti:5173` (kill process)
- Missing VITE_PROTOMAPS_API_KEY in `.env`
- Missing dependencies: `npm install`

### Weather Theme Not Applying

**Open browser DevTools console:**

1. Check for JavaScript errors
2. Verify weather data is loading:
   ```javascript
   // Should see weather description in network tab
   // GraphQL request to /graphql
   ```
3. Check HTML element:
   ```javascript
   document.documentElement.className
   // Should contain: 'weather-sunny' or 'weather-rainy' etc.
   ```

**Force a specific theme for testing:**
```javascript
// Open browser console and run:
document.documentElement.classList.add('weather-severe');
// Or: weather-sunny, weather-rainy, weather-snowy
```

### Colors Look Wrong

**Verify CSS is loaded:**
1. Open DevTools → Elements tab
2. Inspect any UI panel
3. Check computed styles for CSS variables:
   - `--color-accent-primary`
   - `--color-bg-glass`
   - `--shadow-xl`

These should change when you switch weather themes.

## Expected Behavior

### Automatic Updates
- Weather data fetches **every 5 minutes**
- Theme switches **instantly** when conditions change
- No page reload needed

### Theme Priority
1. **Dark mode** → No weather themes (standard dark)
2. **Severe alerts** → Red theme (highest priority)
3. **Weather description** → Sunny/Rainy/Snowy theme
4. **Default** → Standard light theme

## Browser DevTools Tips

### Check Current Theme
```javascript
// Console command
document.documentElement.className
// Example output: "weather-sunny"
```

### Check Weather Data
```javascript
// Network tab
// Filter: /graphql
// Look for: currentWeather query
// Response should have "description" field
```

### Check CSS Variables
```javascript
// Console command
getComputedStyle(document.documentElement).getPropertyValue('--color-accent-primary')
// Sunny: "rgb(253, 184, 19)"
// Rainy: "rgb(74, 144, 226)"
// Snowy: "rgb(100, 181, 246)"
// Severe: "rgb(239, 83, 80)"
```

## Stopping the Servers

If using the automated script:
```bash
# Press Ctrl+C in the terminal
```

If running manually:
```bash
# Press Ctrl+C in each terminal window
```

## Next Steps After Testing

Once everything works locally:

1. **Commit changes:**
   ```bash
   git status
   git add src/utils/weatherTheme.ts src/styles/design-system.css src/WeatherMap.tsx docs/
   git commit -m "feat: add weather-adaptive themes"
   ```

2. **Create PR** (see CLAUDE.md for PR workflow)

3. **Deploy** - Automatic on merge to main

## Questions?

Check the full documentation:
- `/docs/weather-adaptive-themes.md` - Complete implementation guide
- `/CLAUDE.md` - Development workflow
- `/mockups/` - Visual previews of all themes

---

**Quick Test:** Open http://localhost:5173 → Toggle to light mode → Watch colors match the weather! 🌦️
