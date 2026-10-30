# Brief: checks after the Neon Grid bike redesign (prompt 04a, stage 1 revision)

**For:** qa-scout. **From:** the lead. **Read-only except for the report.**

## What changed

The lead rewrote the Neon Grid light-bike and touched three neighbours:

- `games/trailblaze/src/looks/neon/bike.ts` (rewritten)
- `games/trailblaze/src/looks/neon/walls.ts` (floor glow held back under the bike, `uncover`)
- `games/trailblaze/src/looks/neon/view.ts` (streaks from the tail, smaller crash pop, `walls.uncover`)
- `games/trailblaze/src/look/rider-halo.ts` (new optional `ring` flag)

## Run, from `E:\Projects\Atari-2600\32-in-one`

1. Typecheck the game: `pnpm --filter @woodgrain-88/trailblaze typecheck`.
2. Trailblaze unit tests only (vitest, config in `games/trailblaze/vitest.config.ts`).
   Find the right command in the root `package.json` / vitest workspace; do not run other games' tests.
3. ESLint on the four files above.
4. Prettier `--check` on the four files above.

## Fence

- Do not edit, format or fix any file. Do not run e2e, Playwright, screenshot jobs or repo-wide commands
  other than those listed. Do not touch git beyond reading. Do not stop processes you did not start
  (a Vite dev server on port 4522 is running for the lead).

## Report

For each step: the exact command, pass/fail, and for failures the full error lines (file:line and message).
Keep it factual; no fixes, no suggestions beyond naming the failing rule.
