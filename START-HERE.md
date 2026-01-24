# 🌦️ Test Weather-Adaptive Themes

## Quick Start (2 Steps)

### 1️⃣ Start Test Servers
```bash
./test-weather-themes.sh
```
This starts both frontend and backend automatically (uses your existing Protomaps API key).

### 2️⃣ Test in Browser
Open: **http://localhost:5173**

1. Click the **theme toggle** (sun/moon icon, top-left)
2. Switch to **light mode** (sun icon)
3. Watch the colors change based on Vermont weather! ✨

---

## Optional: Run Setup First

If you want to verify everything is configured:
```bash
./setup-and-test.sh
```
This checks dependencies and creates backend config files.

---

## What You'll See

The UI colors automatically adapt to current weather:

| Weather | Colors |
|---------|--------|
| ☀️ Sunny | Golden yellows |
| 🌧️ Rainy | Steel blues |
| ❄️ Snowy | Ice blues |
| ⚠️ Severe | Alert reds |

**Note:** Weather themes only work in **light mode**. Dark mode uses the standard dark theme.

---

## Preview All Themes

Don't want to wait for weather to change? View mockups:

```bash
open mockups/index.html
```

---

## Need Help?

- **Full testing guide:** `TESTING-WEATHER-THEMES.md`
- **Implementation docs:** `docs/weather-adaptive-themes.md`
- **Mockups:** `mockups/` directory

---

## Files Changed

New weather theme system added:
- ✨ `src/utils/weatherTheme.ts` - Theme detection logic
- 🎨 `src/styles/design-system.css` - Color themes
- 🗺️ `src/WeatherMap.tsx` - Integration
- 📚 `docs/weather-adaptive-themes.md` - Documentation
- 🎭 `mockups/` - Visual previews

**No fonts, icons, or layouts changed** - only colors! 🎨
