# VT-LiveView: Project Status & Roadmap

What we're working on and in what order. For how to work in the repo see
`CLAUDE.md`. For how the system fits together see `docs/architecture.md`.
For past decisions see `docs/decisions/`. Linear (team **VTL**, project
**VT LiveView**) is the source of truth for individual issues. Keep a backlog
there, not here.

_Last updated: 2026-10-28 (VTL-46, main @ 38e364b)_

## Current state

- **Production:** frontend on Cloudflare Pages (vtliveview.com), backend on Fly.io (`vt-liveview-api`, region `bos`, Node 22).
- **Code:** all TypeScript. `npm run check` (lint, typecheck, Prettier, unit tests) is green in both packages, and CI also runs coverage thresholds, build and a Playwright E2E matrix.
- **Layers:**
  - radar, NOAA alerts, current weather + forecast, weather stations
  - VT 511 incidents (accidents, construction, closures, floods, hazards), TomTom traffic flow, traffic cameras, road weather stations (in season), seasonal road closures
  - USGS gauges, air quality (AirNow), river and lake levels with NWS flood stages, fire danger (FPR), EV chargers (AFDC)
  - weather card: today's forecast vs the 1991-2020 normal, plus daily records (ACIS)
  - ski (in season), creemee (in season), camping, camping areas, beaches, stargazing/astronomy
- **UI:** every layer opens in the shared side DetailPanel. Clicking empty map shows "What's here?". There's a search box, a share menu with per-view link previews (Cloudflare Pages Function in `functions/`), and a fallback when WebGL is unavailable.
- **Historical:** the root-level reports (`AUDIT_REPORT.md`, `PRODUCTION_REVIEW.md`, `SESSION_1_SUMMARY.md`, `TESTING_REPORT.md`, …) describe the pre-TypeScript code. Don't treat their checklists as current.

## Production-readiness review (VTL-45): status

Source: [VTL-45 "Code Review"](https://linear.app/quillstack/issue/VTL-45/code-review)
has the full brief, and its comments hold the handoffs. Findings are in
`docs/review/FINDINGS.md` (C = critical, H = high, M, L ids). VTL-45 was closed
on 2026-10-22 when PRs #97–#101 and #96 merged. Phases 4 and 5 were **not**
done in it.

Rules from the brief that still apply to follow-up work:
- One branch + PR per phase, rebased on `origin/main`.
- `npm run check` must be green in both packages.
- Never weaken a test or lint rule to make it pass.
- No new dependencies without asking Mike.
- No merge without Mike's approval.

### Done
- [x] **Phase 0: discovery.** `docs/review/FINDINGS.md`: 3 critical and 17 high findings, each re-checked against the code.
- [x] **Phase 1: tooling** (ADR 0001).
  - Type-aware ESLint for TS/TSX (react-hooks, jsx-a11y) and a separate backend config.
  - tsc clean in both packages; `main.tsx`.
  - `lint`/`typecheck`/`test`/`check` scripts.
  - Prettier, husky + lint-staged.
  - Node 22 (`.nvmrc`, Dockerfile).
  - CI matrix.
- [x] **Phase 2: unit/integration tests.**
  - MSW for all outbound HTTP; synthetic fixtures in `__fixtures__/` (`scripts/record-fixtures.sh` records real ones).
  - Shared maplibre mock in `src/test/`.
  - `buildServer()` in `backend/src/app.ts` for `fastify.inject`.
  - Coverage thresholds enforced.
  - Fixed H1, H2, H4, H7 and many medium/low findings.
- [x] **Phase 3: E2E** (ADR 0002).
  - Playwright (chromium, webkit, mobile/Pixel 7) against `vite preview` plus a mocked-upstream backend (`backend/src/test/e2e-server.ts`).
  - axe checks.
  - CI `e2e` job.
  - Fixes from the first run: H10, H11, H16, H17, and H15 for weather stations only.

### Open
- [ ] **Commit the visual snapshot baselines.**
  - `e2e/visual.spec.ts` has none committed, so visual tests fail locally.
  - In CI they're written with `--update-snapshots=missing` and uploaded as `snapshots-<project>` artifacts.
  - Download them from a green CI run and commit them (ADR 0002). Don't commit locally generated PNGs.
- [ ] **Keyboard/screen-reader access for markers on the other layers (H15).** Weather stations are done. Many layers now go through the shared `hooks/useMapMarkers.ts` / `utils/mapMarker.ts`, so check what's left before starting.
- [ ] **Unresolved findings.**
  - `grep -rn "TODO(VTL-45" src backend/src` lists 5 inline lint disables.
  - `grep -rn "it.todo" src backend/src` lists 28 todo tests, each citing a FINDINGS id (e.g. H3 GraphQL rate limit, H5 fetch timeouts / cron overlap).
  - Check FINDINGS.md's Status column and the current code before picking one up. Main has moved on since the review.
- [ ] **Phase 4: UI consistency. Needs Mike's sign-off on the audit before any code changes.**
  - Write `docs/review/UI_AUDIT.md` with screenshots first.
  - Then:
    - token consolidation (H14: `App.css` vs `styles/design-system.css`)
    - raw-hex cleanup
    - typography roles (drop Orbitron)
    - radius/z-index scale
    - one icon system
    - marker hit areas and states
    - consistent layer controls and status indicators
    - a11y (focus, contrast, `prefers-reduced-motion`)
  - Since VTL-45, main has already unified some of this: the side panel (#122), layer palette (#119, #124), shared markers (#122, #126). The audit should start from the current UI.
- [ ] **Phase 5: hardening & docs.**
  - **Backend:**
    - pino structured logs
    - timeouts on every upstream fetch (H5)
    - GraphQL depth/complexity limits
    - check graceful shutdown covers everything (SIGTERM/SIGINT handlers already exist in `server.ts`)
    - dependency upgrades from the audit (H6: fastify 5, drizzle ≥ 0.45.2, @apollo/server). Agreed to go in Phase 5.
  - **Frontend:**
    - Sentry: `sentry.config.js` imports `@sentry/node`, but no package depends on Sentry and nothing imports the file, so Sentry is effectively off. Decide whether to wire it or delete it.
    - `no-console` rule.
    - env validation (H8).
  - **Repo hygiene:**
    - Move root-level report `.md`s into `docs/archive/`. **Ask before deleting.**
- [ ] **Delete stale remote branches** (Mike's call): `agent/vtl-45-p2-backend-tests`, `vtl-alert-dismiss-optimization`, and any older `vtl-*` branches on origin whose PRs have merged.

## Environment (remote agent server)

Agents run on the `agents` NixOS box through agent-bridge, one worktree per
issue (ADR 0003). As of 2026-10-28:

- **Node 22 / npm:** available (`~/.nix-profile`). `npm ci` and `npm run check` work in both packages.
- **E2E:** Playwright's own browser downloads don't run on NixOS (missing `libglib` etc.). nixpkgs' `playwright-driver.browsers` is the same version (1.64.1), so use that:
  ```bash
  export PLAYWRIGHT_BROWSERS_PATH=$(nix build --no-link --print-out-paths nixpkgs#playwright-driver.browsers)
  export PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=true
  npx playwright test --project=chromium --project=mobile
  ```
  - Chromium and mobile pass. WebKit crashes on launch here, so rely on CI for it.
  - Keep the nixpkgs version in step with `@playwright/test`, or the browser revisions won't match.
- **GitHub:** `gh` is authenticated via `GH_TOKEN`, so agents can push branches and open PRs. Agents can't merge (auto mode blocks it); Mike merges.
- **Linear:** use the `linear` CLI (`linear show`, `linear comment`, `linear state`). It can read any issue but only write the session's own.
- **Secrets:** there's no `.env` or `.env.local` (Fly/Linear/NOAA tokens) in the worktree. Deploys stay with CI and Mike. Unit and E2E tests don't need any keys.
- **MCP config:** `.claude-mcp.json` points its filesystem server at `/Users/mike/Projects/VT-LiveView`, on Mike's Mac. Harmless here, but that server won't work on the box.
