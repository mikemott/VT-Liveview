# 0003: Remote agent dev environment

- **Date:** 2026-10-28
- **Issue:** VTL-46

## Decision
- **Where agents run:** remote Claude Code sessions run on the `agents` NixOS box via agent-bridge. Each Linear issue gets one git worktree (`.worktrees/VTL-XX`, branch `agent/vtl-XX`).
- **Where agents get context:** four files, each with one job:
  - `CLAUDE.md`: how to work in the repo (commands, conventions, workflow).
  - `PROJECT.md`: current status and the roadmap (what's left from VTL-45).
  - `docs/architecture.md`: how the system actually fits together, taken from the code.
  - `docs/decisions/`: one short ADR per lasting decision.
- **Linear is the permanent record.** Agents post plans, questions and handoffs with the `linear` CLI.
- **E2E on NixOS:** use nixpkgs' `playwright-driver.browsers` (via `PLAYWRIGHT_BROWSERS_PATH`) instead of `npx playwright install`.

## Why
- **Self-contained context:** Mike works from his phone, so sessions run unattended and need accurate context of their own.
- **Splitting the docs:** the old CLAUDE.md described a pre-TypeScript codebase and went stale because it mixed the roadmap, audit status and architecture in with the instructions. With "how to work", "what we're doing" and "how it works" split apart, each file stays short enough to keep accurate.
- **Playwright on NixOS:** its downloaded browsers are dynamically linked against FHS libraries, so they fail there (`libglib-2.0.so.0` not found).

## Rejected alternatives
- **One big CLAUDE.md:** this is the layout that went stale.
- **`vtl-XX-description` branch names for agents:** agent-bridge creates `agent/vtl-XX`. Linear still links the PR through `Closes VTL-XX` in the PR body.
- **nix-ld / steam-run for the Playwright browsers:** it needs a system change to the flake. nixpkgs already ships the matching browser build.
