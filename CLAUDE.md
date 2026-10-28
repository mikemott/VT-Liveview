# VT-Liveview Development Guide for Claude

**VT-Liveview** is a hyper-local, real-time map of Vermont. It pulls free public
data into one MapLibre web app: NOAA weather and alerts, radar, VT 511
traffic, cameras and road weather, USGS river gauges, air quality, ski,
beaches, camping, creemee stands and stargazing.

- **GitHub:** https://github.com/mikemott/VT-Liveview
- **Linear:** team VTL, project "VT LiveView"
- **Read next:** `PROJECT.md` (status + roadmap), `docs/architecture.md` (how it fits together), `docs/decisions/` (ADRs), `docs/review/FINDINGS.md` (open review findings)

Everything is **TypeScript** (`.ts`/`.tsx`). Trust the code over any older doc,
including the root-level `*_REPORT.md`/`*_SUMMARY.md` files, which are historical.

---

## Tech stack

| | |
|---|---|
| Frontend | React 19, Vite 7, MapLibre GL 5, TanStack Query 5, graphql-request, Protomaps basemap, Lucide icons, zod |
| Backend | Fastify 4, Apollo Server 4, node-cron collectors, Drizzle ORM + postgres-js (optional DB), cheerio scraper, zod env |
| Tests | Vitest 4 + MSW (frontend: happy-dom + Testing Library; backend: node + `fastify.inject`), Playwright + axe for E2E |
| Tooling | ESLint (type-aware typescript-eslint, react-hooks, jsx-a11y), Prettier, husky + lint-staged |
| Hosting | Frontend → Cloudflare Pages (+ `functions/` Pages Function) · Backend → Fly.io `vt-liveview-api` (region `bos`, `node:22-alpine`) |

Node **22** (`.nvmrc`).

---

## Commands

The same scripts exist in the repo root (frontend) and in `backend/`:

```bash
npm ci
npm run check          # lint + typecheck + format:check + test (run this before handing off)
npm run lint           # eslint, --max-warnings 0
npm run typecheck      # tsc --noEmit
npm test               # vitest run
npm run test:coverage  # with enforced thresholds (CI runs this)
npm run format         # prettier --write (explicit paths; markdown is excluded)
npm run build
```

Frontend only:
```bash
npm run dev            # http://localhost:5173
npm run test:e2e       # Playwright; starts the mocked backend (:4100) and vite preview (:4173)
npm run test:e2e:update
```

Backend only:
```bash
npm run dev            # tsx watch, reads backend/.env, http://localhost:4000
npm run e2e:server     # real app with MSW upstreams (what E2E uses)
npm run db:generate | db:migrate | db:studio   # Drizzle, needs DATABASE_URL
```

E2E needs browsers. On a normal machine, run `npx playwright install chromium webkit`.
On the NixOS agent box, see `PROJECT.md` → Environment. Visual baselines
are Linux-only and come from CI (ADR 0002), so never commit locally generated PNGs.

---

## Development workflow

**Never commit directly to `main`.** Work goes Branch → PR → CodeRabbit review → merge.

- **Branches:** human branches are `vtl-XXX-short-description`. Agent branches are `agent/vtl-XXX`, which agent-bridge creates in `.worktrees/VTL-XXX`.
- **PR body:** include `Closes VTL-XXX`. The template at `.github/pull_request_template.md` pre-fills it.
- **Rebasing:** rebase on `origin/main` before opening a PR (`git fetch origin main && git rebase origin/main`). Branches more than 5 commits behind must be rebased. Branches older than 7 days should be recreated.
- **CodeRabbit:** after opening a PR, wait for its review (`gh pr view <n> --comments`).
  - Always fix security issues, bugs and compatibility breaks.
  - Fix quick, high-impact wins.
  - Open a Linear issue for big refactors.
  - Skip style nits.
  - It skips PRs over 100 files, so keep PRs small.
- **Merging:** don't merge without Mike's approval. Mike merges (`gh pr merge <n> --squash --delete-branch`). If a PR's commits are listed in `.git-blame-ignore-revs`, use a merge commit instead so those SHAs stay valid.
- **Pre-commit hook:** husky runs lint-staged on commit. Fix what it reports; don't bypass it with `--no-verify`.

### Remote agent sessions (agent-bridge)
- **Linear:** follow the `linear-workflow` skill: `linear show` → post a plan → `linear state "Needs input"` if blocked → handoff comment → `linear state "In Review"`.
- **Worktree:** work only in your own worktree. Never use bare `git stash`: the stash is shared across worktrees.
- **Decisions:** record lasting decisions as `docs/decisions/NNNN-title.md` (copy `0000-template.md`).
- **CLAUDE.md:** don't edit it directly. Propose changes in a separate commit or in the handoff.
- **Tools on the box:** Node 22, `gh` (via `GH_TOKEN`) and `linear` are available. There's no `.env.local`, so agents don't deploy.

### Automation
| Workflow | Trigger | Does |
|---|---|---|
| `ci.yml` | push/PR to main | Frontend + backend matrix: lint, typecheck, format:check, test:coverage, build. An `e2e` matrix runs chromium, webkit and mobile. |
| `deploy-backend.yml` | push to main touching `backend/**` | `flyctl deploy --remote-only` |
| `ski-conditions-cron.yml` | 11:00 & 19:00 UTC | `POST /api/ski-conditions/refresh` |
| `linear-sync.yml` | PR opened | Moves the Linear issue to In Review |
| Cloudflare Pages | push to main | Builds and deploys the frontend (configured in Cloudflare, not in a workflow file) |

---

## Project layout

```
src/
  main.tsx, App.tsx            entry, QueryClient, ErrorBoundary
  WeatherMap.tsx               map shell: init, theme swap, alerts, chips, DetailPanel, "What's here?"
  config/layers.ts             layer registry: label, icon, colour (shared by chips, markers, search)
  config/seasonalLayers.ts     month-based layer visibility
  components/                  *Layer.tsx per layer, DetailPanel + detail-views/, RadarOverlay,
                               CurrentWeather, SearchBox, ShareMenu, MapUnavailable, ...
  hooks/                       useMapMarkers (shared marker lifecycle), useLayerData, useRadarAnimation, ...
  services/                    graphqlClient + *Api.ts per data source (vt511Api parses XML)
  utils/                       sanitize, mapStyles, mapMarker, urlState, sharePreview, colour/icon maps
  data/                        static datasets (seasonal roads, dark-sky sites, VT outline/towns)
  styles/design-system.css     vintage design tokens (see VINTAGE-STYLE-GUIDE.md)
  test/                        vitest setup, MSW server, maplibre mock
  __fixtures__/                synthetic upstream fixtures
functions/index.ts             Cloudflare Pages Function: link-preview <meta> for shared views
e2e/                           Playwright specs + fixtures.ts (blocks all third-party traffic)
backend/src/
  app.ts                       buildServer(): Fastify + Apollo, CORS, rate limit, REST routes
  server.ts                    listen, scheduler, graceful shutdown
  schema.graphql, resolvers/   GraphQL API
  services/                    one module per upstream, each with its own cache
  collectors/, scheduler/      node-cron jobs that write to Postgres
  db/                          Drizzle schema, migrations, client
  types/env.ts                 zod env schema (source of truth for backend env vars)
  test/                        MSW setup, upstream handlers, e2e-server.ts
docs/                          architecture.md, decisions/, review/, plans/, design-system.md
```

---

## Environment variables

**Frontend `.env`** (see `.env.example`; validated in `src/types/env.ts`):
- `VITE_PROTOMAPS_API_KEY` (required)
- `VITE_TOMTOM_API_KEY` (traffic flow)
- `VITE_BACKEND_URL`
- `VITE_GRAPHQL_ENDPOINT`

**Backend `backend/.env`** (validated in `backend/src/types/env.ts`):
- `PORT`, `HOST`, `NODE_ENV`
- `ALLOWED_ORIGINS`: production CORS
- `CONTACT_EMAIL`: NOAA User-Agent, required by NOAA's terms of service
- `ADMIN_TOKEN`: `/admin/clear-cache` in production
- `NOAA_CDO_TOKEN`, `AIRNOW_API_KEY`
- `DATABASE_URL`, `DATABASE_MODE` (`postgres`|`timescale`), `ENABLE_COLLECTOR`
- `SENTRY_*`

**`.env.local`** (gitignored, local machines only): `FLY_API_TOKEN`, `LINEAR_API_KEY`, `NOAA_CDO_TOKEN`. It isn't on the agent server.

When you add an env var, add it to `.env.example` and to the matching `env.ts`, and update this section.

---

## Code patterns

1. **Console logging:** gate it on dev.
   - Frontend: `if (import.meta.env.DEV)`.
   - Backend: `isDev()` from `types/env.ts`.
   - `console.error` for real failures is fine.
2. **Untrusted strings:** anything from an upstream that ends up in HTML must go through `src/utils/sanitize.ts`. Prefer JSX in the DetailPanel views over building HTML strings.
3. **MapLibre:**
   - Check `getSource`/`getLayer` before you add or remove.
   - Use `hooks/useMapMarkers.ts` for point markers, so they're cleaned up on hide, on data change and on unmount.
   - Re-add sources and layers after a style swap.
4. **Layer colours:** take them from `config/layers.ts`. Don't hard-code them. `layerPalette.test.ts` enforces distinctness and contrast.
5. **React Query keys:** use descriptive hierarchical arrays, e.g. `['weather', 'alerts', coords]`. Defaults are in `App.tsx`.
6. **Backend caches:** bound them (LRU / max entries) and give them a TTL. Never let a Map grow without a limit. Keep stale-on-error fallbacks working.
7. **Upstream fetches:** check `response.ok` and throw meaningful errors. Send the NOAA User-Agent with `CONTACT_EMAIL`. Every new upstream needs MSW handlers and fixtures: unit tests in `test/`, E2E in `backend/src/test/upstreamHandlers.ts` and `e2e/fixtures.ts`.
8. **Styling:** use per-component `.css` files, with dark mode via a `.dark` parent class. New styles should use `styles/design-system.css` tokens, not raw hex (`App.css` tokens are legacy, FINDINGS H14).
9. **New GraphQL field:** add it to `schema.graphql`, add a resolver in `resolvers/`, then call it from `src/services/*Api.ts` via `graphqlClient`. Add an `inject` test.
10. **New seasonal layer:** add it to `config/seasonalLayers.ts` and `config/layers.ts`, and follow the `SkiLayer.tsx` pattern.

### Pitfalls
- **Frameworks:** it's Fastify + Apollo, not Express. It's TanStack Query, not Redux. It's MapLibre, not Mapbox.
- **Dependencies:** don't add one without asking Mike.
- **Lint and tests:** never weaken a lint rule or a test to get green. Raise the disagreement instead.
- **Database:** it's optional. Code must work with no `DATABASE_URL` (history features turn off).
- **Prettier:** a bare `prettier .` touches dotfiles. Use `npm run format`.
- **Sentry:** `sentry.config.js` is dead code (no Sentry dependency). See PROJECT.md, Phase 5.

---

**Maintainer:** Mike Mott (mike@mottvt.com) · **License:** MIT
