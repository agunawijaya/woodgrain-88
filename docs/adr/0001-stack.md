# ADR-0001 — Stack and layout

- Status: accepted
- Date: 2026-10-25

## Context

Woodgrain '88 is thirty small games and one illustrated hub, built by several Claude Code sessions
working in parallel, each leading a crew of Gemini models. It must run offline from any static host
(GitHub Pages), draw everything in code, and stay easy for many hands to change without stepping on
each other.

## Decision

- **pnpm workspaces** with three kinds of package: `packages/kit` (the shared runtime), `hall/`
  (The Den, the website itself) and `games/<id>/` (one per game, added by later prompts).
- **TypeScript strict** everywhere (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`),
  ESLint with the strict type-checked presets, Prettier for layout.
- **Vite** builds the Hall; every game is a lazily imported chunk. `BASE_PATH` sets the base for a
  GitHub Pages project path (`/woodgrain-88/`).
- **Vitest** for unit tests (happy-dom where DOM is needed), **Playwright** for end-to-end tests
  and screenshots, `@axe-core/playwright` for accessibility, `node:test` for the dependency-free
  crew bridge.
- **No UI framework.** The Hall and the kit are plain TypeScript, DOM, SVG, Canvas and CSS. The Den
  is one SVG scene plus a few HTML overlays; dialogs are a hundred lines of our own; a framework
  would cost more in bundle and indirection than it would save. Games choose their own rendering
  (Canvas 2D, WebGL, three.js lazy-loaded) in their own ADRs.
- **Hash routing**: `#/`, `#/list`, `#/game/<id>`, `#/play/<id>?…`, `#/records`, `#/about`.
- **Ports**: Hall dev 4488, Playwright preview 5488; game sessions 4500–4599. The sibling
  collections' ports (4183/5183, 4283/5283, 4383/5383) are never used.
- **Folders**: tracked app code never lives in `src/` at the repo root; that name belongs to the
  owner's disassembly, which stays git-ignored next to `original/` and `research/`.
- **Fonts**: Fraunces (display), Atkinson Hyperlegible Next (UI), Big Shoulders Display (labels and
  the Counter), Patrick Hand (handwriting), all OFL, self-hosted through fontsource.

## What we reused from the sibling collections

From Pinwheel Park and the two '83 collections (read, not imported): the workspace and tooling
shape, the idea of a `pnpm check` with guardrail modules, the before-paint appearance script, the
hashed-file service worker, and the test-only fake game run through a dev-only harness page. All of
it is rewritten here in our own code; none of their look carries over. Woodgrain '88 looks like a
1988 rec room, not a park or an office.

## Consequences

- Any session can run the Hall alone on its own port and test its game in isolation.
- Nothing a player downloads talks to a network; offline play is a precache, not a feature flag.
- The Den costs one SVG and two canvases; the first load is about 61 KB of gzipped JavaScript plus
  fonts.
