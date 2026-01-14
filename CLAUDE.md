# VT-Liveview Development Guide for Claude

## 🎯 What Is This Project?

**VT-Liveview** is a hyper-local, real-time information map for Vermont that aggregates data from multiple free public sources into a single, beautiful web interface.

**Core Features:**
- 🌦️ Live weather radar (Iowa Environmental Mesonet)
- ⚠️ NOAA weather alerts with zone highlighting
- 🚗 Real-time traffic incidents (Vermont 511)
- 🚧 Road closures and construction zones
- 🌊 USGS flood monitoring at river gauges
- 🌓 Automatic dark mode based on Vermont sunrise/sunset
- 📱 Mobile-responsive glassmorphism UI

**GitHub:** https://github.com/mikemott/VT-Liveview

---

## 🏗️ Architecture Overview

### Tech Stack
```
┌─────────────────────────────────────────────────────┐
│ Frontend (React 19 + Vite 7)                       │
│ ├── MapLibre GL 5.15 (vector mapping)              │
│ ├── React Query (caching & data fetching)          │
│ ├── Protomaps (OpenStreetMap vector tiles)         │
│ └── Lucide React (icons)                           │
└─────────────────────────────────────────────────────┘
                         ↕ GraphQL/REST
┌─────────────────────────────────────────────────────┐
│ Backend (Fastify 4 + Apollo GraphQL)               │
│ ├── GraphQL API for weather data                   │
│ ├── NOAA API proxy (alerts, forecasts)             │
│ ├── IEM radar tile aggregation                     │
│ └── VT 511 XML parser (traffic incidents)          │
└─────────────────────────────────────────────────────┘
                         ↕ HTTP/JSON/XML
┌─────────────────────────────────────────────────────┐
│ External Free Public APIs                          │
│ ├── NOAA Weather API (alerts, forecasts)           │
│ ├── Iowa Environmental Mesonet (radar tiles)       │
│ ├── Vermont 511 (traffic, construction, closures)  │
│ └── USGS Water Services (river gauges)             │
└─────────────────────────────────────────────────────┘
```

### Deployment
- **Frontend:** Cloudflare Pages (automatic on push to `main`)
- **Backend:** Deployable to VPS, Railway, Render, Docker, Proxmox LXC

---

## 🔄 Development Workflow

**⚠️ CRITICAL: NEVER commit directly to `main` branch!**

All work follows a Linear → Branch → PR → Review → Merge workflow with full automation.

### Required Steps for All Non-Trivial Work

#### 1. Start with Linear Issue
- Check Linear for existing issues or create new ones
- Use Linear MCP tools: `mcp__linear__list_issues`, `mcp__linear__create_issue`
- Issues auto-generate branch names (e.g., `vtl-XX-short-description`)

#### 2. Create Feature Branch (Use Worktrees When Possible)

**For isolated work (recommended):**
```bash
# Create worktree for parallel development
git worktree add ../VT-LiveView-vtl-XX vtl-XX-feature-name
cd ../VT-LiveView-vtl-XX

# Or if branch doesn't exist yet:
git worktree add -b vtl-XX-feature-name ../VT-LiveView-vtl-XX main
```

**For quick fixes in main repo:**
```bash
git checkout -b vtl-XX-short-description
```

**Branch naming:** Use Linear's format (`vtl-XX-short-description`, lowercase, hyphens)

#### 3. Implement & Commit
- Make changes on feature branch
- Commit with clear messages referencing the issue
- Multiple commits are fine

#### 4. Push & Create PR
```bash
git push -u origin vtl-XX-short-description
gh pr create --title "feat: description" --body "$(cat <<'EOF'
## Summary
- Change 1
- Change 2

## Test Plan
- [ ] Test item

Closes VTL-XX

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
EOF
)"
```

- Include `Closes VTL-XX` in PR body for auto-linking
- Update Linear issue with PR link using `mcp__linear__update_issue`

#### 5. Review PR Agent Feedback (AUTOMATIC - Claude Does This)

**After creating a PR, Claude automatically:**
1. Waits ~30-60 seconds for PR Agent (qodo-code-review) to complete
2. Fetches comments: `gh pr view <number> --comments`
3. Reviews all compliance checks and code suggestions

**Claude uses judgment to prioritize feedback:**
- ✅ **Always fix:** Security issues, bugs, runtime errors, backward compatibility breaks
- ✅ **Fix if straightforward:** High-impact improvements that are quick wins
- 📝 **Document for later:** Larger architectural refactorings (create Linear issue)
- ⏭️ **Skip:** Minor style preferences, subjective suggestions, or conflicts with project patterns

**Not all PR Agent feedback requires action** - Claude makes pragmatic decisions about what adds value vs. what's noise. The goal is to catch real issues, not to satisfy every bot suggestion.

#### 6. Merge After Review
```bash
gh pr merge <number> --squash --delete-branch
```
- Verify all checks pass
- Linear issue auto-updates when PR is merged

#### 7. Clean Up Worktree (if used)
```bash
cd /path/to/main/VT-LiveView
git worktree remove ../VT-LiveView-vtl-XX
```

### When to Use Worktrees

**Use worktrees for:**
- Features that might take multiple sessions
- Parallel work on different issues
- Keeping main repo clean for quick fixes
- Long-running experiments

**Skip worktrees for:**
- Quick single-file fixes
- Documentation updates
- Trivial changes

### Automation in Place

| Automation | Trigger | Action |
|------------|---------|--------|
| **PR Agent** | PR opened/updated | AI code review with compliance checks |
| **Deploy** | Push to `main` | Build & deploy to Cloudflare Pages |
| **Sentry** | Production deploy | Upload source maps |
| **Linear Sync** | PR with `Closes VTL-XX` | Auto-close issue on merge |

### Workflow Files

- `.github/workflows/pr-agent.yml` - PR Agent code review
- `.github/workflows/deploy.yml` - Cloudflare Pages deployment + Sentry

---

## 🚀 Quick Start for Development

### Prerequisites
- Node.js 20+
- npm
- Protomaps API key (free tier: 1M views/month)

### Setup Steps
```bash
# 1. Install frontend dependencies
npm install

# 2. Install backend dependencies
cd backend
npm install
cd ..

# 3. Set up environment
cp .env.example .env
# Edit .env and add your Protomaps API key:
# VITE_PROTOMAPS_API_KEY=your_key_here

# 4. Start backend (terminal 1)
cd backend
npm run dev  # Runs on http://localhost:4000

# 5. Start frontend (terminal 2)
npm run dev  # Runs on http://localhost:5173
```

### Environment Variables

**Frontend (.env):**
```bash
# REQUIRED
VITE_PROTOMAPS_API_KEY=pm_xxxxx  # Get free at https://protomaps.com/api

# OPTIONAL
VITE_BACKEND_URL=http://localhost:4000        # Backend GraphQL endpoint
VITE_GRAPHQL_ENDPOINT=http://localhost:4000/graphql
```

**Backend (backend/.env):**
```bash
# Server config
PORT=4000                                     # Default: 4000
HOST=0.0.0.0                                  # Default: 0.0.0.0
NODE_ENV=development                          # development | production

# CORS (production only)
ALLOWED_ORIGINS=https://your-domain.com       # Comma-separated list

# NOAA API User-Agent
CONTACT_EMAIL=your-email@example.com          # Required by NOAA ToS

# Monitoring (optional)
SENTRY_DSN=your_sentry_dsn                    # Error tracking
SENTRY_ENVIRONMENT=development                # Environment name
SENTRY_TRACES_SAMPLE_RATE=0.1                 # 10% of transactions
SENTRY_PROFILES_SAMPLE_RATE=0.1               # 10% of traces
```

---

## 📂 Project Structure

```
VT-Liveview/
├── src/                              # React frontend
│   ├── WeatherMap.jsx                # ⭐ Main map component (12KB, complex)
│   ├── App.jsx                       # Root component with React Query provider
│   ├── main.jsx                      # Entry point
│   │
│   ├── components/
│   │   ├── CurrentWeather.jsx        # Weather display widget
│   │   ├── RadarOverlay.jsx          # Radar animation layer + controls
│   │   ├── TravelLayer.jsx           # Traffic incidents layer + filtering
│   │   └── ThemeToggle.jsx           # Dark mode toggle button
│   │
│   ├── hooks/
│   │   └── useRadarAnimation.js      # Radar frame animation logic
│   │
│   ├── services/
│   │   ├── graphqlClient.js          # GraphQL client setup
│   │   ├── travelApi.js              # VT 511 + USGS aggregator
│   │   └── vt511Api.js               # VT 511 XML parser
│   │
│   ├── utils/
│   │   ├── mapStyles.js              # Protomaps style configuration
│   │   ├── incidentIcons.js          # Icon mapping utilities
│   │   └── incidentColors.js         # Category color coding
│   │
│   ├── App.css                       # Root styles + theme variables
│   └── index.css                     # Global styles
│
├── backend/
│   ├── src/
│   │   ├── server.js                 # ⭐ Fastify server + GraphQL setup
│   │   ├── schema.graphql            # GraphQL type definitions
│   │   │
│   │   ├── resolvers/
│   │   │   └── index.js              # GraphQL resolvers
│   │   │
│   │   └── services/
│   │       ├── noaa.js               # NOAA API integration (alerts, forecasts)
│   │       └── radar.js              # IEM radar tile service
│   │
│   └── package.json                  # Backend dependencies
│
├── .github/workflows/
│   ├── deploy.yml                    # Cloudflare Pages CI/CD + Sentry uploads
│   └── pr-agent.yml                  # PR Agent code review automation
│
├── Configuration Files
│   ├── package.json                  # Frontend dependencies (8 core, 11 dev)
│   ├── vite.config.js                # Vite build configuration
│   ├── eslint.config.js              # ESLint rules (flat config)
│   ├── sentry.config.js              # Sentry initialization
│   └── index.html                    # HTML entry point (Orbitron font)
│
└── Documentation
    ├── README.md                     # User-facing documentation
    ├── CLAUDE.md                     # THIS FILE - Claude development guide
    ├── AUDIT_REPORT.md               # Comprehensive audit findings (37% complete)
    └── SESSION_1_SUMMARY.md          # Recent audit session notes
```

### Key Files to Know

| File | Size | Purpose | When to Edit |
|------|------|---------|--------------|
| `src/WeatherMap.jsx` | 12KB | Main map component, alert management, theme switching | Map initialization, alert display logic |
| `backend/src/server.js` | 4KB | Fastify + Apollo GraphQL setup, CORS, routes | API endpoints, server config |
| `backend/src/services/noaa.js` | 8KB | NOAA API integration with LRU cache | Weather data fetching |
| `src/components/TravelLayer.jsx` | 10KB | Traffic incident layer with filtering | Incident display, filtering logic |
| `src/services/vt511Api.js` | 9KB | VT 511 XML parser | Traffic data parsing |
| `src/utils/mapStyles.js` | 5KB | Protomaps style configuration | Base map appearance |

---

## 🔄 Data Flow & Caching Strategy

### React Query Configuration
```javascript
// src/App.jsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 minutes
      refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
      retry: 2,
    },
  },
});
```

### Data Sources & Update Frequencies

| Source | Data Type | Cache | Update Frequency | API Endpoint |
|--------|-----------|-------|------------------|--------------|
| **NOAA** | Weather alerts, forecasts | 5 min | Real-time | `https://api.weather.gov` |
| **IEM** | Radar tiles | N/A | Real-time | `https://mesonet.agron.iastate.edu` |
| **VT 511** | Traffic incidents | 5 min | 2 minutes | `https://511vt.com/map/Cctv/data` |
| **USGS** | River gauges | 5 min | Real-time | `https://waterservices.usgs.gov` |
| **Protomaps** | Vector map tiles | Browser | Real-time | `https://api.protomaps.com` |

### Backend Caching (NOAA Grid Points)
```javascript
// backend/src/services/noaa.js
// LRU cache with max 100 entries, 1-hour TTL
const gridPointCache = new Map();
const gridPointTimeouts = new Map();
```

**Important:** The cache prevents redundant API calls for the same coordinates. When adding new caching, follow this LRU pattern to avoid memory leaks.

---

## 🛠️ Common Development Tasks

### 1. Adding a New Data Source

**Example: Adding Air Quality Index (EPA AirNow)**

```javascript
// 1. Create service in src/services/airQuality.js
export async function fetchAirQuality() {
  const response = await fetch('https://airnowapi.org/...');
  return response.json();
}

// 2. Add React Query hook in component
import { useQuery } from '@tanstack/react-query';

const { data: airQuality } = useQuery({
  queryKey: ['air-quality'],
  queryFn: fetchAirQuality,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// 3. Add to map as new layer (see TravelLayer.jsx for pattern)
```

### 2. Adding a New Map Layer

**Pattern to follow (see `src/components/TravelLayer.jsx`):**

```javascript
// 1. Add GeoJSON source
map.current.addSource('my-layer-source', {
  type: 'geojson',
  data: {
    type: 'FeatureCollection',
    features: []
  }
});

// 2. Add layer with styling
map.current.addLayer({
  id: 'my-layer',
  type: 'symbol',
  source: 'my-layer-source',
  layout: {
    'icon-image': 'my-icon',
    'icon-size': 1.0
  }
});

// 3. Update data on change
useEffect(() => {
  if (map.current.getSource('my-layer-source')) {
    map.current.getSource('my-layer-source').setData(newData);
  }
}, [newData]);
```

### 3. Modifying Map Styles

**Base map colors and layers:**
```javascript
// src/utils/mapStyles.js - Protomaps style configuration
export function getProtomapsStyle(isDark, apiKey) {
  return {
    // Customize colors, fonts, layer visibility
  };
}
```

### 4. Adding New Environment Variables

```bash
# 1. Add to .env.example with description
VITE_MY_NEW_VAR=default_value  # Description here

# 2. Use in code
const myVar = import.meta.env.VITE_MY_NEW_VAR;

# 3. Update CLAUDE.md environment variables section
```

### 5. Backend API Changes

**Adding new GraphQL resolver:**
```javascript
// 1. Update backend/src/schema.graphql
type Query {
  myNewQuery(param: String!): MyNewType
}

// 2. Add resolver in backend/src/resolvers/index.js
export const resolvers = {
  Query: {
    myNewQuery: async (parent, args, context) => {
      // Implementation
    }
  }
};

// 3. Use in frontend with graphqlClient
import { graphqlClient } from './services/graphqlClient';

const data = await graphqlClient.request(gql`
  query MyNewQuery($param: String!) {
    myNewQuery(param: $param) {
      field
    }
  }
`, { param: 'value' });
```

### 6. Running Production Build

```bash
# Frontend
npm run build
# Output: dist/ folder

# Backend (no build needed, runs directly)
cd backend
npm start  # Production mode
```

---

## 📦 Deployment

### Frontend (Cloudflare Pages)

**Automatic deployment on push to `main`:**
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables set in Cloudflare dashboard

**GitHub Actions workflow (`.github/workflows/deploy.yml`):**
1. Checkout code
2. Install dependencies
3. Build with Vite
4. Upload source maps to Sentry (production only)
5. Deploy to Cloudflare Pages
6. Update Linear issues (if commit contains `LIN-XXX`)

### Backend Deployment Options

**Option 1: VPS/Cloud Server (Recommended for Production)**
```bash
# Install dependencies
npm install --production

# Run with PM2
npm install -g pm2
pm2 start src/server.js --name vt-liveview-backend

# Environment variables
# Create backend/.env with production values
```

**Option 2: Docker**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --production
COPY backend/src ./src
EXPOSE 4000
CMD ["node", "src/server.js"]
```

**Option 3: Railway / Render**
- Auto-deploy from GitHub
- Set environment variables in dashboard
- Port detected automatically from `PORT` env var

**Option 4: Proxmox LXC Container**
```bash
# Create Ubuntu LXC
# Install Node.js 20
# Clone repo and follow VPS instructions
```

### Production Checklist

- [ ] Set `CONTACT_EMAIL` in backend environment (required by NOAA ToS)
- [ ] Configure `ALLOWED_ORIGINS` for CORS (frontend domain)
- [ ] Set `NODE_ENV=production` in backend
- [ ] Add Sentry DSN for error tracking (optional)
- [ ] Update `VITE_BACKEND_URL` to production backend URL
- [ ] Test all data sources are fetching correctly
- [ ] Verify dark mode toggle works
- [ ] Check mobile responsiveness

---

## 🐛 Known Issues & Ongoing Work

### Current Status: Audit 37% Complete (10/27 fixes done)

**Reference:** See `AUDIT_REPORT.md` for comprehensive details.

### High Priority Remaining Fixes
- [ ] **Remove unused functions** - `getCurrentRadarTileUrl()` in `useRadarAnimation.js:144`
- [ ] **Remove empty function** - `registerPMTilesProtocol()` in `mapStyles.js:136`
- [ ] **Fix ESLint warnings** - Incomplete dependency arrays in `WeatherMap.jsx:246`

### Medium Priority Remaining Fixes
- [ ] **Dark mode popup colors** - Popups have hardcoded light-mode colors in `TravelLayer.jsx:237`
- [ ] **Font weight normalization** - Inconsistent font weights across light/dark modes
- [ ] **Error boundaries** - Add try-catch blocks around VT 511 XML parsing
- [ ] **Accessibility** - Low contrast text in dark mode (`.incident-source` color)

### Low Priority (Deferred)
- [ ] Refactor `WeatherMap.jsx` (393 lines) into smaller components
- [ ] Extract marker management to custom hook in `TravelLayer.jsx`
- [ ] Implement theme context instead of prop drilling

### Recent Fixes (Session 1 - 2026-01-12)
- ✅ Fixed NOAA contact email (now uses `CONTACT_EMAIL` env var)
- ✅ Fixed CORS configuration (environment-aware, production-safe)
- ✅ Wrapped all console.log statements in `DEV` checks (25+ instances)
- ✅ Fixed memory leak in `gridPointCache` (added LRU eviction + timeout tracking)
- ✅ Removed unused dependencies (`picomatch`, `react-map-gl`, `@sentry/node`)

---

## 📝 Code Patterns & Best Practices

### 1. Console Logging (Always Wrap in DEV Check)
```javascript
// ✅ CORRECT
if (import.meta.env.DEV) {
  console.log('Debug info', data);
}

// ❌ WRONG - Will log in production builds
console.log('Debug info', data);
```

### 2. Map Layer Management
```javascript
// Always check if source exists before updating
if (map.current.getSource('my-source')) {
  map.current.getSource('my-source').setData(newData);
}
```

### 3. React Query Keys (Use Descriptive Arrays)
```javascript
// ✅ CORRECT - Specific, hierarchical
queryKey: ['weather', 'alerts', coordinates]

// ❌ WRONG - Too generic
queryKey: ['data']
```

### 4. Error Handling in Backend
```javascript
// Always include try-catch and meaningful errors
try {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return await response.json();
} catch (error) {
  if (import.meta.env.DEV) {
    console.error('Fetch failed:', error);
  }
  throw new Error(`Failed to fetch: ${error.message}`);
}
```

### 5. CSS Module Scoping
```css
/* Use descriptive class names, assume they're scoped */
.controls-panel { }
.control-section { }
.incident-item { }

/* Dark mode with .dark class on parent */
.controls-panel.dark { }
```

### 6. Theme Variables (Define in App.css)
```css
/* src/App.css */
:root {
  --color-primary: #3b82f6;
  --bg-glass: rgba(255, 255, 255, 0.85);
}

.dark {
  --bg-glass: rgba(0, 0, 0, 0.6);
}
```

---

## 🤖 Claude-Specific Tips for Efficiency

### When Starting a Session

**1. Check Recent Commit History**
```bash
git log --oneline -5
```
This tells you what was recently worked on.

**2. Check Current Branch**
```bash
git branch
```
Make sure you're on the right branch before making changes.

**3. Review Open Issues**
Check `AUDIT_REPORT.md` for known issues before diving into code.

### Finding Things Quickly

**Component locations:**
- Main map logic: `src/WeatherMap.jsx`
- Layer management: `src/components/TravelLayer.jsx`, `RadarOverlay.jsx`
- Data fetching: `src/services/*.js`
- Backend API: `backend/src/server.js`
- Styling: Component-specific CSS modules (e.g., `TravelLayer.css`)

**Common file patterns:**
```bash
# Find all API service files
ls src/services/*.js

# Find all components
ls src/components/*.jsx

# Find CSS modules
find src -name "*.css"

# Find GraphQL files
find backend -name "*.graphql"
```

### Before Making Changes

**1. Always read the file first:**
```bash
# NEVER propose changes without reading the file
# Example: If user asks to modify WeatherMap.jsx
cat src/WeatherMap.jsx  # Read it first!
```

**2. Check dependencies:**
```bash
# See what's installed
cat package.json
cat backend/package.json
```

**3. Look for existing patterns:**
```bash
# If adding a new layer, see how TravelLayer does it
grep -n "addSource" src/components/TravelLayer.jsx
```

### Common Pitfalls to Avoid

❌ **Don't assume Express.js** - Backend uses Fastify + Apollo GraphQL
❌ **Don't assume Redux** - Uses React Query for state management
❌ **Don't assume CSS-in-JS** - Uses CSS modules with scoped classes
❌ **Don't assume REST API** - Backend serves GraphQL (with some REST endpoints)
❌ **Don't assume Mapbox** - Uses MapLibre GL (open-source fork)
❌ **Don't create console.log without DEV check** - All logs must be wrapped
❌ **Don't add dependencies without checking existing solutions** - Keep bundle small

### Performance Considerations

- **React Query caches for 5 minutes** - Don't add additional caching unless needed
- **Map re-renders are expensive** - Avoid unnecessary state changes in `WeatherMap.jsx`
- **MapLibre layers are stateful** - Always check if layer exists before adding
- **Backend cache is LRU with max 100 entries** - Follow this pattern for new caches

---

## 📚 External Documentation Links

### Core Technologies
- **React 19:** https://react.dev/
- **Vite:** https://vitejs.dev/
- **MapLibre GL JS:** https://maplibre.org/maplibre-gl-js/docs/
- **React Query:** https://tanstack.com/query/latest/docs/framework/react/overview
- **Fastify:** https://fastify.dev/
- **Apollo GraphQL:** https://www.apollographql.com/docs/apollo-server/

### Data Source APIs
- **NOAA Weather API:** https://www.weather.gov/documentation/services-web-api
- **Iowa Mesonet (IEM):** https://mesonet.agron.iastate.edu/docs/
- **Vermont 511:** https://511vt.com/ (XML feed, no official docs)
- **USGS Water Services:** https://waterservices.usgs.gov/docs/
- **Protomaps:** https://protomaps.com/docs/basemaps

### Tools & Services
- **Cloudflare Pages:** https://developers.cloudflare.com/pages/
- **PR Agent (Qodo):** https://qodo.ai/pr-agent/
- **Sentry:** https://docs.sentry.io/

---

## 🎓 Learning Resources for This Codebase

### Understanding the Map
- Start with: `src/WeatherMap.jsx` - Main map initialization
- Then read: `src/utils/mapStyles.js` - Style configuration
- Then explore: `src/components/TravelLayer.jsx` - Layer management pattern

### Understanding Data Flow
1. `src/App.jsx` - React Query setup
2. `src/services/graphqlClient.js` - GraphQL client config
3. `backend/src/server.js` - API endpoints
4. `backend/src/services/noaa.js` - External API integration example

### Understanding Styling
1. `src/App.css` - Theme variables and global styles
2. `src/components/TravelLayer.css` - Component-scoped styles
3. `index.html` - Font loading (Orbitron from Google Fonts)

---

## 🚨 Emergency Debugging

### Frontend Not Loading?
```bash
# Check Vite dev server
npm run dev

# Check console for errors (browser DevTools)
# Common issues:
# - Missing VITE_PROTOMAPS_API_KEY
# - Backend not running
# - CORS errors (check backend CORS config)
```

### Backend Not Responding?
```bash
# Check if backend is running
cd backend
npm run dev

# Check port 4000 is available
lsof -i :4000

# Check backend logs for errors
# Common issues:
# - Port already in use
# - Missing CONTACT_EMAIL (NOAA API will fail)
# - CORS misconfiguration
```

### Map Not Displaying?
```bash
# 1. Check Protomaps API key in .env
# 2. Check browser console for MapLibre errors
# 3. Verify mapStyles.js:49 doesn't throw error
# 4. Check network tab for tile loading failures
```

### Data Not Loading?
```bash
# Check React Query DevTools (enabled in DEV mode)
# Look for failed queries
# Common issues:
# - Backend endpoint incorrect (check VITE_BACKEND_URL)
# - External API down (NOAA, VT 511, USGS)
# - CORS errors (backend ALLOWED_ORIGINS)
```

---

## 📞 Getting Help

### Project Resources
- **GitHub Issues:** https://github.com/mikemott/VT-Liveview/issues
- **Audit Report:** See `AUDIT_REPORT.md` for known issues
- **Session Notes:** See `SESSION_1_SUMMARY.md` for recent work

### When Asking Claude for Help
Include this context:
- What you're trying to accomplish
- What file(s) you're working in
- Any error messages (full stack trace)
- What you've already tried

**Example:**
> "I'm trying to add a new layer for air quality data to the map. I've created `src/services/airQuality.js` to fetch EPA data, but when I try to add the layer in `WeatherMap.jsx`, I get a MapLibre error: 'Layer already exists'. I've checked and there's no existing layer with that ID. Here's the code I added: [code snippet]"

---

## ✅ Session Initialization Checklist

When starting a new Claude session on this project:

- [ ] Read this CLAUDE.md file
- [ ] Check recent commits: `git log --oneline -5`
- [ ] Check Linear for open issues: `mcp__linear__list_issues` with team "VT LiveView"
- [ ] Review `AUDIT_REPORT.md` for known issues
- [ ] Verify current branch: `git branch`
- [ ] Check for existing worktrees: `git worktree list`
- [ ] Check if backend is running: `curl http://localhost:4000/health`
- [ ] Check if frontend is running: `curl http://localhost:5173`
- [ ] Review user's request and ask clarifying questions if needed

---

**Last Updated:** 2026-01-14
**Maintainer:** Mike Mott (mike@mottvt.com)
**License:** MIT
