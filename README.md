# VT-LiveView

A hyper-local, real-time information map for Vermont. Beautiful, privacy-first, and community-focused.

![Vermont Map](https://img.shields.io/badge/Vermont-Local-green)
![React](https://img.shields.io/badge/React-19.2.0-blue)
![MapLibre](https://img.shields.io/badge/MapLibre-5.15.0-orange)
![License](https://img.shields.io/badge/license-MIT-blue)

## Overview

VT-Liveview provides Vermonters with real-time access to:
- 🌦️ Live weather radar
- ⚠️ NOAA weather alerts
- 🚗 Traffic incidents (accidents, road closures, construction)
- 🌊 Flood monitoring via USGS river gauges
- 🚧 VTrans construction projects
- ⛷️ Live ski resort conditions with color-coded markers

All in one beautiful, easy-to-use map interface.

## Features

### Weather Layer
- **Live Radar**: Real-time precipitation radar from Iowa Environmental Mesonet (IEM)
- **Weather Alerts**: NOAA alerts for Vermont with severity color-coding
- **Updates**: Automatic refresh every 5 minutes

### Travel Incidents Layer
- **Real-time Traffic**: Accidents, hazards, and congestion from Vermont 511 (VT 511)
- **Road Closures**: Full and partial closures with visual indicators
- **Construction Zones**: VTrans construction projects and roadwork
- **Flood Monitoring**: USGS river gauge data for flood-affected roads
- **Smart Filtering**: Zoom-based display (critical incidents when zoomed out, all details when zoomed in)
- **Updates**: Automatic refresh every 2 minutes

### Design
- 🎨 Categorical color coding for instant recognition
- 🖼️ Clean, modern outlined icons (Lucide)
- 📱 Mobile-responsive design
- 🌓 Glassmorphism UI with dark theme accents
- ♿ Accessible and easy to use

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Protomaps API key (free tier: 1M map views/month)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/VT-Liveview.git
   cd VT-Liveview
   ```

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Install backend dependencies:
   ```bash
   cd backend
   npm install
   cd ..
   ```

4. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

5. Get your FREE Protomaps API key:
   - Visit https://protomaps.com/api
   - Sign up (no credit card required)
   - Generate an API key
   - Add it to `.env`:
     ```
     VITE_PROTOMAPS_API_KEY=your_key_here
     ```

6. Start the backend server (in one terminal):
   ```bash
   cd backend
   npm start
   ```

7. Start the frontend development server (in another terminal):
   ```bash
   npm run dev
   ```

8. Open http://localhost:5173 in your browser

## Usage

### Toggle Layers
- **Radar**: Show/hide precipitation radar with adjustable opacity
- **Travel Incidents**: Toggle traffic, construction, and flood incidents

### Filter Incidents
Click checkboxes to show/hide specific incident types:
- ⚠️ Accidents (purple)
- 🚧 Construction (orange)
- 🚫 Road Closures (blue)
- 🌊 Flooding (teal)
- ⚡ Hazards (amber)

### View Details
Click any incident marker to see:
- Incident type and severity
- Location and road name
- Description
- Data source and timestamp

## Data Sources

All data sources are free and publicly available:

| Source | Data Type | Update Frequency | Cost |
|--------|-----------|------------------|------|
| [NOAA Weather](https://www.weather.gov/documentation/services-web-api) | Weather alerts & forecasts | Real-time | Free |
| [Iowa Mesonet (IEM)](https://mesonet.agron.iastate.edu/) | Radar imagery | Real-time | Free |
| [Vermont 511](https://511vt.com/) | Traffic incidents & construction | 2 minutes | Free |
| [USGS Water](https://waterservices.usgs.gov/) | River gauges | Real-time | Free |
| [Ski Vermont](https://skivermont.com/conditions) | Ski resort conditions | Twice daily (6 AM & 2 PM ET) | Free |
| [Protomaps](https://protomaps.com/) | Vector map tiles | Real-time | Free (1M views/month) |

## Tech Stack

- **Frontend**: React 19.2.0 + Vite 7.2.4
- **Backend**: Express.js 4.x (proxy for VT 511 API)
- **Mapping**: MapLibre GL JS 5.15.0
- **Icons**: Lucide React
- **Base Map**: Protomaps (vector tiles from OpenStreetMap data)
- **Data Fetching**: React Query (TanStack Query)

## Project Structure

```
VT-Liveview/
├── backend/                 # Express.js backend server
│   ├── src/
│   │   ├── server.js        # Main server file
│   │   ├── services/
│   │   │   ├── noaa.js      # NOAA API service
│   │   │   └── radar.js     # Radar data service
│   │   └── routes/
│   └── package.json
├── src/                     # React frontend
│   ├── components/          # React components
│   │   ├── CurrentWeather.jsx # Current weather display
│   │   ├── RadarOverlay.jsx   # Radar animation layer
│   │   ├── ThemeToggle.jsx    # Dark mode toggle
│   │   └── TravelLayer.jsx    # Travel incidents layer
│   ├── hooks/
│   │   └── useRadarAnimation.js # Radar animation logic
│   ├── services/
│   │   ├── travelApi.js     # VT 511 API service
│   │   └── vt511Api.js      # VT 511 XML parser
│   ├── utils/
│   │   ├── mapStyles.js     # Protomaps style config
│   │   └── incidentIcons.js # Icon utilities
│   ├── WeatherMap.jsx       # Main map component
│   └── main.jsx             # Entry point
├── .env.example             # Environment template
├── package.json             # Frontend dependencies
└── vite.config.js
```

## Development

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Lint Code
```bash
npm run lint
```

## Deployment

VT-Liveview requires both frontend and backend deployment:

### Frontend (Static Site)
Deploy the `dist/` folder to:
- **Netlify/Vercel**: Automatic deployment from GitHub
- **Nginx/Apache**: Serve the `dist/` folder
- **Cloudflare Pages**: Zero-config deployment

### Backend (Node.js Server)
Deploy the Express.js backend to:
- **VPS/Cloud Server**: Run with PM2 or systemd
- **Docker**: Containerize the backend service
- **Railway/Render**: Automatic deployment from GitHub
- **Proxmox LXC**: Run in a container on your homelab

**Important**: Update `VITE_BACKEND_URL` in production to point to your deployed backend server.

## Roadmap

### Planned Features
- [ ] Air Quality Index (EPA AirNow)
- [ ] Pollen count
- [ ] UV Index
- [ ] Fire/EMS incidents (PulsePoint)
- [ ] Power outages (Green Mountain Power)
- [ ] Mud season tracker (frost depth, road postings)
- [ ] Maple sugaring conditions (freeze/thaw tracking)
- [ ] Snow depth reports (CoCoRaHS)
- [ ] Town announcements
- [ ] School closures

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for your own purposes.

## Acknowledgments

- Weather data: NOAA National Weather Service
- Radar imagery: Iowa Environmental Mesonet (IEM)
- Traffic data: Vermont 511 (VTrans)
- Flood data: USGS Water Services
- Base map: Protomaps (using OpenStreetMap data)
- Icons: Lucide React

## Support

For questions or issues, please open an issue on GitHub.

---

Built with ❤️ for Vermont 🍁
