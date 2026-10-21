# 0001: Lint, typecheck and CI tooling

- **Date:** 2026-10-15
- **Issue:** VTL-45 (Phase 1)

## Decision
- **ESLint:** one flat config per package (`eslint.config.js`, `backend/eslint.config.js`).
  - Both use type-aware `typescript-eslint` (`recommendedTypeChecked`, `projectService`).
  - The frontend adds `react-hooks`, `react-refresh` and `jsx-a11y`.
  - `npm run lint` runs with `--max-warnings 0`.
- **Pre-existing violations that need a behaviour change** are not fixed in the tooling PR. Each one gets a one-line `eslint-disable-next-line` with a `TODO(VTL-45 <id>)` that points at `docs/review/FINDINGS.md`. The rules themselves stay at full strength.
- **Scripts:** each package has `lint`, `typecheck`, `test`, `test:coverage` and `check` (`lint && typecheck && test`).
- **CI** (`.github/workflows/ci.yml`) is a matrix over frontend and backend: lint, typecheck, test with v8 coverage, build, and upload coverage as an artifact.
- **Node version:** pinned in `.nvmrc` to **20**, matching `backend/Dockerfile` (`node:20-alpine`).
- **Prettier, lint-staged and husky** are not added yet. They wait for the owner's go-ahead.

## Why
- **ESLint scope:** the old config only matched `**/*.{js,jsx}`, so none of the TypeScript was linted.
- **Separate backend config:** the backend can be installed and linted independently, which the CI matrix needs.
- **Inline disables:** they keep the tooling PR reviewable and behaviour-neutral without weakening a rule. `grep -rn "TODO(VTL-45"` finds every one of them.
- **React Compiler gotcha:** the compiler-based hook rules (`react-hooks/refs`, `set-state-in-effect`) skip a whole component once it contains any react-hooks suppression. Removing an `exhaustive-deps` disable can therefore surface new errors in that component.

## Rejected alternatives
- **A single root config that also lints `backend/`:** the backend CI job would need the root `node_modules`.
- **Downgrading the offending rules to `warn`:** this weakens them for new code.
- **Vitest "rollup native module missing" crash:** the cause was not found. It does not reproduce after a clean `npm ci` on Linux / Node 22, and the lockfile has every `@rollup/rollup-*` platform entry. The most likely cause is npm's optional-dependency bug (npm/cli#4828) in a stale local `node_modules`. The fix is `rm -rf node_modules && npm ci`.
