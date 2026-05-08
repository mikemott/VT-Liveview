# Backend Server Testing Guide

## Quick Status Check

The backend should be running on **http://localhost:4000**

### 1. Check if Backend is Running

```bash
# In the backend directory
cd backend
npm run dev
```

You should see:
```
Server listening on http://0.0.0.0:4000
GraphQL server ready at http://localhost:4000/graphql
```

### 2. Test Health Endpoint

```bash
curl http://localhost:4000/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2026-05-08T13:05:13.931Z",
  "database": {
    "enabled": false,
    "connected": false
  }
}
```

### 3. Test GraphQL Endpoint

```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ radarInfo { baseUrl } }"}'
```

**Expected response:**
```json
{
  "data": {
    "radarInfo": {
      "baseUrl": "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::CONUS-NEXRAD-N0Q"
    }
  }
}
```

## Available Endpoints

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with database status |
| `/graphql` | POST | GraphQL API endpoint |

### GraphQL Queries

| Query | Description | Example |
|-------|-------------|---------|
| `currentWeather(lat, lon)` | Current weather for coordinates | `{ currentWeather(lat: 44.26, lon: -72.58) { temperature } }` |
| `forecast(lat, lon)` | 7-day forecast | `{ forecast(lat: 44.26, lon: -72.58) { name temperature } }` |
| `alerts(state)` | Active weather alerts | `{ alerts(state: "VT") { event severity } }` |
| `radarInfo` | Radar tile information | `{ radarInfo { baseUrl timestamps { time } } }` |
| `skiResorts` | Ski resort conditions | `{ skiResorts { name snowfall24hr liftsOpen } }` |

## Troubleshooting

### "Cannot reach backend at localhost:4000"

**Symptoms:**
- Frontend shows connection errors
- `curl http://localhost:4000/health` fails
- No process listening on port 4000

**Solutions:**

1. **Check if backend is running:**
   ```bash
   lsof -i :4000
   ```
   If nothing shows up, the backend isn't running.

2. **Start the backend:**
   ```bash
   cd backend
   npm run dev
   ```

3. **Check for port conflicts:**
   ```bash
   lsof -i :4000
   ```
   If another process is using port 4000, either:
   - Kill that process: `kill -9 <PID>`
   - Change backend port in `backend/.env`: `PORT=4001`

4. **Check environment variables:**
   ```bash
   cd backend
   cat .env
   ```
   Ensure these are set:
   ```
   PORT=4000
   HOST=0.0.0.0
   CONTACT_EMAIL=your-email@example.com
   ALLOWED_ORIGINS=http://localhost:5173
   ```

5. **Check for errors in backend logs:**
   The `npm run dev` output should show:
   - No TypeScript errors
   - "Server listening on http://0.0.0.0:4000"
   - No uncaught exceptions

### "CORS errors when frontend tries to connect"

**Symptom:**
```
Access to fetch at 'http://localhost:4000/graphql' from origin 'http://localhost:5173'
has been blocked by CORS policy
```

**Solution:**
Check `backend/.env` has:
```
ALLOWED_ORIGINS=http://localhost:5173
```

If you're running frontend on a different port, add it:
```
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### "Backend starts but GraphQL queries fail"

**Symptoms:**
- Health endpoint works: `curl http://localhost:4000/health` ✅
- GraphQL fails with errors

**Common Causes:**

1. **NOAA API issues** (check backend logs for "NOAA API error")
   - Solution: Wait a few minutes, NOAA may be rate-limiting

2. **Missing environment variable:**
   ```
   Error: CONTACT_EMAIL is required
   ```
   - Solution: Add to `backend/.env`: `CONTACT_EMAIL=your-email@example.com`

3. **Invalid GraphQL query syntax:**
   - Use GraphQL Playground: http://localhost:4000/graphql
   - Check query syntax matches schema

## Testing Without Backend (Radar Fix)

**Important:** The radar tiles now fetch **directly from RainViewer**, so the backend is NOT required for radar functionality.

To test radar without backend:
1. Start only the frontend: `npm run dev` (in root directory)
2. Open http://localhost:5173
3. Radar should load using RainViewer API directly

The backend is only needed for:
- Current weather data (NOAA)
- Forecasts (NOAA)
- Weather alerts (NOAA)
- Ski resort conditions

## Verifying Backend is Working

Run this all-in-one test:

```bash
#!/bin/bash
echo "=== VT-LiveView Backend Test ==="
echo ""

# 1. Check if port is listening
if lsof -i :4000 > /dev/null 2>&1; then
  echo "✅ Port 4000 is listening"
else
  echo "❌ Port 4000 not listening - backend may not be running"
  exit 1
fi

# 2. Test health endpoint
HEALTH=$(curl -s http://localhost:4000/health)
if echo "$HEALTH" | jq -e '.status == "ok"' > /dev/null 2>&1; then
  echo "✅ Health endpoint responding"
else
  echo "❌ Health endpoint failed"
  exit 1
fi

# 3. Test GraphQL
GRAPHQL=$(curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __typename }"}')
if echo "$GRAPHQL" | jq -e '.data' > /dev/null 2>&1; then
  echo "✅ GraphQL endpoint responding"
else
  echo "❌ GraphQL endpoint failed"
  exit 1
fi

echo ""
echo "🎉 Backend is fully operational!"
```

Save as `test-backend.sh`, make executable with `chmod +x test-backend.sh`, then run `./test-backend.sh`.
