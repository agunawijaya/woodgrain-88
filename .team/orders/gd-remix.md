---
id: gd-remix
kind: engine
member: deepseek-pro
fence:
  - games/gravity-duel/src/engine/remix.ts
  - games/gravity-duel/src/engine/match.ts
  - games/gravity-duel/tests/remix.test.ts
acceptance:
  - pnpm exec vitest run --root games/gravity-duel tests/remix.test.ts tests/match-setup.test.ts tests/match-combat.test.ts tests/match-docking.test.ts tests/physics.test.ts
  - pnpm exec eslint games/gravity-duel/src/engine/remix.ts games/gravity-duel/src/engine/match.ts games/gravity-duel/tests/remix.test.ts
  - pnpm exec prettier --check games/gravity-duel/src/engine/remix.ts games/gravity-duel/src/engine/match.ts games/gravity-duel/tests/remix.test.ts
  - pnpm exec tsc -p games/gravity-duel/tsconfig.json
reads:
  - games/gravity-duel/src/engine/types.ts
  - games/gravity-duel/src/engine/physics.ts
  - games/gravity-duel/src/engine/match.ts
  - games/gravity-duel/src/channels.ts
  - games/gravity-duel/docs/NOTES.md
  - games/gravity-duel/tests/helpers.ts
---

## Goal

Gravity Duel's four Remix rules, our own additions on top of cartridge variations (see
`src/channels.ts`):

- **Binary Stars** (on variation 5);
- **Comet** (on variation 3);
- **Asteroid Belt** (on variation 6);
- **Last Fuel** (on variation 5).

Put them in a new `src/engine/remix.ts`, and hook them into `match.ts` with the smallest change
that keeps every existing test passing.

## Context

- `match.rules.remix?.id` says which Remix is on; absent on the cartridge's own channels, whose
  behaviour must not change at all.
- Read `types.ts` (units: subpixels, fine units, headings), `physics.ts` (`gravityPull`,
  `gravityTurn`, `touching`, `axisDelta`, `moveBody`) and `match.ts` (the tick order).
- Everything is deterministic: positions from the tick, randomness only from `match.random`.

## Interface to implement (`remix.ts`)

```ts
import type { Match } from './types.ts';

/** A pulling, possibly deadly, body that is not the cartridge's middle: a binary star, the comet, a rock. */
export interface RemixBody {
  readonly x: number; // subpixels
  readonly y: number;
  readonly radius: number; // steps
}

/** Where the two binary stars are at `tick`. */
export function binaryStars(tick: number): readonly [RemixBody, RemixBody];

/** Where the comet is at `tick`, or null between passes. */
export function cometAt(match: Readonly<Match>): RemixBody | null;

/** Where the asteroid belt's rocks are at `tick`. */
export function beltRocks(tick: number): readonly RemixBody[];

/** The pull on a body at (x, y) this tick from every gravity source the match has (cartridge middle or Remix), in fine units. */
export function pullAt(match: Readonly<Match>, x: number, y: number): { x: number; y: number };
```

## Behaviour

**Gravity in general.**

1. `pullAt` is the sum of `gravityPull` from each source, each scaled by its strength factor and
   rounded toward zero (`Math.trunc`) per component.
2. Sources:
   - **cartridge:** the middle (factor 1) when `rules.gravity` and no Remix replaces it;
   - **Binary Stars:** both stars, factor 0.6 each, _instead of_ the middle;
   - **Comet:** the comet, factor 0.8, while it is crossing, on top of whatever else pulls;
   - **Asteroid Belt and Last Fuel:** no change.
3. `match.ts` uses `pullAt` in its gravity step, on the same staggered turns (`gravityTurn`). Its
   bend tracking for missiles (`turned`) stays as it is.

**Binary Stars** (`binary-stars`, on variation 5):

4. The pair circles the field's middle on a circle of radius 14 steps, one full turn per 1,000
   ticks, counter-clockwise on screen (y down):
   - star 0 is at angle `2π × tick / 1000`;
   - star 1 is opposite it;
   - positions are rounded to whole subpixels.
5. Each star has radius 4 steps and behaves exactly like the cartridge's star, and the
   cartridge's own middle star is not there:
   - a ship that touches either goes home, explodes and the rival scores (`star-crash`);
   - a missile that touches either is swallowed (`swallowed`).

**Comet** (`comet`, on variation 3):

6. Passes start on ticks 600, 1600, 2600, … (every 1,000 ticks from 600) and each lasts 300
   ticks.
7. At the start of each pass, draw from `match.random`:
   - a start height `y0` and an end height `y1`, each `random.int(15, 75)` steps;
   - a direction: left to right on even passes, right to left on odd ones.
8. During the pass the comet moves in a straight line from the field's left edge (x = −10 steps)
   to its right (x = 170 steps), or the reverse, at a constant rate, its height going from `y0` to
   `y1`.
9. It pulls (item 2) but touches nothing: no collisions, no events except `comet` (below).
10. Emit `comet` with `entering: true` on a pass's first tick and `entering: false` on the tick
    after its last.

**Asteroid Belt** (`asteroid-belt`, on variation 6):

11. Ten rocks of radius 2.5 steps, evenly spaced on a circle of radius 24 steps round the middle,
    turning one full turn per 3,000 ticks (counter-clockwise), positions rounded to whole
    subpixels.
12. **A live missile that touches a rock** stops being live; emit
    `{ kind: 'rock', seat, what: 'missile' }`.
13. **A ship that touches a rock** (not cloaked) bounces off it:
    - its velocity is reflected about the line from the rock's centre to the ship's centre:
      `v' = v − 2 (v·n) n`, with n the unit normal, computed in floating point and rounded to
      whole fine units with `Math.round`;
    - it is pushed out along n to just outside the touching distance;
    - emit `{ kind: 'rock', seat, what: 'ship' }`.

    A ship in contact with two rocks bounces off the nearer one only.

14. Rocks are checked in the touches step, after the cartridge's own touches (a ship that
    refuelled this tick is already home and does not bounce).

**Last Fuel** (`last-fuel`, on variation 5):

15. There is no mutual reload: missiles never refill.
16. When neither ship has ammo left and neither missile is live, the match ends with reason
    `'spent'`; the higher score wins, a tie is a draw. Target and clock still end it as usual.

**Events and types.** `types.ts` already has what you need (do not change it):

- the `rock` event (`seat`, `what: 'ship' | 'missile'`);
- the `comet` event (`entering`: true at a pass's start, false at its end);
- the `over` reason `'spent'`.

Keep the comet's pass state in a `WeakMap<Match, …>` inside `remix.ts`.

## Tests required (`tests/remix.test.ts`)

Use `tests/helpers.ts`; build setups from `channelById('binary-stars')` and the others:

- the cartridge channels are unchanged: the existing match tests still pass, untouched;
- binary stars:
  - they sit 14 steps from the middle, opposite each other, and turn once per 1,000 ticks;
  - both pull, and the middle no longer does;
  - a ship touching either star crashes and the rival scores;
  - a missile touching one is swallowed;
- comet:
  - passes start every 1,000 ticks from 600 and last 300;
  - it crosses from edge to edge;
  - it pulls a body near its path and not one far away;
  - passes replay identically for the same seed;
- asteroid belt:
  - ten rocks on a ring of 24 steps turning once per 3,000 ticks;
  - a missile stops at a rock;
  - a ship bounces off one with its speed kept (within rounding) and its normal component
    reversed;
  - a cloaked ship passes through;
- last fuel:
  - no reload when both are empty;
  - the match ends 'spent' when both are out and no missile flies, with the higher score winning.

## Out of scope

Rendering, the Kids, sessions. Do not change `physics.ts` or the cartridge channels' behaviour.
