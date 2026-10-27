---
id: tank-vehicles
kind: engine
model: gemini-3.8-flash-high
fence:
  - games/tank-duel/src/engine/controls.ts
  - games/tank-duel/src/engine/vehicles.ts
  - games/tank-duel/tests/controls.test.ts
  - games/tank-duel/tests/vehicles.test.ts
acceptance:
  - pnpm exec vitest run --project tank-duel games/tank-duel/tests/controls.test.ts games/tank-duel/tests/vehicles.test.ts
  - pnpm exec eslint games/tank-duel/src/engine/controls.ts games/tank-duel/src/engine/vehicles.ts games/tank-duel/tests/controls.test.ts games/tank-duel/tests/vehicles.test.ts
  - pnpm exec prettier --check games/tank-duel/src/engine/controls.ts games/tank-duel/src/engine/vehicles.ts games/tank-duel/tests/controls.test.ts games/tank-duel/tests/vehicles.test.ts
  - pnpm exec tsc -p games/tank-duel/tsconfig.json
reads:
  - games/tank-duel/src/engine/types.ts
  - games/tank-duel/src/engine/rules.ts
  - games/tank-duel/src/engine/vec.ts
  - games/tank-duel/src/engine/walls.ts
  - games/tank-duel/src/engine/channels.ts
  - games/tank-duel/src/arenas/format.ts
  - games/tank-duel/src/arenas/layouts.ts
  - games/tank-duel/src/arenas/skies.ts
  - games/tank-duel/tests/walls.test.ts
---

## Goal

How the duel's vehicles move, one fixed step at a time: reading a seat's stick for each vehicle class
(with the 32-in-1 cartridge's swapped biplane wiring), tanks that turn in sixteen steps, drive forward
only, get pushed back off walls and each other and slide free when wedged, and aircraft that never
stop, change speed tier, and wrap round the sky. Pure functions on the plain data in `types.ts`; no
DOM, no three.js, no randomness. The match state machine (written next, by another order) calls these.

## Context

- Read `types.ts` (`StickInput`, `Intent`, `VehicleState`, `VehicleClass`, `ChannelRules`) and
  `rules.ts` (every number: use the constants, never retype a value). Headings are integer steps
  0–15; `headingVector` in `vec.ts`. World units, x right and y down the screen.
- Tank arenas are 64 × 40 with walls; build wall faces with `buildWallEdges(wallPolygons(arena))`
  (`walls.ts`, `arenas/format.ts`). Skies are 64 × 40, no walls, and wrap at their edges.
- A tank is a circle of radius `TANK_RADIUS`; aircraft radii are in `VEHICLE_RADIUS`. Aircraft never
  collide with anything (not clouds, not each other).
- 1977 behaviour to keep: holding the stick to one side steps the heading every `TURN_STEP_SECONDS`;
  tanks drive only forward and only while the stick is up; a tank touching a wall or the other tank is
  pushed straight back (opposite its facing); a driving tank pressed against something for
  `WEDGED_SECONDS` turns one step clockwise to slide free; aircraft fly constantly at slow, cruise or
  fast speed; switch A (handicap) lowers aircraft speeds (not tanks).

## Interface to implement

```ts
// games/tank-duel/src/engine/controls.ts
import type { Intent, StickInput, VehicleClass } from './types.ts';

/**
 * What a stick means for a vehicle. Tanks and jets: x turns (right = clockwise), y up drives (tank) or
 * burns (jet: up fast, down slow). Biplanes and the bomber, standard: the same as jets.
 * Biplanes and the bomber with `wiring` (the 32-in-1 cartridge): y turns (up = clockwise, down =
 * anticlockwise) and x sets the speed (right fast, left slow).
 */
export function intentFor(stick: StickInput, vehicle: VehicleClass, wiring: boolean): Intent;
```

```ts
// games/tank-duel/src/engine/vehicles.ts
import type { Arena, SkyDef } from '../arenas/format.ts';
import type { WallEdge } from './walls.ts';
import type { ChannelRules, Intent, MatchEvent, Side, VehicleState } from './types.ts';
import type { Vec2 } from './vec.ts';

/** Every vehicle of a channel at its starting place: ids from 0, side 0's vehicles first. */
export function spawnVehicles(channel: ChannelRules, field: Arena | SkyDef): VehicleState[];

export interface TankWorld {
  readonly edges: readonly WallEdge[];
  /** Every other vehicle on the board (for tank-on-tank contact). */
  readonly others: readonly VehicleState[];
}

export interface VehicleStep {
  readonly vehicle: VehicleState;
  readonly events: readonly MatchEvent[];
}

export function stepTank(
  tank: VehicleState,
  intent: Intent,
  dt: number,
  world: TankWorld,
): VehicleStep;

export interface AircraftConditions {
  readonly handicap: boolean;
  /** False when the fast tier is not available (Ace Duel with an empty tank). */
  readonly fastAllowed: boolean;
}

export function stepAircraft(
  craft: VehicleState,
  intent: Intent,
  dt: number,
  conditions: AircraftConditions,
): VehicleStep;

/** The speed an aircraft is heading for with this throttle (-1, 0, 1) and handicap. */
export function aircraftTargetSpeed(
  vehicle: VehicleState['vehicle'],
  throttle: -1 | 0 | 1,
  handicap: boolean,
): number;

/** Ace Duel: fuel after a step; burning while the throttle is 1 and fuel is left, refilling otherwise. */
export function burnFuel(
  fuel: number,
  throttle: -1 | 0 | 1,
  dt: number,
  capacity: number,
  refillPerSecond: number,
): number;

/** Where a vehicle's shell appears: its muzzle, ahead of its centre along its heading. */
export function muzzlePoint(vehicle: VehicleState): Vec2;

/** Turns a vehicle by whole heading steps (positive clockwise), wrapping into 0–15. */
export function turnBy(vehicle: VehicleState, steps: number): VehicleState;

/**
 * Moves a vehicle by `delta` (the knockback after a hit). Tanks stop short of walls: the move is cut
 * to the furthest point along `delta` that does not overlap a wall (search in 8 steps). Aircraft move
 * freely and wrap.
 */
export function shove(vehicle: VehicleState, delta: Vec2, edges: readonly WallEdge[]): VehicleState;

/** Whether a circle overlaps any wall face (its distance to a face is less than its radius). */
export function circleTouchesWalls(
  center: Vec2,
  radius: number,
  edges: readonly WallEdge[],
): boolean;

/** Folds a point into the 64 × 40 sky. */
export function wrapSky(point: Vec2): Vec2;
```

## Behaviour and edge cases

1. **intentFor** follows the doc comment exactly. Tanks: `throttle` 1 when y is up, otherwise 0 (down
   does not reverse). `fire` passes through.
2. **spawnVehicles.**
   - Tanks: one per side at `arena.spawns[side]`, with its heading.
   - Aircraft: `channel.formation[side]` per side around `sky.spawns[side]`, side by side along the
     y axis, `FORMATION_SPACING` apart and centred on the spawn. Slot 0 is the lowest-y member, the
     leader; every member gets the spawn heading.
   - `vehicle` comes from `channel.vehicles[side]` and `radius` from `VEHICLE_RADIUS`. Speed: tanks
     0; aircraft their cruise speed (no handicap; the first steps ease it). Timers all 0.
   - Ids from 0 in order: side 0's members by slot, then side 1's.
   - Throw if the field kind does not match the channel's (an arena for a sky channel or the other
     way round).
3. **Turning (tanks and aircraft alike).**
   - With `turn` not 0: when `turnTimer` is 0 or less, step the heading by `turn` at once (feedback
     on the first frame) and set `turnTimer` to `TURN_STEP_SECONDS`. Otherwise subtract `dt`; when it
     reaches 0 or less, step again and add `TURN_STEP_SECONDS`.
   - With `turn` 0: `turnTimer` becomes 0, so the next press steps at once.
   - Every step emits `{ kind: 'turned', vehicle: id, heading }`.
4. **stepTank driving.**
   - With `throttle` 1, try to move `TANK_SPEED * dt` along the heading. The move is blocked when the
     new circle touches a wall (`circleTouchesWalls`) or overlaps another tank (centre distance less
     than the sum of radii).
   - When blocked, the tank stays where it was and is then pushed back `BUMP_PUSH` opposite its
     heading, but only if that spot is free; otherwise it stays.
   - A tank not driving but overlapping another tank (it was driven into) is not moved.
5. **Bumps and wedging.** Whenever a drive is blocked:
   - set `bumped` to `BUMP_REVEAL_SECONDS`;
   - emit `{ kind: 'bumped', vehicle, at: position }` only when `bumped` was 0 before (one event per
     contact, not one per step);
   - add `dt` to `wedged`; when `wedged` reaches `WEDGED_SECONDS`, turn one step clockwise (emit
     `turned`) and reset `wedged` to 0.

   When the drive was not blocked, or the tank is not driving, `wedged` is 0. `bumped` counts down by
   `dt` to 0 every step.

6. **stepAircraft.**
   - Turning as in 3.
   - The target speed is `aircraftTargetSpeed(vehicle, throttle, handicap)`, with throttle 1 treated
     as 0 when `fastAllowed` is false. The speed moves towards the target by at most
     `(fast - slow) / THROTTLE_SECONDS * dt` per step, using that class's B speeds.
   - Then move `speed * dt` along the heading and wrap with `wrapSky`. No collisions, no events but
     `turned`.
7. **aircraftTargetSpeed**: `AIRCRAFT_SPEEDS[vehicle][throttle + 1]`, minus `AIRCRAFT_HANDICAP[vehicle]`
   with the handicap. Throws for tanks.
8. **burnFuel.** With throttle 1 and fuel above 0: `max(0, fuel - dt)`. Otherwise
   `min(capacity, fuel + refillPerSecond * dt)`.
9. **muzzlePoint**: `position + headingVector(heading) * reach`, where reach is `TANK_MUZZLE` for
   tanks and `AIRCRAFT_MUZZLE[vehicle]` otherwise. Aircraft muzzles wrap.
10. **turnBy** keeps headings integer in 0–15 (negative steps wrap too).
11. **shove** (see the doc comment).
    - Tanks: test the full move, then 7/8, 6/8 … 1/8 of it, and take the first that is free of
      walls. The other tank is ignored here.
    - Aircraft: wrap.
12. Never mutate inputs; return new objects. No `Math.random`.

## Tests required

`controls.test.ts`:

- tanks: up drives, down does nothing, left and right turn;
- jets: up fast, down slow, neutral cruise;
- biplanes standard (same as jets);
- biplanes and the bomber with wiring: up turns clockwise, down anticlockwise, right fast, left slow;
- wiring does not change tanks or jets;
- fire passes through.

`vehicles.test.ts`:

- spawn:
  - `game-1` (tanks on Sandbag Line): two tanks at (8, 20) and (56, 20), headings 0 and 8;
  - `game-19` (biplane pairs): four aircraft, ids 0–3, leaders at slot 0, spaced 4 apart on y;
  - `game-20`: one bomber against three biplanes;
  - a mismatched field throws.
- turning:
  - a press steps at once;
  - holding steps again after 0.3 s (not before);
  - releasing resets;
  - every step emits `turned`.
- driving:
  - a tank on an open field moves `TANK_SPEED * dt` per step;
  - with the stick down it stays still.
- walls:
  - driving into a wall stops and pushes the tank back from it;
  - `bumped` is set with a single `bumped` event over several steps;
  - after `WEDGED_SECONDS` of pushing it turns one step clockwise.
- tank on tank: driving into the other tank is blocked.
- aircraft:
  - constant flight;
  - speed eases towards fast and slow targets and never overshoots;
  - handicap lowers every tier (biplane by 1.25, jet by 2.5);
  - `fastAllowed: false` caps at cruise;
  - wrapping off every edge.
- `burnFuel`: burning, refilling, the caps.
- `muzzlePoint` for a tank and a biplane.
- `turnBy` wrapping.
- `shove`: a tank shoved into a wall stops short of it; an aircraft wraps.
- `circleTouchesWalls`: touching, clear, and a corner.
- inputs are not mutated.

## Out of scope

Shells, hits, scoring, the clock, visibility and the match state machine (another order); AI;
rendering. Do not edit `types.ts`, `rules.ts`, `vec.ts`, `walls.ts` or the arenas. If you need a
helper they lack, write it in your own file.

## Style

TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Intention-revealing
names (no single letters outside tiny loops), small functions, comments only where they explain why,
in plain words. No `any`, no non-null assertions, no commented-out code. Prettier: single quotes,
width 100, trailing commas. Import with `.ts` extensions.
