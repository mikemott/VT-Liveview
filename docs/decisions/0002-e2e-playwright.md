# 0002: Playwright E2E with fixture-mocked upstreams

- **Date:** 2026-10-16
- **Issue:** VTL-45

## Decision
- E2E tests use Playwright (`e2e/`, `playwright.config.ts`) with three projects:
  `chromium`, `webkit`, and `mobile` (Pixel 7 emulation on Chromium).
- The tests run against the **production build** under `vite preview` (port 4173) and
  the **real backend** (port 4100), both started by Playwright's `webServer`.
- No test touches the real internet. Mocking happens in two layers:
  - **Backend:** `backend/src/test/e2e-server.ts` (`npm --prefix backend run e2e:server`)
    starts MSW with `upstreamHandlers.ts`, which serves the Phase 2 fixtures in
    `backend/src/__fixtures__`. Unmocked upstream requests error. The backend runs with
    `NODE_ENV=production` and `ALLOWED_ORIGINS=http://localhost:4173`, so the real CORS
    path is exercised. There is no database.
  - **Browser:** `e2e/fixtures.ts` routes every non-localhost request:
    - USGS and RainViewer get the `src/__fixtures__` JSON.
    - Radar tiles, sprites and NOAA icons get a transparent PNG.
    - Protomaps gets a TileJSON with empty vector tiles, so the basemap is blank.
    - Google Fonts gets empty CSS.
    - Anything else gets a 404 and fails the test.
- The browser clock is pinned to 2026-10-16 12:00 EDT, because the theme (sunrise and
  sunset) and the seasonal layers depend on it.
- `backend/src/test/__tests__/upstreamHandlers.test.ts` (vitest) checks that every
  query the UI makes returns data through the mock layer, so a new upstream URL fails
  there instead of showing up as a blank E2E page.
- **Accessibility:** `@axe-core/playwright` scans for WCAG 2.1 A/AA issues. Serious
  and critical violations fail the test, unless they are listed in `KNOWN` in
  `e2e/a11y.spec.ts` with a FINDINGS id.
- **Visual snapshots:** `toHaveScreenshot` with `maxDiffPixelRatio: 0.01`. Baselines
  are per project and per OS, and are committed under `e2e/*-snapshots/`.
  - The CI `e2e` job runs with `--update-snapshots=missing`, so a missing baseline is
    written and uploaded as the `snapshots-<project>` artifact rather than failing the
    test. Baselines that already exist are compared strictly.
  - To accept a new or changed baseline, download the artifact and commit the PNGs. To
    regenerate them all on a Linux machine, run `npm run test:e2e:update`.

## Why
- The upstream APIs are rate-limited, change data constantly, and are unreachable from
  CI sandboxes. Fixtures make the runs deterministic.
- Running the real backend, rather than mocking GraphQL in the browser, means the tests
  cover the resolvers, the CORS setup and the VT 511 proxy routes too.
- A blank basemap keeps screenshots stable across Protomaps style and data updates.
  Snapshots are meant to catch regressions in the UI chrome, not in map rendering.
- Browser binaries can't be downloaded in the agent sandbox, because
  `cdn.playwright.dev` is blocked. So the first baselines have to come from CI.

## Rejected alternatives
- **Mocking GraphQL with `page.route`.** Skips the backend entirely, and the resolvers,
  CORS and proxy routes would go untested.
- **A separate mock HTTP server for each upstream, with the backend's base URLs pointed
  at it.** That needs a base-URL environment variable for every upstream in production
  code. MSW in the backend process needs no production changes.
- **Hitting the real upstreams.** Flaky, slow, impolite to free public APIs, and
  impossible to snapshot.
- **Failing CI on a missing baseline.** That would make the first CI run red with no
  way to produce Linux baselines other than a local Docker run.
