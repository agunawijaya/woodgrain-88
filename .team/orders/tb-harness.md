---
id: tb-harness
kind: tests
model: gemini-3.8-flash-high
fence:
  - games/trailblaze/game.html
  - games/trailblaze/src/dev/game.ts
  - games/trailblaze/src/dev/fake-chrome.ts
  - games/trailblaze/src/dev/fake-context.ts
  - games/trailblaze/src/dev/fonts.d.ts
  - games/trailblaze/playwright.config.ts
  - games/trailblaze/e2e/**
  - games/trailblaze/package.json
acceptance:
  - pnpm exec eslint games/trailblaze/src/dev games/trailblaze/e2e games/trailblaze/playwright.config.ts
  - pnpm exec prettier --check games/trailblaze/src/dev games/trailblaze/e2e games/trailblaze/playwright.config.ts games/trailblaze/game.html
  - pnpm exec tsc -p games/trailblaze/tsconfig.json
reads:
  - games/hot-and-cold/game.html
  - games/hot-and-cold/src/dev/game.ts
  - games/hot-and-cold/src/dev/fake-chrome.ts
  - games/hot-and-cold/src/dev/fake-context.ts
  - games/hot-and-cold/src/dev/fonts.d.ts
  - games/tank-duel/playwright.config.ts
  - games/tank-duel/e2e
  - games/tank-duel/package.json
  - games/trailblaze/package.json
  - games/trailblaze/vite.config.ts
  - games/trailblaze/src/module.ts
  - games/trailblaze/src/app/controller.ts
  - games/trailblaze/src/manifest.ts
  - games/trailblaze/src/channels.ts
---

## Goal

Trailblaze's game harness and end-to-end tests:

- **The harness**: `game.html` with `src/dev/game.ts`, which mounts the real module with faithful
  fakes of the Hall's context and chrome. Port Hot & Cold's four dev files and change only the
  game's names, ids and imports.
- **Playwright**: a config with `flows` and `shots` projects, port **5522** (the dev server
  `pnpm exec vite --port 5522 --strictPort`, `url: http://localhost:5522/game.html`). Port Tank
  Duel's config, `e2e/harness.ts` helpers and package scripts (`e2e`, `shots`).

The harness must accept the same URL options Hot & Cold's does (appearance, run kind, channel,
seed, seats), plus `look=` to set the look setting before mount.

## Flows (`e2e/flows.spec.ts`, 1280×720)

This order sets up the harness and the config, and proves them with two flows; the rest of the
flows and the screenshots come in the next order. Keep `e2e/harness.ts` helpers general (open the
game with options, press keys, wait for a screen by its `aria-label`, read the live match through a
dev-only hook) so the next order can build on them.

1. The game menu shows over the arena with "← Back to the Hall"; the channel dial and the
   Polaroids are present.
2. VS a Kid (Rosa) on channel 1: Enter on the menu, Enter on the pre-match cards, the 3-2-1, then
   the match ticks (the dev-only hook reports `match.tick` rising).

Add a dev-only hook in `src/dev/game.ts` (not in the game's source): the harness may expose the
mounted game's live match if the controller offers one; if it does not, read the HUD's DOM instead
and say so in the report.

## Out of scope

The game's own source outside `src/dev/`, the Hall, and anything outside the fence. If the
controller lacks a hook the tests need, say so in the report.
