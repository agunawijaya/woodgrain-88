# Brief: Trailblaze e2e and the screenshot set (prompt 04a, stage 3)

**For:** qa-scout. **From:** the lead.

## Context

Prompt 04a stage 2 is implemented in `games/trailblaze/` (riders up close on the pre-match cards and
in a "Riders" card on the game menu, a new glide that keeps the picture within one cell of the
rules, per-rider facts on the results screen, Neon start marks only for ridden seats). The lead now
needs the end-to-end flows and the full screenshot set.

## Run, from `E:\Projects\Atari-2600\32-in-one`

1. Trailblaze e2e flows: `pnpm --filter @woodgrain-88/trailblaze e2e`.
2. The screenshot set (writes into `games/trailblaze/docs/media/screens/`, replacing what is there):
   `pnpm --filter @woodgrain-88/trailblaze shots`. Expect 96 PNGs: 4 looks × 2 appearances ×
   2 sizes × 6 screens.
3. Count the PNGs in `games/trailblaze/docs/media/screens/` and list any expected name that is
   missing (names are `<look>-<screen>-<width>-<appearance>.png`, see `games/trailblaze/e2e/shots.spec.ts`).

If a step fails, run it once more to rule out a flaky start; report both runs.

## Fence

- Do not edit any source, test, config or doc file. The only files you may write are the PNGs the
  shots job writes.
- Playwright uses its own server on port 5522. A Vite server on port 4522 belongs to the lead: do
  not stop it or any other process you did not start.
- No git beyond reading. No other games' tests.

## Report

For each step: the exact command, pass/fail with counts, and for each failure the test name, the
error message and the first lines of its stack, plus the path of any trace or screenshot Playwright
saved. Then the PNG count and any missing names. Facts only; no fixes.
