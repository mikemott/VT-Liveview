# VT-LiveView Production-Readiness Findings (VTL-45, Phase 0)

_Generated 2026-10-14 against commit `c441286`. Four read-only reviewers (security, backend correctness, frontend correctness, performance + UI/a11y) worked in parallel; their findings were deduplicated and ranked here. Every critical/high item was re-checked against the code by hand. **Verified** = confirmed by reading the code. **Plausible** = the mechanism is in the code, but whether it fires depends on runtime ordering. Nothing was confirmed in a running browser._

Severity: **C** critical · **H** high · **M** medium · **L** low. Line numbers refer to `c441286`.

## Baseline (verified)

| Check | Result |
|---|---|
| `npm ci` (root, backend) | OK on Linux / Node 22. The lockfile has all `@rollup/rollup-*` platform binaries. |
| `vitest run` root | 5 files / 96 tests pass after a clean `npm ci`. **The rollup-native crash does not reproduce.** The likely cause is npm's optional-deps bug ([npm/cli#4828](https://github.com/npm/cli/issues/4828)) in an old `node_modules`; the fix is `rm -rf node_modules && npm ci`. |
| `vitest run` backend | 2 files / 34 tests pass |
| `tsc --noEmit` root | 6 errors (CampingAreasLayer ×2, CampingContent, RadarOverlay ×3) |
| `tsc --noEmit` backend | 20 errors, all in `src/scripts/buildCreemeeData.ts` |
| ESLint | Config matches `**/*.{js,jsx}` only, so effectively nothing is linted |
| `npm audit` | root: 2 critical / 13 high (mostly dev tooling). backend: 3 critical / 17 high |
| CI | `ci.yml` runs frontend test + build only, Node 20 |

## Critical

| # | Where | Finding | Failure scenario | Fix | Status |
|---|---|---|---|---|---|
| C1 | `src/WeatherMap.tsx:572` | The map-init effect depends on `[fetchAlertsFromBackend, isDark]`, and its cleanup calls `map.remove()`. | Every theme change (manual, or automatic at sunrise/sunset) destroys and rebuilds the whole map: camera, markers, layers and WebGL context are lost. `mapLoaded` stays `true`, so child layers call `addSource`/`addLayer` on a map whose style hasn't loaded, and the `setStyle` effect (:595) runs on the half-initialised map. | Use `[]` deps and read the theme from a ref. Leave theme changes to the `setStyle` effect only. | Verified |
| C2 | `src/WeatherMap.tsx:505-509` → `TravelLayer.tsx:245-251, 254-491` | The `zoom` event calls `setCurrentZoom` on every frame. `visibleIncidents` is memoised on the raw float zoom, so the marker effect tears down and rebuilds every incident marker and closes the shared popup. | Zoom jank, and open popups close as soon as the user zooms. | Track zoom on `zoomend`, or bucket it to the `shouldShowIncident` thresholds. Diff markers by id. | Verified |
| C3 | `src/WeatherMap.tsx:832` + `CampingLayer.tsx:288-349` | The inline `onCountsChange` arrow is a dependency of CampingLayer's fetch effect, and the fetch ignores `visible`. CampingLayer is mounted by default. `recreationApi` has no cache. | A GraphQL `recreationSites` request on every WeatherMap render, which together with C2 means every zoom frame, even when camping is hidden. | Wrap the callback in `useCallback`, gate the fetch on `visible`, and move it to React Query. | Verified |

## High

### Backend

| # | Where | Finding | Fix | Status |
|---|---|---|---|---|
| H1 | `backend/src/services/noaa.ts:455` + `collectors/alerts.ts:26,63` | The merged alert id is `merged-<event>-${Date.now()}`, and the collector uses it as the `noaaAlertId` dedupe key. A 24h warning inserts about 720 rows, and `lastSeenAt` is never updated. | Use a stable id, e.g. a hash of event + sorted `mergedFrom` ids. | Verified |
| H2 | `backend/src/collectors/index.ts:48` + `scheduler/index.ts:62-70` | `withRetry` returns `null` on total failure, so the scheduler `catch` is dead code and `lastError` is reset to `null`. `/health` reports healthy collectors during an outage. | Rethrow after the last attempt. | Verified |
| H3 | `backend/src/server.ts:126-133` | Rate-limit `allowList` exempts `url === '/graphql'`, so all POST GraphQL traffic is unlimited. Without `trustProxy` / `fly-client-ip`, every client behind Fly shares one bucket for `/api/vt511/*`. | Rate-limit GraphQL with its own bucket, and key on `fly-client-ip`. | Verified |
| H4 | `backend/src/server.ts:157-182`, `db/index.ts:37` | `/health` returns 200 even when `degraded`. The DB ping can take up to the 10s `connect_timeout`, but the Fly check timeout is 5s. Collector staleness is ignored. | Return 503 when degraded, put a 2s timeout on the ping, and treat a stale collector as degraded. | Verified (code) |
| H5 | ~20 upstream `fetch` calls (noaa, zones, radar, skiConditions, recreationSites, backcountrySites, parkBoundaries, collectors/traffic, collectors/gauges, server VT511 proxies) | No timeout or `AbortSignal`, and cron jobs have no "already running" guard. | A hung upstream socket makes cron runs pile up and exhaust the 5-connection pool. GraphQL requests hang. Fix: `AbortSignal.timeout(10_000)` everywhere plus a per-collector `running` flag. | Verified (sampled) |
| H6 | `backend/package-lock.json` | Audit: fastify 4 (several advisories, fix is v5), drizzle-orm <0.45.2 (identifier SQLi, not reachable with current usage), @apollo/server CSRF bypass (non-breaking fix available), undici, proxy-addr (critical). | Run `npm audit fix` for the non-breaking fixes; plan fastify 5 / drizzle upgrades. **Needs owner decision (major upgrades).** | Verified (audit) |

### Frontend

| # | Where | Finding | Fix | Status |
|---|---|---|---|---|
| H7 | `src/WeatherMap.tsx:149-153` | `off('click', 'alert-fills')` without the handler removes nothing in maplibre 5.15. Every style reload adds another set of click/hover handlers, so one click opens the panel N times. | Keep the handlers in refs, or register them once. | Verified |
| H8 | `src/App.tsx:11` | `getEnv()` runs at module scope and throws in production. The ErrorBoundary can't catch it, so the result is a blank page. | Validate env inside a component under the boundary, or render a fallback from `main`. | Verified |
| H9 | `src/App.tsx:25-31` | One root ErrorBoundary only. Any layer, panel or widget render error unmounts the whole map, and recovery is a full reload. | Add per-layer boundaries plus ones for DetailPanel and CurrentWeather. | Verified |
| H10 | `src/components/RadarOverlay.tsx:95-145, 247-279` | Async layer-add loop: `layersInitialized` is set synchronously before the loop finishes, the loop is never cancelled on cleanup, and the visibility/opacity effect only re-runs on frame or opacity changes. The current frame's layer can stay at opacity 0 until the user interacts, and old and new loops interleave after a refresh. | Add a cancellation flag, and apply visibility/opacity per layer as it is added (or bump state when the loop ends). | Plausible |
| H11 | `RadarOverlay.tsx:48-68`, `StargazingLayer.tsx:61-100` | `hasLayer`/`hasSource` guard on `map.isStyleLoaded()`, which is false while tiles load. The result is a missed init, an "already a source" throw, and skipped cleanup that leaves layers orphaned. | Use `map.getLayer` / `getSource` directly, or wait for `idle`. | Verified |

### Performance / bundle

| # | Where | Finding | Fix | Status |
|---|---|---|---|---|
| H12 | `vite.config.ts`, all layers | No `manualChunks`, and no `React.lazy` or dynamic import anywhere. maplibre, protomaps and every layer and dataset (about 33KB of astronomy data) go into the entry chunk. | Split vendor/maplibre chunks; lazy-load the default-off layers and DetailPanel. | Verified |
| H13 | All `*Layer.tsx` | Every point layer uses DOM `maplibregl.Marker`, with no clustering. Several hundred markers are possible (backcountry 100-300, stations, creemee). CampingContent's "click clusters" text describes a feature that doesn't exist. | Move the dense layers to GeoJSON + circle/symbol layers with `cluster: true`. | Verified |

### UI / a11y

| # | Where | Finding | Fix | Status |
|---|---|---|---|---|
| H14 | `src/App.css` vs `src/styles/design-system.css` | Two token systems. App.css has 63 vars, 28 unused, and overrides design-system `--shadow-*` because it loads later. Raw hex: 347 lines in CSS plus 150+ in TS. | Consolidate in Phase 4. | Verified |
| H15 | Every marker factory | Markers are click-only `div`s with no `role`, `tabIndex`, `aria-label` or key handler. No POI can be reached by keyboard or screen reader. | Add a button role, focusability, a label and an Enter/Space handler, or an accessible list. | Verified |
| H16 | `src/WeatherMap.tsx` alert cards, `src/components/RadarOverlay.tsx` timeline | Nested interactive controls (axe `nested-interactive`, serious). Each alert card was a `role="button"` div containing a dismiss `<button>` that did nothing. The radar `role="slider"` contained one `<button>` per frame. | Make the card a container with sibling zoom and dismiss buttons, and implement dismiss. Make the timeline dots non-focusable, with the slider handling clicks on them. | Verified by axe in the first E2E run (CI 39462801094); fixed on `agent/vtl-45` |
| H17 | `src/components/WeatherStationsLayer.tsx` marker colours | White 10-11px marker text on `#588bae` / `#3b82f6` is 3.7:1, below WCAG AA's 4.5:1 (axe `color-contrast`). | Darken to `#41749a` / `#2563eb` (5.0:1 / 5.2:1). | Verified by axe in the first E2E run (CI 39462801094); fixed on `agent/vtl-45` |

## Medium

**Backend**
- `noaa.ts:867` `getObservationStations` caches an empty array for 15 minutes after a total upstream failure, overwriting good data.
- In five caches (skiConditions, beachWaterQuality, backcountrySites, recreationSites, parkBoundaries), the TTL timer clears the Map, so the stale-on-error fallback is dead code and an outage returns `[]` uncached.
- In the resolvers, services return `[]` instead of throwing, so an outage looks like a successful empty result.
- `POST /api/ski-conditions/refresh` (`server.ts:298`) never refreshes when the cache is warm, can't report failure, and has no auth.
- The VT511 proxy routes (`server.ts:236-290`) don't check `response.ok`, so an upstream 502 is relayed as 200 XML.
- GraphQL has no depth/complexity/alias limit, and `introspection: true` is on in prod. Aliased `weatherHistory(limit:1000)` queries are unbounded.
- The `noaaCDO.ts:185` cache is keyed by lat/lng, so coordinate cycling can burn the 1000/day CDO quota.
- Graceful shutdown (`server.ts:352-369`):
  - The DB is closed before Fastify.
  - `getDb()` silently reconnects after close.
  - There is no forced-exit timer.
  - The initial 5s collector `setTimeout` is not cancelled.
- `historical.ts:138,190`: `firstSeenAt: String!`, but the column is nullable.
- Raw DB/driver errors reach clients (there's no `formatError`). `/health` exposes the DB error message.
- With a non-production `NODE_ENV`, CORS opens to `origin: true` and the admin token check is skipped (fail-open).

**Frontend**
- `TrafficFlowLayer.tsx:155` uses the stale `visible` closure, so hidden traffic reappears after a theme change. Its retry and 1s timers (:69-84, :238) are never cleared.
- `useRadarAnimation.ts:238-245`: the fallback path doesn't reset `currentFrame`. At :258/:316, refreshes overlap with no abort or sequence guard.
- `WeatherStationsLayer.tsx:128` leaks a `createRoot` per USGS marker (never unmounted). At :165, `onStationClick` is never called, so the station detail panel can't be reached.
- `CurrentWeather.tsx:26,35`: query keys use raw float coordinates, so the cache grows with every pan. The `['forecast', …]` prefix collides with `useForecast`, which has a different shape.
- `CurrentWeather.tsx:56-75` shows **fake placeholder weather** (32°F, "Partly Cloudy") on error.
- `travelApi.ts:233` uses `Promise.all`, so a USGS outage hides all VT511 incidents (use `allSettled`).
- `StargazingLayer.tsx:200` creates one React root per marker and rebuilds them on every theme flip.

**Perf / UI**
- Orbitron is loaded render-blocking in `index.html:9` and never used.
- `design-system.css:16-18` has three chained Google Fonts `@import`s.
- 51 `!important` declarations (WeatherMap.css 19, RadarOverlay.css 12).
- Touch targets under 44px: backcountry markers 22/26px, other markers 32-34px, `.alert-dismiss` 22px.
- `WeatherMap.tsx:879-904`: the alert card nests a `<button>` in `role="button"`, and the "Dismiss" button does nothing.
- There are no `prefers-reduced-motion` rules anywhere (9 infinite animations, radar autoplay, 1.5s flyTo).
- Popups use emoji icons while markers use Lucide.

## Low

- `collectors/traffic.ts:58` returns early on an empty feed, so stale incidents are never resolved. At :167, a fallback id creates churn rows.
- `noaa.ts:98`, `noaaCDO.ts:302,342`: orphaned TTL timers on concurrent misses delete fresh entries. The "LRU" caches are really FIFO.
- `noaa.ts:837`: a missing observation timestamp falls back to `now()`. At :692-711, the lake water temperature is stored as air temperature.
- `server.ts:372`: `start()` has no `.catch`. `ENABLE_COLLECTOR` only accepts the exact string `'true'`. The startup log claims a DB connection that was never checked.
- `noaa.ts:215,316`: `state` isn't validated or encoded in the `?area=` query (parameter injection, not SSRF).
- Defence-in-depth XSS: `TravelLayer.tsx:386` `incident.type` and `CampingAreasLayer.tsx:126` type label aren't escaped. Both are currently enum-only. All other popup strings were confirmed escaped.
- Root deps: maplibre-gl ≤6.4 sanitizer advisory (the app doesn't use that sanitizer), plus vite/vitest/happy-dom dev-server advisories.
- `VITE_PROTOMAPS_API_KEY` / `VITE_TOMTOM_API_KEY` are bundled by design. Restrict them by referrer in the provider dashboards.
- Frontend:
  - `window.map` exposed in prod, and webgl `console.*` not gated (`WeatherMap.tsx:425-475`).
  - `moveEndTimeout` isn't cleared on unmount.
  - Highlights aren't re-added after a style swap.
  - CampingLayer popups are untracked.
  - 0°F shows as "N/A" (`WeatherStationsLayer.tsx:272`).
  - Alerts are fetched only once and never refreshed.
  - Raw z-index values (10000, '1000', 2, 1) bypass the `--z-*` scale.

## Checked and clean
- **SQL:** Drizzle only, and no user-controlled interpolation.
- **Secrets:** none committed, in the tree or in history. `.env` and `.env.local` are gitignored.
- **Scraper:** the cheerio scraper only keeps whitelisted resort names plus parsed integers.
- **SSRF:** no outbound URL is built from user input.
- **CSRF:** Apollo CSRF prevention is on.
