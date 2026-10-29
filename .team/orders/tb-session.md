---
id: tb-session
kind: engine
model: gemini-3.8-flash-high
fence:
  - games/trailblaze/src/session/match-session.ts
  - games/trailblaze/src/session/trap.ts
  - games/trailblaze/tests/session/**
acceptance:
  - pnpm exec vitest run --project trailblaze games/trailblaze/tests/session
  - pnpm exec eslint games/trailblaze/src/session games/trailblaze/tests/session
  - pnpm exec prettier --check games/trailblaze/src/session games/trailblaze/tests/session
  - pnpm exec tsc -p games/trailblaze/tsconfig.json
reads:
  - games/trailblaze/src/engine/types.ts
  - games/trailblaze/src/engine/match.ts
  - games/trailblaze/src/engine/space.ts
  - games/trailblaze/src/engine/grid.ts
  - games/trailblaze/src/look/look.ts
  - games/trailblaze/src/dev/hero.ts
  - games/trailblaze/tests/engine/helpers/drivers.ts
  - games/hot-and-cold/src/session/match-session.ts
---

## Goal

The match session: the glue between the engine, whoever steers each seat, and a look's view. It
runs the match in fixed 20 ms ticks from real frame times, tells the view what happened, spots the
trap closing, and keeps the numbers the results screen and the share line need. It must work
headless (no view) for tests and simulations.

## Context

- Engine: `createMatch`, `startMatch`, `stepMatch`, `MatchEvent`. Pilot seats (the computer) are set
  in `MatchSetup.pilots`; their sticks are ignored.
- View: `TrailView` in `look/look.ts`. `src/dev/hero.ts` already drives a view from match events in
  `createDirector`, including a first version of trap spotting. Move that logic here and make it
  solid, and keep its event-to-view mapping exactly.
- Hot & Cold's `match-session.ts` is the house style for a session.
- No DOM, no wall clock, no randomness: the caller passes elapsed seconds.

## Interface to implement

```ts
// games/trailblaze/src/session/trap.ts
export interface Trap {
  readonly seat: Seat; // the rider shut in
  readonly pocket: readonly Cell[];
  /** The cell whose laying closed the pocket: a cell the rival laid this step. */
  readonly seal: Cell;
}
/** Pocket size at or below which a shut-in rider counts as trapped. */
export const TRAP_POCKET = 40;
/**
 * After a step: riders still running whose reachable space has just become a sealed pocket of at
 * most TRAP_POCKET cells, with the rival outside it. `alreadyTrapped` holds seats reported earlier
 * this round, which are not reported again.
 */
export function spotTraps(
  match: Readonly<Match>,
  laid: readonly Laid[],
  alreadyTrapped: ReadonlySet<Seat>,
): Trap[];

// games/trailblaze/src/session/match-session.ts
export interface SeatDriver {
  /** Everything the match said this tick (a Kid takes in what a player would see). */
  hear?(events: readonly MatchEvent[], match: Readonly<Match>): void;
  /** What the seat holds this tick. */
  stick(match: Readonly<Match>): Stick;
}
export type SessionEvent = MatchEvent | ({ readonly type: 'trap' } & Trap);
/** Who took each point, in order: one seat, or both on a shared crash. */
export type PointTaker = Seat | 'both';
export interface SessionStats {
  readonly points: readonly PointTaker[];
  /** Trail cells each rider laid over the whole match. */
  readonly cellsLaid: readonly [number, number];
  /** The longest a round lasted, in seconds of play (crash pauses excluded). */
  readonly longestRoundSeconds: number;
  /** Seconds each rider spent riding in the current round. */
  readonly roundSeconds: number;
  readonly traps: readonly Trap[];
}
export interface MatchSessionOptions {
  readonly setup: MatchSetup;
  readonly drivers: readonly [SeatDriver, SeatDriver];
  readonly view?: TrailView;
  /** Called for every event as it happens, after the view has been told. */
  readonly onEvent?: (event: SessionEvent) => void;
  /** At most this many ticks run per `advance`, so a stalled tab does not fast-forward a match. */
  readonly maxTicksPerAdvance?: number; // default 10
}
export interface MatchSession {
  readonly match: Readonly<Match>;
  readonly stats: SessionStats;
  /** Moves time on by `seconds` of real time: whole 20 ms ticks, the rest carried over. */
  advance(seconds: number): void;
  readonly over: boolean;
  dispose(): void;
}
export function createMatchSession(options: MatchSessionOptions): MatchSession;
```

## Behaviour and edge cases

1. Creating the session starts the match. The `round` event is handled like any other.
2. Each tick: ask both drivers for a stick, then `stepMatch`. Pass the tick's events to every
   driver's `hear`, then to the view, then to `onEvent`. When riding alone (`players: 1`), seat 1's
   driver is never asked.
3. View mapping, exactly as `hero.ts` does it:
   - `round`: `view.reset(edges)`, then `placeRider` for each riding seat from `START`;
   - `step`: `view.step(laid, erased, moves, period / TICKS_PER_SECOND)`;
   - `speed`: `setSpeedStage(stage)`;
   - `crash`: `view.crash(each crash)`;
   - `over`: `view.freeze()`.

   `view.update(seconds)` is called once per `advance` with the real seconds, after the ticks, but
   not after the match is over and the view frozen (still call it, the view handles the freeze).

4. Traps: after a `step` event, `spotTraps` with the step's laid cells. Each trap is passed to
   `view.trap(seat, pocket, seal)` and then emitted as a `trap` session event, once per seat per
   round. A rider counts as running while the phase is 'running' and it has not crashed. The seal
   is a cell in `laid` whose seat is the rival; if there is none, the rival's head cell.
5. Stats: `points` gets one entry per crash event that awarded points: `both` when both riders
   crashed on that step, otherwise the rival of the crasher. `cellsLaid` counts `laid` entries per
   seat. A round's seconds count running ticks only. `longestRoundSeconds` is the maximum over the
   rounds finished so far and the current one.
6. `advance` with an accumulator: `advance(0.03)` twice gives 3 ticks. `advance(1)` gives at most
   `maxTicksPerAdvance` ticks and drops the rest.
7. After `over`, `advance` runs no more ticks.
8. `spotTraps` floods with `pocketCells(match, head, TRAP_POCKET + 1)`. A pocket larger than
   TRAP_POCKET, or containing the rival's head, is not a trap.

## Tests required

In `tests/session/` (use a recording fake view that logs calls):

- the fixed step: tick counts for a sequence of advances, and the cap;
- the view gets reset, placeRider, step, speed, crash, trap and freeze in order, with the right
  arguments (script a short match with drivers that return planned sticks);
- traps: replay the trap story from `src/dev/hero.ts` (variation 3, the same planned headings) and
  get exactly one trap for seat 1, with a pocket of 9 cells and the seal at column 22, row 1;
- no trap when the pocket holds the rival, or is bigger than 40 cells;
- stats: points (including a `both`), cellsLaid, and the longest round over a scripted match to 3
  points;
- alone (`players: 1`): seat 1's driver is never called;
- after `over`, advance does nothing more;
- determinism: the same drivers and advances give the same event log.

Keep the suite under 5 s.

## Out of scope

Input devices and key bindings, Kids, the app and screens, sound, rendering, and anything outside
the fence. Do not edit `src/dev/hero.ts`; the lead will switch it over to the session.
