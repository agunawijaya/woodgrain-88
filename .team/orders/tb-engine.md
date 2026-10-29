---
id: tb-engine
kind: engine
fence:
  - games/trailblaze/src/engine/types.ts
  - games/trailblaze/src/engine/grid.ts
  - games/trailblaze/src/engine/headings.ts
  - games/trailblaze/src/engine/variations.ts
  - games/trailblaze/src/engine/match.ts
  - games/trailblaze/src/engine/space.ts
  - games/trailblaze/tests/engine/**
acceptance:
  - pnpm exec vitest run --project trailblaze games/trailblaze/tests/engine
  - pnpm exec eslint games/trailblaze/src/engine games/trailblaze/tests/engine
  - pnpm exec prettier --check games/trailblaze/src/engine games/trailblaze/tests/engine
  - pnpm exec tsc -p games/trailblaze/tsconfig.json
reads:
  - games/trailblaze/src/engine/types.ts
  - research/dossiers/08-trailblaze.md
  - src/08_Surround.asm
  - games/hot-and-cold/src/engine/match.ts
  - games/tank-duel/tests/match.test.ts
---

## Goal

Build Trailblaze's pure rules engine: a fixed-step simulation of the 1977 trail duel (slot 8 of
the cartridge), faithful to every rule and quirk below. Write the tests first. The renderers, the
bots and the cartridge's own computer opponent are later orders. They will all drive this engine
through the interface below.

## Context

- Trailblaze: two riders never stop, every cell they leave becomes a wall, and whoever crashes
  gives the rival a point. First to 10 wins. The arena is 40 × 20 cells.
- `research/dossiers/08-trailblaze.md` is the verified behaviour spec. Read it whole. Its line
  references point into `src/08_Surround.asm` (read-only, given by absolute path). Read the asm
  where this order asks you to verify something. Never copy its tables, labels or text into the
  repo. Describe what you found in your own words in the module comments and your report.
- `types.ts` is the lead's contract. Do not change or remove anything in it. If you truly need an
  extra field on `Match` or `Rider`, add it with a doc comment and list it in your report.
- Follow the style of `games/hot-and-cold/src/engine/match.ts`: a mutable `Match`, `createMatch`,
  `startMatch` and `stepMatch` returning events, and a module comment that tells the rules.
- No randomness and no wall clock anywhere. The engine is fully deterministic.
- The kit is `@woodgrain-88/kit`. Only its `SwitchPosition` type is used here.

## Interface to implement

```ts
// grid.ts
export function cellAt(column: number, row: number): Cell; // column and row already in range
export function columnOf(cell: Cell): number;
export function rowOf(cell: Cell): number;
/** The cell one step along `heading`, wrapping at every edge (the cartridge's arithmetic wraps
 * even in bordered arenas; the border cells are what stop a rider there). */
export function stepFrom(cell: Cell, heading: Heading): { cell: Cell; wrapped: boolean };
export function isBorderCell(cell: Cell): boolean; // row 0, row 19, column 0 or column 39
export const START: readonly [{ cell: Cell; heading: Heading }, { cell: Cell; heading: Heading }]; // seat 0: column 10, row 10, right; seat 1: column 30, row 10, left

// headings.ts
export const HEADINGS: readonly Heading[];
export function vectorOf(heading: Heading): { east: -1 | 0 | 1; south: -1 | 0 | 1 };
export function opposite(heading: Heading): Heading;
export function isDiagonal(heading: Heading): boolean;
/** The heading a stick asks for under 4- or 8-way steering, or null when centred. */
export function headingFromStick(stick: Stick, steering: 4 | 8): Heading | null;

// variations.ts
export const VARIATIONS: readonly VariationRules[]; // 14 entries, index 0 is variation 1
export function variationRules(number: number): VariationRules; // throws outside 1–14

// match.ts
export const CARTRIDGE_TARGET = 10;
export const FIRST_STEP_PERIOD = 15;
export const FASTEST_STEP_PERIOD = 3;
export const SPEED_UP_EVERY = 256; // ticks of a round
export const CRASH_PAUSE_TICKS = 240; // seat 0 crashed, or both
export const SHORT_CRASH_PAUSE_TICKS = 224; // seat 1 crashed alone
export function createMatch(setup: MatchSetup): Match;
/** Lays out round 1. Call once; its events start the match. */
export function startMatch(match: Match): MatchEvent[];
/** One 20 ms tick with what each seat holds (seat 1's stick is ignored when riding alone). */
export function stepMatch(match: Match, sticks: readonly [Stick, Stick]): MatchEvent[];

// space.ts
/**
 * How many empty cells a rider standing on `from` could reach, counting up to `limit` and
 * stopping there. Movement follows the rules: 8-connected under 8-way steering (a rider slips
 * between two trail cells that touch only at a corner), 4-connected otherwise, across edges only
 * in wraparound arenas. `from` itself is not counted.
 */
export function openSpace(match: Readonly<Match>, from: Cell, limit: number): number;
/** The empty cells reachable from `from`, as above, in breadth-first order, at most `limit`. */
export function pocketCells(match: Readonly<Match>, from: Cell, limit: number): Cell[];
```

## Behaviour and edge cases

### The board and a round

1. A round begins with an empty board. In bordered variations (1–7) every border cell holds
   `BORDER`, which leaves 38 × 18 = 684 open cells. Wraparound variations (8–14) have no border.
   Riders start on `START`, the step period is `FIRST_STEP_PERIOD`, `roundTick` and `steps` are
   0, and `laidAt` is -1 everywhere. A `round` event is emitted.
2. `untilStep` counts down by one each running tick. When it reaches 0 a step happens and it is
   reset to the current `stepPeriod`. The first step of a round comes `FIRST_STEP_PERIOD` ticks
   after the round starts.
3. A step, in this exact order (the cartridge's order, dossier §4):
   a. Every rider's current cell is written: its seat number, with `laidAt` set to the tick. The
   exception is a rider holding fire under `fire: 'gaps' | 'erase'`: its cell is cleared to
   `EMPTY` instead (reported in `erased` only if it held a trail). Seat 0 is written before
   seat 1, so if both stand on one cell and only seat 0 holds fire, seat 1's write wins.
   b. Pilots are asked for their heading (see 9), so they see the cells just written. Then
   latched turns are applied (see 5–7). A turn that changes the heading emits a `turn` event.
   c. Every rider moves one cell along its heading with `stepFrom`.
   d. Continuous motion only: a rider whose new cell is not `EMPTY` has crashed into it.
   The step emits one `step` event with all of `laid`, `erased` and `moves`. `entered` is the
   heading the rider had before the step's turn, and `left` the heading it leaves by. Crashes
   come after the step event in the same tick.
4. Riders never collide with each other. Only trail and border cells crash a rider. Two riders
   may stand on the same empty cell after a step with no crash. Consequences, each to be tested:
   - crossing paths (one moving right, one moving down, into the same cell on the same step):
     both ride on unharmed;
   - meeting head-on in one cell: on the next step each moves onto the cell the other just
     left, which is now a trail, so both crash and both score;
   - adjacent and head-on (they swap cells in one step): both crash and both score.

### Steering

5. Continuous motion: the stick is read every tick. A non-centred stick latches its heading
   (`headingFromStick` for the variation's steering). The latch survives until the next step,
   even if the stick is centred again before it, and the latest push before a step wins. At the
   step the latch is applied and cleared. A one-tick tap between two steps is never lost.
6. Reversal protection: on switch B, a latched heading exactly opposite the rider's current
   heading is ignored, but only while the current heading is one of the four cardinal ones. On
   switch A it goes through. The rider then moves straight onto the cell it just laid and
   crashes.
   **Verify in the asm** (dossier §3 and hook 2, around lines 384–429) whether "opposite" means
   only the exact opposite or any push with the opposite component, for instance up-left while
   riding right on 8-way steering. Implement what you find and say which it is in your report.
7. The diagonal hole (hook 2): while the current heading is diagonal, protection never applies,
   even on switch B. Riding down-right, a push to up-left goes through and crashes the rider.
8. `headingFromStick` under 4-way steering with both axes pushed: **verify in the asm** how the
   cartridge resolves a diagonal stick when only cardinal moves are allowed (input latch and
   steering, dossier §3). Implement the same rule and report it. Under 8-way steering, both axes
   give the diagonal.
9. Pilots: at the step (3b) a pilot's heading replaces that seat's latch. Then the same
   protection rule applies to it. **Verify in the asm** that the reversal filter also runs for the
   computer's choice in variations 2 and 4. Implement and report what you find. A seat with a
   pilot ignores its stick for steering, though fire is still read.

### Speed

10. Variations with `speedUp`: at `roundTick` 256, 512, 768 and 1024 the period becomes 12, 9, 6
    and 3, and then it stays at 3. Each change emits a `speed` event (stage 1–4, the new period).
    The new period takes effect when `untilStep` is next reset. Without `speedUp`, the period stays 15. **Verify in the asm** whether the cartridge's 256-frame counter restarts with each round or
    keeps running, and report it. We count from the round start either way: that is a deliberate
    choice for fairness, and it goes into CHANGES-FROM-ORIGINAL.

### Crashes, points and the end

11. Continuous motion, two players: each crashed rider gives the rival one point (`point`
    events, seat 0's first). Both crashing on the same step: both score. The step's `crash` event
    lists every crash with what it hit: the border, its own trail or the rival's.
12. After a crash that does not end the match, the phase becomes `crash`. Riders freeze, no steps
    happen, and `pauseTicks` counts down: `CRASH_PAUSE_TICKS` when seat 0 crashed (alone or with
    seat 1), `SHORT_CRASH_PAUSE_TICKS` when only seat 1 crashed (hook 3, the reused start value).
    When it reaches 0, the next round starts on that same tick (rule 1). `tick` keeps counting
    through the pause.
13. Reaching `setup.target` points ends the match on the crash tick itself (hook 5). There is no
    crash pause: the phase becomes `over`, an `over` event follows the points, and the board,
    riders and trails stay frozen as they are. Both reaching the target on the same step gives a
    tie with `winner: null`. Once over, `stepMatch` returns no events and changes nothing.
14. Riding alone (`players: 1`): seat 1 is not on the board. It lays nothing, never moves and is
    never in events. A crash of seat 0 emits `crash` and then `over` with `winner: null`, with no
    points and no pause.

### Free-draw (variations 13 and 14)

15. The stick is not latched. At each step the cursor moves along the stick's current heading,
    and a centred stick means it stays put. Rule 3a still writes or clears its current cell every
    step, moving or not. Nothing ever crashes or scores, reversal protection does not apply, the
    phase stays `running`, and the match never ends on its own. Fire erases (rule 3a). A cursor
    that does not move gives no `moves` entry.

### Space

16. `openSpace` and `pocketCells` flood across `EMPTY` cells only, from the rider's cell. They
    respect 4- or 8-connectivity and wraparound as described in the interface, and stop at
    `limit`. They must cost no more than O(cells visited). Reuse buffers so that calling them
    every step in a simulation does not allocate per cell.

## Tests required

Put them in `games/trailblaze/tests/engine/` (grid, headings, variations, match, space, plus
`tests/engine/helpers/` for drivers). Name each test by the behaviour it proves.

- Grid round-trips all 800 cells. `stepFrom` wraps on all four edges and diagonally at corners.
  There are 116 border cells.
- The variations table matches the dossier's §5 table for all 14 rows, on every field.
- One test per rule 1–16 above, at least. Put each hook in a `describe('1977 hooks')`:
  the diagonal hole (7); the asymmetric pause, with exact tick counts 240 and 224 from the crash
  tick to the next `round` event (12); riders passing through each other, all three cases
  (4); the target point skipping the pause, including a 10–10 tie (13).
- Latch: a single-tick push between steps turns the rider at the next step, and the last of two
  pushes wins (5).
- Speed-up: steps happen at the right ticks across all five periods in variation 3. Variation 1
  stays at 15 (10).
- Gaps in variation 7: holding fire leaves the vacated cell `EMPTY`, and another rider can then
  ride through the gap safely.
- Free-draw in variation 13: no crash when riding over trails; a centred stick leaves the cursor
  where it is; fire clears cells and reports them in `erased`.
- A scripted space-filling rider (a helper in `tests/engine/helpers/`, pure stick inputs, no
  look at the engine internals beyond `match.riders`) rides alone in variation 1 from the start
  cell and lays at least 616 trail cells (90% of the 684 open cells) before it crashes. This
  checks the step and collision rules.
- A fuzz test: 300 seeded random stick streams (a tiny local seeded generator in the helper,
  no `Math.random`), each run for 6,000 ticks over a mix of variations 1–12. After every tick
  check these invariants: no running rider stands on a non-`EMPTY` cell unless it crashed on
  that tick; the scores equal the points awarded; every non-empty, non-border cell has a
  `laidAt` of at most `tick`; the phase only moves running → crash → running or → over.
- Space: a sealed pocket of known size is counted exactly. A diagonal slip counts under 8-way
  steering but not under 4-way. Wraparound joins opposite edges. The `limit` caps the result.

Keep the whole engine suite under 10 s.

## Out of scope

The computer opponent's decision logic (only the pilot hook is in scope), Kid bots, Remix rules
(fading, ghost, shrinking arena, boost lanes, four riders), rendering, sound, input devices,
and anything outside the fence.
