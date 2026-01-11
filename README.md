# VT-Liveview

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

All in one beautiful, easy-to-use map interface.

## Features

### Weather Layer
- **Live Radar**: Real-time precipitation radar from RainViewer
- **Weather Alerts**: NOAA alerts for Vermont with severity color-coding
- **Updates**: Automatic refresh every 5 minutes

### Travel Incidents Layer
- **Real-time Traffic**: Accidents, hazards, and congestion from HERE Traffic API
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
- HERE Maps API key (free tier: 250k requests/month)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/VT-Liveview.git
   cd VT-Liveview
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

4. Get your FREE HERE API key:
   - Visit https://developer.here.com/
   - Sign up (no credit card required)
   - Create a project and generate an API key
   - Add it to `.env`:
     ```
     VITE_HERE_API_KEY=your_key_here
     ```

5. Start the development server:
   ```bash
   npm run dev
   ```

6. Open http://localhost:5173 in your browser

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
| [NOAA Weather](https://www.weather.gov/documentation/services-web-api) | Weather alerts | Real-time | Free |
| [RainViewer](https://www.rainviewer.com/api.html) | Radar imagery | Real-time | Free |
| [HERE Traffic](https://developer.here.com/documentation/traffic-api/dev_guide/index.html) | Traffic incidents | 2 minutes | Free (250k/month) |
| [USGS Water](https://waterservices.usgs.gov/) | River gauges | Real-time | Free |
| [VTrans](https://vtrans.vermont.gov/) | Construction projects | As available | Free |

## Tech Stack

- **Frontend**: React 19.2.0 + Vite 7.2.4
- **Mapping**: MapLibre GL JS 5.15.0
- **Icons**: Lucide React
- **Base Map**: OpenStreetMap

## Project Structure

```
weather-map/
├── src/
│   ├── components/          # React components
│   │   ├── TravelLayer.jsx  # Travel incidents layer
│   │   └── WeatherAlerts.jsx # Weather alerts panel
│   ├── services/
│   │   └── travelApi.js     # API service layer
│   ├── utils/
│   │   ├── incidentColors.js # Color constants
│   │   └── incidentIcons.js  # Icon utilities
│   ├── App.jsx              # Root component
│   ├── WeatherMap.jsx       # Main map component
│   └── main.jsx             # Entry point
├── .env.example             # Environment template
├── package.json
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

VT-Liveview is a static site that can be deployed to:
- **Netlify/Vercel**: Automatic deployment from GitHub
- **Nginx/Apache**: Serve the `dist/` folder
- **Docker**: Containerize for cloud deployment
- **Proxmox LXC**: Run in a container on your homelab

See [TRAVEL_LAYER_SETUP.md](TRAVEL_LAYER_SETUP.md) for detailed setup instructions.

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
- Radar imagery: RainViewer
- Traffic data: HERE Technologies
- Flood data: USGS Water Services
- Construction data: Vermont Agency of Transportation
- Base map: OpenStreetMap contributors

## Support

For questions or issues, please open an issue on GitHub.

---

Built with ❤️ for Vermont 🍁
