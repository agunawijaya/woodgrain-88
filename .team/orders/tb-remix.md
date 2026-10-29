---
id: tb-remix
kind: engine
model: gemini-3.8-flash-high
fence:
  - games/trailblaze/src/engine/match.ts
  - games/trailblaze/src/engine/remix.ts
  - games/trailblaze/tests/engine/remix/**
acceptance:
  - pnpm exec vitest run --project trailblaze games/trailblaze/tests/engine
  - pnpm exec eslint games/trailblaze/src/engine games/trailblaze/tests/engine
  - pnpm exec prettier --check games/trailblaze/src/engine games/trailblaze/tests/engine
  - pnpm exec tsc -p games/trailblaze/tsconfig.json
reads:
  - games/trailblaze/src/engine/types.ts
  - games/trailblaze/src/engine/grid.ts
  - games/trailblaze/src/engine/headings.ts
  - games/trailblaze/src/engine/variations.ts
  - games/trailblaze/src/engine/space.ts
  - games/trailblaze/tests/engine/helpers/drivers.ts
  - games/trailblaze/docs/NOTES.md
---

## Goal

Three of our Remix rules in the engine: Fading Trails, Shrinking Arena and Boost Lanes. The
contract is already in `engine/types.ts` (`Remix` in `VariationRules.remix`, the `shrink` event,
`Match.shrunk`, `Move.ticks`). A match without `rules.remix` must behave exactly as it does today:
every existing engine test keeps passing unchanged. Ghost Trails needs nothing from the engine
(trails stay solid; only the view hides them), and Four Way comes in a later order.

Put the rule helpers in a new `src/engine/remix.ts` (pure functions over a `Match`), and call them
from `stepMatch` / round setup in `match.ts`. Keep `match.ts` readable: small named functions,
comments that say why.

## 1. Fading Trails — `remix.fadeAfter` (ticks)

- On every step (full or half, see §3), before anything is laid: each trail cell with
  `tick - laidAt[cell] >= fadeAfter` becomes `EMPTY` with `laidAt` -1, and is listed in that step
  event's `erased`. Border cells never fade.
- Nothing fades during a crash pause; the clock is `match.tick`, so a cell laid just before a pause
  may fade on the first step after it. That is fine.

## 2. Shrinking Arena — `remix.shrinkEvery` (ticks)

- Ring `r` is every cell whose distance to the nearest arena edge,
  `min(column, row, COLUMNS - 1 - column, ROWS - 1 - row)`, equals `r`. Ring 0 is the cartridge's
  border.
- While the phase is `running`, on the tick where `roundTick` reaches
  `(match.shrunk + 1) * shrinkEvery`, ring `match.shrunk + 1` becomes `BORDER` (trail cells in it
  are overwritten, `laidAt` -1) and `match.shrunk` increases. Emit
  `{ type: 'shrink', ring, cells }` with every cell of the ring, in index order, before any crash
  of that tick.
- A rider whose head is on a cell of the new ring crashes into the border on that tick, through
  the engine's normal crash path (points, both-crashed rule, crash pause, the 10th-point freeze).
- `LAST_RING = 7` (export it): the arena never closes further, so a strip of 4 rows stays open.
- Each new round starts with the full arena again and `shrunk = 0`.
- Only on bordered arenas; ignore `shrinkEvery` when `edges === 'wraparound'`.

## 3. Boost Lanes — `remix.boostLanes` (cells)

A rider on a lane moves twice as often:

- A **half step** comes `Math.ceil(stepPeriod / 2)` ticks after each full step. At the half step,
  only riders whose head is on a lane cell (and who have not crashed) move. They move exactly as at
  a full step: their latched heading is applied (reversal filter and switches included), the pilot
  is asked for pilot seats, fire leaves a gap or erases as the variation says, the trail is laid
  behind them, and crashes are judged as usual. Riders off the lanes do not move at a half step.
- The half step emits a normal `step` event (only the moving riders in `moves`; `period` stays the
  current step period), and `turn` events as a full step would.
- `Move.ticks`: at a full step, a rider whose new head is on a lane gets `Math.ceil(stepPeriod / 2)`
  and every other rider `stepPeriod`; at a half step, `stepPeriod - Math.ceil(stepPeriod / 2)`.
  Without boost lanes every move has `ticks === stepPeriod` (already so today).
- The speed-up schedule and the speed event only change at full steps.
- `match.steps` counts full steps only.

## Tests required (in `tests/engine/remix/`)

- Fading: a rider riding straight on a `fadeAfter: 100` channel: the first cell it laid is erased
  on the first step at or after 100 ticks, appears in that event's `erased`, and the cell is
  `EMPTY`; borders never fade; a rider can ride through a faded cell.
- Shrink: on `shrinkEvery: 300`, ring 1 closes at round tick 300 with its 112 cells listed (count
  them from the formula in the test, do not hard-code a different number), ring 2 at 600; a trail
  cell in ring 1 becomes `BORDER`; a rider whose head is on ring 1 at tick 300 crashes into the
  border and the rival scores; a new round restores ring 1 and `shrunk = 0`; never beyond
  `LAST_RING`; wraparound ignores the rule.
- Boost: with a lane under a rider riding straight, it covers twice the cells of a rider off the
  lanes over the same ticks; `ticks` values on full and half steps; a half step with no rider on a
  lane emits no `step` event; a crash at a half step scores like any other.
- Unchanged: a scripted match of variation 1 gives the same event log with `remix: {}` as with no
  `remix` at all. (The existing engine suite is the real guard: it must pass untouched.)

Keep the new tests under 3 s.

## Out of scope

Ghost Trails, Four Way, the session, views, Kids, channels and anything outside the fence.
