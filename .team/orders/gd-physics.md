---
id: gd-physics
kind: engine
member: deepseek-pro
fence:
  - games/gravity-duel/src/engine/physics.ts
  - games/gravity-duel/tests/physics.test.ts
acceptance:
  - pnpm exec vitest run --root games/gravity-duel tests/physics.test.ts
  - pnpm exec eslint games/gravity-duel/src/engine/physics.ts games/gravity-duel/tests/physics.test.ts
  - pnpm exec prettier --check games/gravity-duel/src/engine/physics.ts games/gravity-duel/tests/physics.test.ts
  - pnpm exec tsc -p games/gravity-duel/tsconfig.json
reads:
  - games/gravity-duel/src/engine/types.ts
  - games/gravity-duel/docs/NOTES.md
  - research/dossiers/16-gravity-duel.md
  - games/trailblaze/src/engine/headings.ts
---

## Goal

Build Gravity Duel's physics core: `games/gravity-duel/src/engine/physics.ts`, pure functions
that move bodies, turn and thrust ships, burn fuel, apply the middle's gravity and test touches,
all in whole numbers exactly as specified below. Write `tests/physics.test.ts` first. The match
rules (firing, hits, cloak, docking, scoring) are a later order that will call these functions.

## Context

- Gravity Duel is our reimplementation of a 1978 two-ship orbital duel. `docs/NOTES.md` is the
  verified behaviour, in the lead's words; read its Units, Turning and thrust, Missiles, Gravity
  and Edges sections. The dossier is background only; where it and NOTES.md differ, NOTES.md wins
  (it corrects the gravity law and adds the speed fold).
- All the shapes and constants are in `src/engine/types.ts`. Import them; do not redefine them or
  change that file.
  - Positions are subpixels (256 per step).
  - Velocities are fine units (256 per speed unit; one speed unit is 1/16 step per tick).
  - Headings are 0–15: 0 right, 4 up, 8 left, 12 down; turning left counts up. The field's y runs
    down the screen.
- No randomness and no wall clock: everything is a function of its inputs. Floating point appears
  only in `thrustVector` and `gravityPull`, and only through `Math.cos`, `Math.sin`, `Math.sqrt`,
  `*`, `/`, `Math.round` and `Math.floor`, so results are identical everywhere.

## Interface to implement

Exactly these exports, with these signatures:

```ts
import type { Body, Controls, Edges, Ship } from './types.ts';

export interface Vector {
  readonly x: number;
  readonly y: number;
}

/** The whole speed units in a velocity (rounded down, so -0.5 units is -1). */
export function speedUnits(fine: number): number;

/** The cartridge's speed fold, applied to one axis of a velocity before every move. */
export function foldSpeed(fine: number): number;

/** One thrust along a heading, in fine units. */
export function thrustVector(heading: number): Vector;

/** What firing adds to the ship's velocity, in whole speed units. */
export function muzzleVelocity(heading: number): Vector;

/** The middle's pull on a body, in fine units, given the vector from the body to the middle in subpixels. */
export function gravityPull(dx: number, dy: number): Vector;

/** Which body gravity pulls this tick: 0 ship 0, 1 ship 1, 2 shot 0, 3 shot 1; null on even ticks. */
export function gravityTurn(tick: number): 0 | 1 | 2 | 3 | null;

/** Moves a body one tick: fold, move, then the edges. Returns true when it bounced off a wall. */
export function moveBody(body: Body, edges: Edges, radius: number): boolean;

/** Turns a ship by its controls, with the cartridge's tap-then-repeat cadence. */
export function turnShip(ship: Ship, controls: Controls): void;

/**
 * Thrust for one tick. `unlimited` is docking (fuel never runs out). Returns 'fuel-out' when this
 * tick's thrust burned the last fuel segment, otherwise null.
 */
export function thrustShip(
  ship: Ship,
  controls: Controls,
  tick: number,
  unlimited: boolean,
): 'fuel-out' | null;

/** One burn from the fuel counter. Returns true when this burn took the last segment. */
export function burnFuel(ship: Ship): boolean;

/** Drops a whole fuel segment at once (cloaking). Returns true when the tank is now empty. */
export function dropSegment(ship: Ship): boolean;

/** The signed difference b − a along an axis of length `size` subpixels, the short way round when edges wrap. */
export function axisDelta(a: number, b: number, size: number, edges: Edges): number;

/** Whether two bodies' circles overlap; radii in steps. */
export function touching(a: Body, b: Body, radiusA: number, radiusB: number, edges: Edges): boolean;

/** The cartridge's docking measure: |Δ whole units of vx| + |Δ whole units of vy|. */
export function speedDifference(a: Body, b: Body): number;
```

## Behaviour and edge cases

1. `speedUnits(fine)` is `Math.floor(fine / 256)` (equivalently `fine >> 8` for the range used).
2. `foldSpeed(fine)`:
   - split into `whole = speedUnits(fine)` and `fraction = fine - whole * 256` (0–255);
   - wrap `whole` to the signed 8-bit range: `((whole + 128) mod 256) - 128`, with a mod that is
     never negative;
   - then fold it: if `whole >= 64` it becomes `127 - whole`, if `whole <= -65` it becomes
     `-129 - whole`;
   - return `whole * 256 + fraction`.

   Examples: 64 units → 63; 65 → 62; 96 → 31; −65 → −64; −100 → −29; 130 → −3. The fraction is
   kept unchanged.

3. `thrustVector(h)`:
   - take `h` mod 16, never negative, and the angle `h × π / 8`;
   - `x = Math.round(72 × cos)`, `y = −Math.round(72 × sin)` (y runs down);
   - never return `-0`: normalise zeros to `0`.

   Examples: 0 → (72, 0); 4 → (0, −72); 8 → (−72, 0); 12 → (0, 72); 1 → (67, −28); 2 → (51, −51);
   3 → (28, −67); 9 → (−67, 28).

4. `muzzleVelocity(h)`: each component of `thrustVector(h)` shifted right by one with sign (`>> 1`),
   giving whole speed units: 0 → (36, 0); 8 → (−36, 0); 1 → (33, −14); 9 → (−34, 14);
   2 → (25, −26). Never `-0`.
5. `gravityPull(dx, dy)`:
   - work in steps as floats: `ax = |dx| / 256`, `ay = |dy| / 256`, `d = Math.sqrt(ax*ax + ay*ay)`;
   - if `d === 0`, return (0, 0);
   - each component is `Math.min(255, Math.floor((26000 * a) / (d * d * d)))`, where `a` is that
     axis's distance, signed toward the middle (the sign of `dx` or `dy`);
   - a component whose axis distance is 0 is 0;
   - never `-0`.

   Put 26000 and 255 in named constants with a comment saying the pull is inverse-square, fitted
   to the cartridge's behaviour (see NOTES.md, Gravity).

   Examples, with inputs in subpixels:
   - (12×256, 4×256) → (154, 51);
   - (20×256, 0) → (65, 0);
   - (40×256, 0) → (16, 0);
   - (5×256, 0) → (255, 0);
   - (−12×256, −4×256) → (−154, −51).

6. `gravityTurn(tick)`: null when `tick` is even; for odd ticks `(tick >> 1) & 3`. So ticks 1, 3,
   5, 7, 9 give 0, 1, 2, 3, 0; each body is pulled once every 8 ticks.
7. `moveBody(body, edges, radius)`, in this order:
   1. `body.vx = foldSpeed(body.vx)`, `body.vy = foldSpeed(body.vy)`.
   2. `prevX = x`, `prevY = y`, `wrapped = false`.
   3. `x += vx >> 4`, `y += vy >> 4` (arithmetic shift: −1 moves −1 subpixel, 16×256 moves 256).
   4. Edges, with `W = FIELD_WIDTH × SUBPIXELS`, `H = FIELD_HEIGHT × SUBPIXELS`:
      - **Wrap:** bring `x` into `[0, W)` and `y` into `[0, H)` with a non-negative modulo, and set
        `wrapped = true` if either changed.
      - **Bounce:** with `lo = radius × 256` and `hiX = W − lo` (and `hiY = H − lo`), if `x < lo`
        then `x = 2·lo − x` and `vx = −vx`; else if `x > hiX` then `x = 2·hiX − x` and `vx = −vx`.
        The same for `y`. Return true if either axis bounced.

   The return value is false for wrap edges.

8. `turnShip(ship, c)`:
   - Exactly one of `c.left` and `c.right` held:
     - if `ship.turnWait === 0`, step the heading (left +1, right −1, kept in 0–15) and set
       `turnWait = TURN_REPEAT_TICKS`;
     - then `turnWait -= 1`.
   - Neither or both held: `turnWait = 0`.

   A tap therefore turns at once, and holding steps again on held ticks 1, 9, 17, … A full circle
   (16 steps) takes 121 held ticks.

9. `thrustShip(ship, c, tick, unlimited)`:
   - `ship.thrusting = c.thrust && (unlimited || ship.fuel > 0)`;
   - if thrusting and `tick % THRUST_EVERY === 0`, add `thrustVector(ship.heading)` to `vx`/`vy`;
   - then, unless `unlimited`, call `burnFuel(ship)` and return 'fuel-out' if it emptied the tank;
   - return null otherwise.
10. `burnFuel(ship)`:
    - `burnsLeft -= 1`;
    - when it reaches 0, set `burnsLeft = BURNS_PER_SEGMENT` and take a segment
      (`fuel = max(0, fuel − 1)`), returning true only if that left `fuel === 0`;
    - otherwise return false.

    (A match starts each ship at `burnsLeft = BURNS_PER_SEGMENT − 1`, so the first segment lasts
    255 burns; that is the match's business, but test it through a ship built that way.)

11. `dropSegment(ship)`: `fuel = max(0, fuel − 1)`; return `fuel === 0`. `burnsLeft` is untouched.
    Dropping with 0 fuel returns true.
12. `axisDelta(a, b, size, edges)`: `b − a`; when `edges === 'wrap'`, shifted by whole multiples
    of `size` into `[−size/2, size/2)`.
13. `touching(a, b, ra, rb, edges)`:
    - `dx` and `dy` are `axisDelta` on each axis (W and H in subpixels);
    - true when `dx² + dy² < ((ra + rb) × 256)²`, so touching exactly at the radius sum is false.
14. `speedDifference(a, b)` is `|speedUnits(a.vx) − speedUnits(b.vx)| + |speedUnits(a.vy) −
speedUnits(b.vy)|`. Fractions do not count: 1.9 units against 1.0 differs by 0.

Mutate the bodies and ships passed in; allocate nothing per call except the returned `Vector`s.
Every function stays short; give the module a header comment that says what it is for, and
comment _why_ (the 8-bit fold, the inverse-square fit, the tap-then-repeat cadence), never what
the next line does.

## Tests required

Write these in `tests/physics.test.ts` with a small local helper that builds a `Ship` or a `Body`
at rest in the middle (fill every field of the interfaces in `types.ts`). One `it` per behaviour,
named for it:

- the fold leaves speeds from −64 to 63 units alone, fraction included;
- the fold turns 64 into 63, 96 into 31, −65 into −64, −100 into −29 and 130 into −3, keeping the
  fraction;
- the thrust vector has the values listed in item 3, wraps headings 16 and −1, and never gives −0;
- the muzzle velocity is half the thrust vector, rounded toward minus infinity (item 4);
- a missile fired straight ahead from a ship at 60 units folds to 31 (60 + 36 through
  `foldSpeed`), slower than its ship;
- straight thrust from rest first reaches 63 units on tick 896 and never exceeds 63 while held for
  2,000 ticks (call `thrustShip` then `moveBody` with wrap edges each tick, `unlimited` true);
- thrust is applied only on ticks divisible by 4, and `thrusting` is true on every held tick;
- without fuel and not unlimited, thrust does nothing and `thrusting` is false;
- the first fuel segment lasts 255 burns and later ones 256 (ship built with
  `burnsLeft = BURNS_PER_SEGMENT − 1`);
- `thrustShip` returns 'fuel-out' exactly on the thrust that burns the last segment, and never
  again;
- `dropSegment` takes a segment at once without touching the burn counter, and reports an empty
  tank from 1 or 0 segments;
- a tap turns one step at once; held, the turn repeats every 8 ticks;
- 121 held ticks turn a full circle; 120 turn 15 steps;
- left counts up and right counts down, wrapping between 15 and 0;
- holding both directions turns nothing, and letting go makes the next press turn at once;
- gravity is null on even ticks and visits bodies 0, 1, 2, 3 on ticks 1, 3, 5, 7;
- the pull is zero at the middle, points toward the middle on every quadrant, and is symmetric
  (`pull(a, b).x === pull(b, a).y`);
- the pull has the values listed in item 5, and is capped at 255 per component;
- along an axis, doubling the distance from 20 to 40 steps cuts the pull to a quarter, give or
  take 1;
- a body moves `velocity >> 4` subpixels a tick, rounding toward minus infinity for negative
  velocities, and records where it was;
- moving folds first: a body at 64 units moves as one at 63;
- wrap edges carry a body across each side and mark it wrapped, and an ordinary move clears the
  mark;
- bounce edges reflect the position about the margin, reverse only that axis and return true;
- touching is strict at the radius sum, works across a wrapped edge and not across a bouncing one;
- the speed difference sums whole-unit differences and ignores fractions.

## Out of scope

- `match.ts`, firing, hits, the cloak, docking, scoring, the clock, variations, Remix, the Kids,
  rendering: all later orders.
- Do not change `types.ts`, `NOTES.md` or any other file outside the fence. If something in the
  interface looks wrong, say so in your report instead.
