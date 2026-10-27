---
id: hc-engine-tests
kind: tests
model: gemini-3.8-flash-high
fence:
  - games/hot-and-cold/tests/grid.test.ts
  - games/hot-and-cold/tests/board.test.ts
  - games/hot-and-cold/tests/flag.test.ts
  - games/hot-and-cold/tests/match.test.ts
  - games/hot-and-cold/tests/solver.test.ts
  - games/hot-and-cold/tests/helpers/drive.ts
acceptance:
  - pnpm exec vitest run --project hot-and-cold games/hot-and-cold/tests
  - pnpm exec eslint games/hot-and-cold/tests
  - pnpm exec prettier --check games/hot-and-cold/tests
  - pnpm exec tsc -p games/hot-and-cold/tsconfig.json
reads:
  - games/hot-and-cold/src/engine/grid.ts
  - games/hot-and-cold/src/engine/board.ts
  - games/hot-and-cold/src/engine/flag.ts
  - games/hot-and-cold/src/engine/rules.ts
  - games/hot-and-cold/src/engine/match.ts
  - games/hot-and-cold/src/engine/solver.ts
  - packages/kit/src/rng.ts
  - games/tank-duel/tests/match.test.ts
---

## Goal

Write the unit tests for the Hot & Cold engine (grid, board, flag, match, solver), so every rule
below is proven. The engine code already exists. The tests are its specification and its guard
against regressions.

## Context

Hot & Cold is a hidden-flag hunt on a 9 × 7 field. The lead wrote the engine in
`games/hot-and-cold/src/engine/`. Read every file there first; the module comments explain the
rules. A match advances one tick at a time (`stepMatch`) from what each seat is holding
(`SeatInput`) and returns events. `startMatch` lays out the first field.

Tests may be white-box where that is the only way to set up a situation:

- read `match.flags`, `match.board` and `match.seats`;
- after `startMatch`, overwrite `match.flags`, `match.headings` and `match.board` (it is a plain
  object: `{ kinds, flags }`) to place the flag, a bomb or a heading exactly.

Do not change any file in `src/`. **If a behaviour below fails against the code, do not weaken the
test:** keep it failing, and list it in your report with the line it fails on. The lead fixes the
engine.

Put shared driving helpers in `tests/helpers/drive.ts`, for example
`drive(match, inputs, ticks): MatchEvent[]` and an input that walks a seat towards a square. Look at
`games/tank-duel/tests/match.test.ts` for the style used in this repo.

## Behaviour and edge cases

### Grid (`grid.test.ts`)

1. `squareAt` and `spotOf` round-trip for all 63 squares; square 0 is top left, 62 bottom right.
2. `kingDistance` is the larger of the column and row differences, and never wraps: squares 0 and 8
   (the same row) are 8 apart.
3. `bearingTowards` gives `e` or `w` in the same row, `n` or `s` in the same column, and a diagonal
   by the signs otherwise, however steep: from (column 0, row 3) to (8, 2) is `ne`.
4. `stepFrom` wraps on every edge, corners included. `stepBetween` returns the wrapped step between
   neighbours (from 0 to 8 is `{ east: -1, south: 0 }`) and `null` for squares that are not
   neighbours.

### Board (`board.test.ts`)

5. `generateBoard` with the cartridge composition gives 1 flag, 8 bombs, 27 distances and 27
   arrows, plus the flag's own square, which is an arrow. The same seed gives the same board, and
   two different seeds give different boards.
6. A custom composition is respected (16 bombs, 20 distances).
7. With `flagCount` 2 the two flags are different squares, and neither holds a bomb or a distance.
8. `clueAt` checks the flag first: a flag standing on a bomb square reads `flag`. Then:
   - a bomb square reads `bomb`;
   - a distance square reads the king distance to the flag;
   - an arrow square reads the bearing to the flag;
   - with two flags, distances and arrows refer to the nearer flag.

### Flag (`flag.test.ts`)

9. A still flag never moves.
10. Wrapping:
    - from the last column heading east, the flag comes back in at column 0, with the heading
      unchanged;
    - a corner wraps both ways.
11. Bouncing:
    - from column 8 heading east, the flag lands on column 7, now heading west;
    - from row 0 heading north, it lands on row 1, heading south;
    - a diagonal into a corner reflects on both axes;
    - an interior flag simply moves one step;
    - over 500 steps from every square and heading, the flag never leaves the field.
12. `HEADINGS` holds the eight distinct compass headings, none of them `{0, 0}`.

### Match (`match.test.ts`)

Use `cartridgeRules(n)` for the rules, unless the test needs custom ones.

13. Start:
    - in variation 1, `startMatch` emits a `round` with `playing: [0, 1]`, and the explorers stand
      on squares 0 and 62;
    - a clock game (variation 8) plays seat 0 only, even when set up for two seats;
    - hunt for hunt (variation 5) plays only seat 0 on the first field.
14. Stepping:
    - holding a direction from the first tick, the first `step` comes on tick 16, then one every
      16 ticks while it is held;
    - switch A in variation 1 makes it every 20 ticks;
    - switch A in variation 2 changes nothing (still 16).
15. A step onto the other explorer's square emits `blocked` and does not move, and the next step
    still waits 16 ticks.
16. Seat 0 at home (square 0) holding west steps to square 8, because the field wraps.
17. Checking:
    - reveal pressed within 7 ticks after a step does not check at once; if it is still held when
      those ticks end, the check happens then;
    - a press let go before then is dropped;
    - holding reveal checks only once; letting go and pressing again checks again.
18. While a check is held the explorer cannot step. Letting go emits `release`, and the next step
    waits a full 16 ticks.
19. Checking the flag's square:
    - emits `check` with a `flag` clue, then `capture`;
    - for the 32 ticks of celebration neither seat can move or check;
    - then comes `score`, and a new `round` with both explorers home.
20. The race (variation 1) ends at the 15th capture with
    `over { kind: 'first-to', winner, captures }`. `shortened` rules end it at 5.
21. A bomb:
    - checking a bomb square emits `check` with a `bomb` clue;
    - 8 ticks later `home` is emitted and the explorer is on its home square;
    - if the other explorer stands on that home square, `home` has `to: null` and the explorer
      stays where it was.
22. A moving flag (variation 3 or 4):
    - moves one step after every miss, bombs included, and not after a capture;
    - `check.flagMoves` counts the moves made before that check;
    - a still flag never moves.
23. Turns (variation 2):
    - only the seat whose turn it is can step or check;
    - letting go of its check emits `turn` for the other seat, which can then check only after
      15 ticks and step only after 16;
    - after a capture, the capturing seat sits out the start of the next field.
24. Variation 4 plays to 75 captures, variations 2 and 3 to 15 (read from the rules, and also
    proved by a capture count where cheap).
25. Hunt for hunt, two seats (variation 5):
    - seat 0 hunts the first field alone;
    - each released check adds 1 to its score (2 with switch A), and the capture adds 1 too;
    - after a capture, seat 1 hunts the next field alone, and so on in turn.
26. Hunt for hunt, the end:
    - when seat 0's total reaches 75 (on a capture or not), `final-turn` names seat 1, who hunts
      one last field;
    - the match ends when seat 1 captures or reaches 75;
    - the result has `kind: 'hunts'`, and fewest checks wins; equal totals give `winner: null`.
27. Hunt for hunt: when seat 1's total reaches 75 the match ends at once, and an `over` that comes
    without a capture lists the flags.
28. Hunt for hunt alone (one seat):
    - the same seat hunts field after field;
    - the match ends when its total reaches 75;
    - a capture that brings the total to exactly 75 has `onLastCheck: true`.
29. The clock (variation 8):
    - a `clock` event every 31 ticks counts down from 75;
    - a capture scores 1 and lays a new field;
    - at 0 the explorer can neither step nor check;
    - one clock tick later comes `over { kind: 'clock', captures }`, listing the flags.
30. Rules with `singleHunt: true` end at the first capture with `over { kind: 'single', checks }`,
    where `checks` counts every check, the capture included.
31. Determinism: the same setup and the same inputs give exactly the same events.
32. Hidden information: in a long seeded race driven by simple wandering inputs, no event except
    `over` carries a flag's square unless that square was the one checked.

### Solver (`solver.test.ts`)

33. With no facts, every square's chance is 1/63, for a still flag and for a moving one.
34. Facts narrow the candidates:
    - a distance fact leaves only squares at that king distance from the checked square;
    - an arrow fact leaves only squares whose bearing from it matches;
    - any miss (a bomb too) excludes the checked square;
    - the chances add up to 1.
35. For a moving flag, facts apply at their own `flagMoves`, and the candidates are where the
    stories put the flag `now`. Property test: drive seeded matches of variations 3 and 4. After
    every check, `believe(motion, all checks so far, match.flagMoves)` keeps `consistent: true`,
    and the true flag square is among the candidates.
36. Two facts that cannot both be true give `consistent: false`, and keep the stories that break
    the fewest facts.
37. `expectedInformation`:
    - it is 0 when one story remains;
    - with candidates spread across the field, a square in the middle tells more than a corner
      whose readings would mostly agree.

## Tests required

The five test files above and the helper, written first, each test named by the behaviour it
proves. Keep runtime under 20 seconds for the whole folder: the property tests can use 50 seeds.

## Out of scope

- Any change to `games/hot-and-cold/src/`.
- Rendering, looks, AI and simulations.
