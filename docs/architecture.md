# VT-LiveView Architecture

Taken from the code on 2026-10-28 (main @ 38e364b). If this file and the code
disagree, the code is right: fix this file.

## Overview

```
Browser (React 19 + Vite 7 + MapLibre GL 5, TypeScript)
  │  GraphQL (graphql-request + TanStack Query)   REST /api/*
  ▼
Backend (Fastify 4 + Apollo Server 4, TypeScript, Node 22)  ── Fly.io "vt-liveview-api" (bos)
  │  in-memory caches · node-cron collectors · optional Postgres (Drizzle)
  ▼
Upstreams: NOAA api.weather.gov · NOAA CDO/NCEI · IEM + RainViewer radar ·
           NE Compass C2C (VT 511 incidents, cameras, road weather) · USGS NWIS ·
           AirNow · NWS NWPS (river gauges) · RCC-ACIS (normals) ·
           DOE AFDC (EV chargers) · skivermont.com (scraped) · ANR / Burlington ArcGIS
```

The frontend is built and deployed by Cloudflare Pages itself (no workflow
file). `functions/index.ts` is a Pages Function that rewrites `<meta>` tags for
shared links. The backend deploys to Fly via `deploy-backend.yml` on pushes to
`main` that touch `backend/**`.

## Frontend (`src/`)

| Area | Files | Notes |
|---|---|---|
| Entry | `main.tsx`, `App.tsx` | QueryClient (5 min `staleTime`), ErrorBoundary |
| Map shell | `WeatherMap.tsx` (~1,800 lines) | Map init, theme/style swap, alert zone fills, layer toggles and filter chips, DetailPanel, "What's here?", URL state |
| Weather alerts | `components/AlertPopup.tsx`, `utils/alerts.ts` | NWS alerts in a popup on the map, refreshed every 5 min. Only Severe/Extreme alerts shade their area without a click; choosing an alert in the popup shades and zooms to it, "Details" opens the side panel (VTL-85) |
| Layer registry | `config/layers.ts` | One label, icon and colour per layer, shared by chips, markers and search. `layerPalette.test.ts` enforces that the colours stay distinct and keep their contrast. |
| Seasonal | `config/seasonalLayers.ts`, `hooks/useSeasonalLayers.ts`, `utils/roadWeather.ts` | Ski, creemee and road weather show by month |
| Layers | `components/*Layer.tsx` | Travel (VT 511 incidents/closures/construction + USGS gauges), WeatherStations, TrafficFlow (TomTom raster), Camera, RoadWeather, AirQuality, River (NWPS gauges), EvCharger, FireDanger (FPR rating areas), Ferry (static, animated boats), SeasonalRoads, Ski, Creemee, Camping, CampingAreas, Beach, Stargazing. Rivers and fire danger show themselves while flooding / at High or worse (`autoShown` in `WeatherMap.tsx`) until the user toggles them |
| Markers | `hooks/useMapMarkers.ts`, `utils/mapMarker.ts` | Shared DOM-marker lifecycle: markers and listeners are removed on hide, on data change and on unmount |
| Details | `DetailPanel.tsx` + `detail-views/*Detail.tsx` | Every layer opens in the side panel. `LocationDetail` is "What's here?" (`utils/locationContext.ts`) |
| Widgets | `RadarOverlay`, `CurrentWeather`, `AstronomyEvents`, `SearchBox`, `ShareMenu`, `ThemeToggle`, `MapUnavailable` (no WebGL) | |
| Data | `services/*Api.ts`, `services/graphqlClient.ts` | Mostly GraphQL. VT 511 data comes as XML from the backend REST proxy and is parsed in `vt511Api.ts`. USGS gauges are fetched straight from the browser. |
| Static data | `data/` | Seasonal roads, ferries (VTL-81, re-check each spring), dark-sky sites, meteor showers, light pollution, VT outline and towns (the `scripts/build-*.mjs` scripts generate some of these) |
| Utils | `utils/` | `sanitize.ts`, `mapStyles.ts` (Protomaps), `urlState.ts` / `sharePreview.ts`, `astronomy.ts`, `aqi.ts`, colour/icon maps |
| Styles | `styles/design-system.css` (vintage tokens), `App.css` (older tokens), one `.css` per component | Two token systems coexist (FINDINGS H14) |

Env (`src/types/env.ts`, zod): `VITE_PROTOMAPS_API_KEY` (required),
`VITE_TOMTOM_API_KEY`, `VITE_BACKEND_URL`, `VITE_GRAPHQL_ENDPOINT`.

## Backend (`backend/src/`)

| Area | Files | Notes |
|---|---|---|
| App | `app.ts` (`buildServer()`), `server.ts` (listen + scheduler + shutdown) | CORS (env-aware), `@fastify/rate-limit` (exempts `/health` and `/graphql`, FINDINGS H3), Apollo at `/graphql` |
| REST | `app.ts` | `GET /health`, `POST /admin/clear-cache` (`x-admin-token` in prod), `GET /api/vt511/{incidents,closures,traffic-conditions,network}`, `/api/road-weather`, `/api/air-quality`, `/api/air-quality/monitors`, `/api/rivers`, `/api/rivers/:id`, `/api/climate/today`, `/api/ev-chargers`, `/api/fire-danger`, `/api/cameras`, `/api/cameras/:id/snapshot.jpg`, `POST /api/ski-conditions/refresh` |
| GraphQL | `schema.graphql`, `resolvers/{index,beach,historical}.ts` | currentWeather, forecast, alerts, mergedAlerts, radarInfo, observationStations, historicalData, weather/alert/incident/gaugeHistory, dailyWeatherStats, skiResorts, creemee*, beaches, recreationSites, backcountrySites, campingAreas |
| Services | `services/*.ts` | One module per upstream, each with its own cache: noaa, noaaCDO, radar, zones, c2c (shared NE Compass XML helper), trafficCameras, roadWeather, airQuality, rivers (NWPS), climate (ACIS normals/records), evChargers (AFDC), fireDanger (ANR feature service), skiConditions (cheerio), beachWaterQuality, campingAreas, recreationSites, backcountrySites, parkBoundaries, creemee |
| Static data | `data/` | `creemeeStands.json`, `vtBeaches.json`, `resortData.ts`. `scripts/buildCreemeeData.ts` regenerates the creemee data. |
| Collectors | `collectors/`, `scheduler/index.ts` | node-cron: weather */5, alerts */2, traffic */3, gauges */10 min, wrapped in `withRetry`. Only runs with `DATABASE_URL` set and `ENABLE_COLLECTOR` on. |
| DB | `db/{index,schema,migrate}.ts`, `db/migrations/` | Drizzle + postgres-js. Tables: weatherObservations, weatherAlerts, trafficIncidents, riverGauges. Optional: with no DB, the history features are off. |
| Env | `types/env.ts` | Zod-validated at startup. The source of truth for backend env vars. |

## Tests and CI

- **Unit/integration:** Vitest in both packages.
  - Frontend: happy-dom + Testing Library. The shared maplibre mock is in `src/test/`.
  - Backend: node + `fastify.inject`.
  - MSW serves all outbound HTTP from synthetic fixtures in `__fixtures__/`.
  - Coverage thresholds are enforced by `test:coverage`.
- **E2E:** Playwright (`e2e/`, `playwright.config.ts`), projects `chromium`, `webkit` and `mobile`.
  - `webServer` starts `backend/src/test/e2e-server.ts`, the real app with MSW upstreams, on :4100, and `vite preview` on :4173.
  - `e2e/fixtures.ts` blocks all other browser traffic.
  - See ADR 0002.
- **`ci.yml`:**
  - A frontend/backend matrix runs lint, typecheck, format:check, test:coverage and build.
  - An `e2e` matrix runs the three Playwright projects.
- **Other workflows:** `deploy-backend.yml` (Fly), `ski-conditions-cron.yml` (refresh at 11:00 and 19:00 UTC), `linear-sync.yml` (moves the Linear issue to In Review when its PR opens).
