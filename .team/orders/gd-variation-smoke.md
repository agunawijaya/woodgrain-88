---
id: gd-variation-smoke
kind: tests
member: deepseek-flash
fence:
  - games/gravity-duel/tests/variation-smoke.test.ts
acceptance:
  - pnpm exec vitest run --root games/gravity-duel tests/variation-smoke.test.ts
  - pnpm exec eslint games/gravity-duel/tests/variation-smoke.test.ts
  - pnpm exec prettier --check games/gravity-duel/tests/variation-smoke.test.ts
reads:
  - games/gravity-duel/src/engine/types.ts
  - games/gravity-duel/src/engine/match.ts
  - games/gravity-duel/src/engine/variations.ts
  - games/gravity-duel/src/ai/pilot.ts
  - games/gravity-duel/tests/ai/pilot.test.ts
---

## Goal

A smoke test that plays every one of Gravity Duel's 17 variations with two Neighbourhood Kid
pilots (one in solo variations) and checks that nothing impossible happens. Write it in
`games/gravity-duel/tests/variation-smoke.test.ts`. Do not change any other file.

## How to drive a match

Follow `tests/ai/pilot.test.ts`:

- `createMatch(setup)` with `rules: variation(n)`, switches `['B', 'B']`, `target: 10`,
  `clockTicks: CARTRIDGE_MATCH_TICKS`, `seed: n`;
- two `createKidPilot({ kid, seat, mode: 'human', seed: 'smoke-' + n + '-' + seat })` pilots, Rosa
  in seat 0 and Moss in seat 1. In variations whose `mode` is `'solo'`, seat 1 has no pilot and
  gets `IDLE`.
- Each tick:
  1. each pilot `hear(match.events, match)`;
  2. `stepMatch(match, [controls0, controls1])`;
  3. check the invariants below.

  Stop after 3,000 ticks or when `match.phase` is `'over'`.

## Invariants to check after every tick

1. Every ship's and shot's `x`, `y`, `vx`, `vy` is a finite integer.
2. Every present ship's position is inside the field: `0 ≤ x < FIELD_WIDTH × SUBPIXELS` and
   `0 ≤ y < FIELD_HEIGHT × SUBPIXELS`. The same holds for every live shot.
3. Every velocity's whole units (`Math.floor(v / 256)`) stay between −64 and 63 after the tick.
4. `fuel` and `ammo` stay between 0 and 8; `score` between 0 and 10; `heading` between 0 and 15.
5. In duel variations (`mode === 'duel'`) no `docked` event ever appears; in the others no
   `fired`, `hit` or `cloak` event appears.
6. In solo variations, seat 1 never scores and never moves (its `x` and `y` never change).
7. `match.tick` goes up by exactly one per tick while the phase is `'playing'`.

## Tests required

- One `it` per variation, generated with `it.each` over 1–17, named like "variation 4 plays 3,000
  ticks without breaking an invariant".
- One more `it` checking that, across all duel variations together, at least one `hit` happened,
  and across all docking variations together, at least one `docked` happened. This proves the
  Kids actually play.

Keep the whole file under about 20 seconds; 3,000 ticks per variation is the budget. Put the
invariant checks in small named helper functions inside the test file.

## Out of scope

Everything else. Do not change the engine, the AI or other tests.
