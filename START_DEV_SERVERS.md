# Starting VT-LiveView Development Servers

## Quick Start (2 Terminals)

### Terminal 1: Backend

```bash
cd backend
npm run dev
```

**Expected output:**
```
Server listening on http://0.0.0.0:4000
GraphQL server ready at http://localhost:4000/graphql
```

### Terminal 2: Frontend

```bash
# From project root
npm run dev
```

**Expected output:**
```
VITE v7.3.1  ready in 331 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

Then open: **http://localhost:5173**

---

## Environment Setup

### Frontend (.env in project root)

Create `.env` file:
```bash
# Required: Protomaps API key (get free at https://protomaps.com/api)
VITE_PROTOMAPS_API_KEY=pm_xxxxxxxxxxxxx

# Optional: Backend URL (defaults to http://localhost:4000)
VITE_BACKEND_URL=http://localhost:4000
VITE_GRAPHQL_ENDPOINT=http://localhost:4000/graphql
```

**Important:** Without `VITE_PROTOMAPS_API_KEY`, the base map won't load!

Get your free API key:
1. Go to https://protomaps.com/api
2. Sign up (free tier: 1M views/month)
3. Copy your API key
4. Add to `.env`

### Backend (.env in backend/ directory)

The backend `.env` should have:
```bash
PORT=4000
HOST=0.0.0.0
NODE_ENV=development
CONTACT_EMAIL=your-email@example.com  # Required by NOAA
ALLOWED_ORIGINS=http://localhost:5173
```

---

## Testing the Radar Fix

After starting both servers:

1. Open http://localhost:5173
2. Open browser DevTools (F12)
3. Check Console tab - should see:
   - ✅ "Map loaded!"
   - ✅ No CORS errors
   - ✅ No 429 errors
4. Check Network tab - filter to "rainviewer":
   - ✅ Tile requests spaced ~400ms apart
   - ✅ All tiles return 200 OK (not 429)
5. Wait 3-5 seconds
6. Radar overlay should appear on the map
7. Click Play button to test animation (4 frames)

**Expected behavior:**
- Radar tiles load without errors
- No "Zoom Level Not Supported" messages
- Animation plays smoothly

---

## Troubleshooting

### Frontend Issues

**❌ "Failed to load module" or import errors**
```bash
# Install dependencies
npm install
```

**❌ Base map doesn't load (gray background)**
- Check `.env` has `VITE_PROTOMAPS_API_KEY`
- Restart dev server after changing `.env`
- Check browser console for API key errors

**❌ "Cannot connect to backend"**
- Ensure backend is running on port 4000
- Check `VITE_BACKEND_URL` in `.env` matches backend URL
- Check CORS settings in `backend/.env`

**❌ Port 5173 already in use**
```bash
# Kill existing Vite process
lsof -ti :5173 | xargs kill -9

# Or use a different port
npm run dev -- --port 5174
```

### Backend Issues

**❌ Backend won't start**
```bash
cd backend
npm install  # Install dependencies
npm run dev
```

**❌ Port 4000 already in use**
```bash
# Find and kill process
lsof -ti :4000 | xargs kill -9

# Or change port in backend/.env
PORT=4001
```

---

## Testing Individual Components

### Test Radar (No Backend Required)

Radar now fetches directly from RainViewer, so you can test it without the backend:

```bash
# Start only frontend
npm run dev

# Open http://localhost:5173
# Radar should load after 3-5 seconds
```

### Test Weather Data (Requires Backend)

Current weather, forecasts, and alerts need the backend:

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
npm run dev

# Open http://localhost:5173
# Click on map to see current weather
```

---

## All-in-One Test Script

Save as `start-dev.sh`:

```bash
#!/bin/bash

# Check if backend is already running
if ! lsof -i :4000 > /dev/null 2>&1; then
  echo "Starting backend..."
  cd backend
  npm run dev > ../backend.log 2>&1 &
  BACKEND_PID=$!
  cd ..
  echo "Backend PID: $BACKEND_PID"
  sleep 3
else
  echo "✅ Backend already running on port 4000"
fi

# Check if frontend is already running
if ! lsof -i :5173 > /dev/null 2>&1; then
  echo "Starting frontend..."
  npm run dev > frontend.log 2>&1 &
  FRONTEND_PID=$!
  echo "Frontend PID: $FRONTEND_PID"
  sleep 3
else
  echo "✅ Frontend already running on port 5173"
fi

echo ""
echo "🚀 Development servers ready!"
echo ""
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:4000"
echo "   GraphQL:  http://localhost:4000/graphql"
echo ""
echo "Logs:"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
```

Usage:
```bash
chmod +x start-dev.sh
./start-dev.sh
```

To stop servers:
```bash
# Find processes
lsof -ti :4000 :5173

# Kill them
lsof -ti :4000 :5173 | xargs kill
```

---

## Verifying Everything Works

Run this checklist:

```bash
# 1. Backend health check
curl http://localhost:4000/health
# Should return: {"status":"ok", ...}

# 2. GraphQL check
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __typename }"}'
# Should return: {"data":{"__typename":"Query"}}

# 3. Frontend check
curl http://localhost:5173
# Should return: HTML with <title>VT LiveView</title>

# 4. Open in browser
open http://localhost:5173
# Should see Vermont map with radar overlay
```

✅ If all checks pass, you're ready to develop!
