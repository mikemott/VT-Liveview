# Travel Incidents Layer - Setup Guide

The travel incidents layer has been successfully integrated into the VT-Map application! This guide will help you set up the HERE API key and understand the new features.

## Features

✅ **Real-time travel incidents from 3 sources:**
- HERE Traffic API: Accidents, road closures, construction, hazards
- USGS Water Services: Flooding affecting roads
- VTrans ArcGIS: Construction projects

✅ **Visual Design:**
- Categorical color-coded incidents (Purple=Accidents, Orange=Construction, Blue=Closures, Teal=Flooding, Amber=Hazards)
- Lucide outlined icons for clean, modern appearance
- Map markers with hover effects
- Detailed popups on click

✅ **Smart Filtering:**
- Zoom-based filtering (critical incidents when zoomed out, all when zoomed in)
- Toggle individual incident types on/off
- Real-time updates every 2 minutes

## Setup Instructions

### 1. Get a FREE HERE API Key

1. Visit https://developer.here.com/
2. Click "Get Started for Free" (no credit card required)
3. Create an account or sign in
4. Create a new project
5. Generate an API key
6. Copy the API key

### 2. Configure Environment Variables

1. In the `weather-map` directory, create a `.env` file:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and add your HERE API key:
   ```
   VITE_HERE_API_KEY=your_actual_api_key_here
   ```

3. Save the file

### 3. Restart the Development Server

```bash
npm run dev
```

## Usage

### Toggle Travel Layer

In the controls panel (top-left), you'll see a new "Travel" section with a toggle switch to show/hide incidents.

### Filter Incident Types

When the travel layer is active, you'll see checkboxes to filter by:
- ⚠️ Accidents (purple)
- 🚧 Construction (orange)
- 🚫 Road Closures (blue)
- 🌊 Flooding (teal)
- ⚡ Hazards (amber)

### Zoom-Based Filtering

- **Zoom < 8**: Shows only critical incidents (closures)
- **Zoom 8-10**: Shows critical + major incidents (closures, accidents, flooding)
- **Zoom > 10**: Shows all incidents including minor hazards

### View Incident Details

Click any marker on the map to see:
- Incident type
- Title and description
- Road name
- Data source
- Timestamp

## API Rate Limits

- **HERE Traffic API**: 250,000 requests/month (free tier)
- **Polling frequency**: Every 2 minutes
- **Monthly usage**: ~21,600 requests (well within free tier)

The other two data sources (USGS and VTrans) are completely free with no rate limits.

## Troubleshooting

### No incidents showing?

1. Check that you've added your HERE API key to `.env`
2. Open browser console (F12) and check for API errors
3. Verify you're viewing Vermont (zoom in if needed)
4. Make sure the "Show Incidents" toggle is enabled

### API Key not working?

1. Verify the key is correctly formatted in `.env`
2. Make sure the file is named `.env` (not `.env.txt`)
3. Restart the dev server after adding the key
4. Check that the key has permission for the Traffic API

### VTrans or USGS data not showing?

These are fallback data sources. If they're not available:
- VTrans data might not have a public API endpoint (we attempted to connect)
- USGS flood data only shows when flooding is actually occurring
- HERE Traffic API should always work with a valid key

## File Structure

```
weather-map/
├── src/
│   ├── components/
│   │   ├── TravelLayer.jsx       # Main travel incidents component
│   │   └── TravelLayer.css       # Styling
│   ├── services/
│   │   └── travelApi.js          # API service layer
│   ├── utils/
│   │   ├── incidentColors.js    # Color constants and helpers
│   │   └── incidentIcons.js      # Icon utilities
│   └── WeatherMap.jsx            # Updated with travel integration
├── .env                          # Your API keys (create this!)
└── .env.example                  # Template for environment variables
```

## Development Notes

### Polling Interval

The current polling interval is 2 minutes. To change it, edit `/Users/mike/Projects/VT-Map/weather-map/src/components/TravelLayer.jsx`:

```javascript
const interval = setInterval(fetchIncidents, 2 * 60 * 1000); // Change this value
```

### Add More Data Sources

To add additional data sources, edit `/Users/mike/Projects/VT-Map/weather-map/src/services/travelApi.js` and add a new fetch function, then include it in `fetchAllIncidents()`.

### Customize Colors

Edit `/Users/mike/Projects/VT-Map/weather-map/src/utils/incidentColors.js` to change the color scheme.

## Next Steps

Consider adding:
- Road segment highlighting for affected routes
- Historical incident data
- User-reported incidents
- Push notifications for new incidents
- Integration with mobile app

Enjoy your new travel incidents layer! 🚗🗺️
