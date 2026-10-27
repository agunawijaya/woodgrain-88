---
id: tank-match
kind: engine
model: gemini-3.8-flash-high
fence:
  - games/tank-duel/src/engine/match.ts
  - games/tank-duel/src/engine/visibility.ts
  - games/tank-duel/tests/match.test.ts
  - games/tank-duel/tests/visibility.test.ts
acceptance:
  - pnpm exec vitest run --project tank-duel games/tank-duel/tests/match.test.ts games/tank-duel/tests/visibility.test.ts
  - pnpm exec eslint games/tank-duel/src/engine/match.ts games/tank-duel/src/engine/visibility.ts games/tank-duel/tests/match.test.ts games/tank-duel/tests/visibility.test.ts
  - pnpm exec prettier --check games/tank-duel/src/engine/match.ts games/tank-duel/src/engine/visibility.ts games/tank-duel/tests/match.test.ts games/tank-duel/tests/visibility.test.ts
  - pnpm exec tsc -p games/tank-duel/tsconfig.json
reads:
  - games/tank-duel/src/engine/types.ts
  - games/tank-duel/src/engine/rules.ts
  - games/tank-duel/src/engine/channels.ts
  - games/tank-duel/src/engine/vec.ts
  - games/tank-duel/src/engine/walls.ts
  - games/tank-duel/src/engine/shell.ts
  - games/tank-duel/src/engine/controls.ts
  - games/tank-duel/src/engine/vehicles.ts
  - games/tank-duel/src/arenas/format.ts
  - games/tank-duel/src/arenas/layouts.ts
  - games/tank-duel/src/arenas/skies.ts
  - games/tank-duel/tests/vehicles.test.ts
---

## Goal

The duel itself: one pure function that advances a whole match by one fixed step. It reads both
seats' sticks, moves every vehicle, fires and flies shells, scores hits, runs the 2.5-second spin
after a point, keeps the round clock and decides the winner, and reports everything that happened as
events (for drawing, sound and statistics). Plus the one rule of who can be seen. This round covers
the 27 original channels; the four Remix rules come in a follow-up round of this same order.

## Context

Read `types.ts` first: `MatchState`, `MatchOptions`, `MatchEvent`, `Freeze`, `StickInput`. Then:

- `rules.ts`: every number; never retype a value.
- `vehicles.ts`: `spawnVehicles`, `stepTank`, `stepAircraft`, `turnBy`, `shove`, `muzzlePoint`,
  `burnFuel`.
- `controls.ts`: `intentFor`.
- `shell.ts`: `fireShell`, `stepShell`, `canScore`.
- `walls.ts`: `buildWallEdges`, `pathHitsCircle`, `segmentBlocked`, `traceShot`.
- `channels.ts`: `CHANNELS`, `channelById`.

What 1977 did, and we keep:

- **Shots.** One shell per player in the air. Guided shells turn with the shooter's heading every
  step. Machine guns repeat while the button is held. A shell can never hit its own side.
- **Hits.** A hit scores one point, clears both shells, and starts a 2.52 s pause. During it nobody
  steers or fires, and the victim's side spins one heading step per original frame (50 a second). In
  the first 0.08 s the victim is also shoved along the shot. The clock keeps running.
- **The shooter's recoil.** On every scoring hit the shooter's vehicles twitch one step
  anticlockwise.
- **Billiard.** A shell scores only after bouncing; `canScore` has the 32-bounce wrap. A hit that
  cannot score is ignored, and the shell flies on through.
- **The clock.** A timed round lasts `ROUND_SECONDS`, with a warning at `WARNING_SECONDS` left; at
  0 the match is over. "First to 10" ends when a side reaches `FIRST_TO`, or at
  `FIRST_TO_LIMIT_SECONDS` on points.
- **Invisible channels.** A tank is unseen except while its shell is in the air, for a moment after
  it bumps something, and while its side is spinning after being hit.
- **Difficulty A** is a per-seat handicap: shorter shells (`HANDICAP_SHELL_LIFE`) and slower
  aircraft. Tanks drive at the same speed.

## Interface to implement

```ts
// games/tank-duel/src/engine/match.ts
import type { Arena, SkyDef } from '../arenas/format.ts';
import type { ShellRules } from './shell.ts';
import type {
  ChannelRules,
  MatchOptions,
  MatchState,
  MatchStep,
  Side,
  StickInput,
} from './types.ts';
import type { WallEdge } from './walls.ts';

/** What a match is played on, built once: the compiled arena or sky and its wall faces. */
export interface MatchWorld {
  readonly field: Arena | SkyDef;
  readonly edges: readonly WallEdge[];
}

/** Looks the channel's field up (ARENAS / SKIES by id), compiles arenas, builds wall faces (none for skies). */
export function createWorld(channel: ChannelRules): MatchWorld;

/** The shell rules a side fires with on this channel (switch A shortens normal shells, not machine guns). */
export function shellRulesFor(channel: ChannelRules, handicap: boolean): ShellRules;

export function createMatch(
  channel: ChannelRules,
  options: MatchOptions,
  world: MatchWorld,
): MatchState;

export function stepMatch(
  state: MatchState,
  inputs: readonly [StickInput, StickInput],
  dt: number,
  world: MatchWorld,
): MatchStep;
```

```ts
// games/tank-duel/src/engine/visibility.ts
import type { SkyDef } from '../arenas/format.ts';
import type { MatchState, VehicleState } from './types.ts';
import type { Vec2 } from './vec.ts';

/** Whether a vehicle can be seen right now (by the other player, a bot, or the renderer). */
export function isRevealed(state: MatchState, vehicle: VehicleState): boolean;

/** Whether a point is inside one of the sky's cloud banks (ellipses); always false for no clouds. */
export function insideCloud(point: Vec2, sky: SkyDef): boolean;
```

## Behaviour and edge cases

1. **createMatch** sets up the state:
   - vehicles from `spawnVehicles`;
   - `time` 0; scores [0, 0];
   - shells [null, null]; reload [0, 0]; fireHeld [false, false]; freeze null;
   - `fuel` full (`ACE_FUEL_SECONDS`) for both;
   - `radar` `{ next: BLACKOUT_SWEEP_EVERY, showing: 0 }`; `round` 1;
   - over false; winner null.

   `clock` is `ROUND_SECONDS` for timed scoring and Infinity for first to 10.

2. **shellRulesFor.**
   - Speed: `MACHINE_GUN_SPEED` for machine guns, else `SHELL_SPEED`.
   - Life: machine guns `MACHINE_GUN_LIFE` (no handicap). Others `SHELL_LIFE` (or
     `HANDICAP_SHELL_LIFE` with the handicap), times `BILLIARD_LIFE_FACTOR` in billiard channels or
     `BOUNCING_LIFE_FACTOR` in other bouncing channels.
   - `walls` and `billiard` from the channel; `bounceLifeRefresh` `BOUNCE_LIFE_REFRESH`.
   - Sky channels get `wrap: { width: 64, height: 40 }`.
3. **stepMatch order**, each step (`dt` is 1/60 in play; any positive dt must work):
   1. If `over`, return the same state and no events.
   2. Advance `time`.
   3. **Clock.**
      - Timed: lower `clock` by dt and emit `warning` once, on the step it crosses `WARNING_SECONDS`.
        At 0, the match is over: `winner` is the side with more points, null when level. Emit
        `match-over`, then return without moving anything.
      - First to 10: when `time` reaches `FIRST_TO_LIMIT_SECONDS`, end the same way.
   4. **Freeze.** While `freeze` is set:
      - Lower its `seconds`.
      - Spin every vehicle of the victim's side: add `SPIN_STEPS_PER_SECOND * dt` to `spinCarry`, turn
        by its whole part with `turnBy`, keep the fraction.
      - For the first `KNOCKBACK_SECONDS` of the freeze, `shove` each victim vehicle by
        `freeze.shove * KNOCKBACK_DISTANCE / KNOCKBACK_SECONDS * dt`.
      - Aircraft of both sides keep flying straight at their current speed and heading (wrapping).
        Tanks do not drive. No stick is read and nothing fires.
      - When seconds reach 0: freeze becomes null and emit `spin-over`.
      - Fire buttons still update `fireHeld`, so holding fire through the pause does not shoot the
        moment it ends.
      - Return after this (no shells fly during a freeze; there are none).
   5. **Vehicles.** For every vehicle:
      - Work out its intent with `intentFor(inputs[side], vehicle.vehicle, options.wiring)`. All
        members of a formation share their side's stick.
      - Tanks: `stepTank` with `others` = every other vehicle and the world's edges.
      - Aircraft: `stepAircraft` with `handicap` = `options.handicap[side]` and `fastAllowed` true.
      - Collect their events.
   6. **Firing**, per side, with that side's leader (slot 0):
      - A shell fires when the button is newly pressed (down now, `fireHeld` false). For machine guns
        it also fires while the button is held and `reload` is 0 or less.
      - Either way, only when that side has no shell in the air.
      - The shell starts at `muzzlePoint(leader)` along `headingVector(leader.heading)`, with
        `shellRulesFor(channel, options.handicap[side])`.
      - If the segment from the leader's centre to the muzzle crosses a wall (`segmentBlocked`), trace
        from the centre instead (`traceShot` with the channel's bounce rule, over the muzzle reach):
        - stop walls: the shell is gone at once (emit `fired` then `shell-gone` with reason
          `'wall'`);
        - bouncing walls: the shell starts at the trace's end, in its final direction, with its
          bounces counted.
      - Emit `fired`.
      - Machine guns set `reload` to `MACHINE_GUN_INTERVAL`. `reload` counts down every step;
        `fireHeld` becomes the button's state.
   7. **Shells.** Step each live shell with `stepShell`. Guided shells pass
      `steer = headingVector(leader.heading)`.
      - Each bounce emits `bounced`, with the running bounce count and `corner` for corner hits.
      - A shell that ends emits `shell-gone`: `'wall'` when it stopped at a wall, else `'expired'`.
   8. **Hits.** For each side's shell that moved this step (side 0 first), test its `travelled`
      polyline against each vehicle of the other side with `pathHitsCircle` and the vehicle's
      radius.
      - In skies, also test the 8 wrapped copies of the vehicle (±64, ±40), so hits across the wrap
        count.
      - The first contact (smallest distance along the path) decides. If `canScore` says no, ignore
        it and the shell flies on.
      - If it scores:
        - add 1 point to the shooter;
        - turn every vehicle of the shooter's side by -1 (emit `turned` for each);
        - clear both shells (emit `shell-gone` with `'cleared'` for the other side's shell if there
          is one);
        - start the freeze with `seconds: SPIN_SECONDS`, the victim, `shove` = the shell's
          direction and `spinCarry: 0`;
        - emit `hit` with the vehicle id, contact point, direction, bounces, points 1, and
          `path` = the shell's path plus the contact point.
      - At most one scoring hit per step.
      - With first to 10, reaching `FIRST_TO` ends the match at once (`over`, `winner`,
        `match-over`). The freeze is still set, so a renderer can play the last spin.
   9. Return the new state and the events in the order they happened.
4. **isRevealed.**
   - Always true for aircraft and in channels that are not invisible.
   - Otherwise true when the vehicle's side has a shell in the air, when its `bumped` is above 0, or
     when a freeze is set with its side as the victim.
   - Otherwise false.
   - (Blackout's radar comes in the next round; leave a clear place for it.)
5. **insideCloud**: the point is inside an ellipse `((x - cx) / rx)² + ((y - cy) / ry)² <= 1` of any
   cloud bank, tested the short way round the wrap too.
6. Determinism: the same state, inputs and dt give the same result. No randomness, never mutate
   inputs, return new objects.

## Tests required

`match.test.ts`. Drive matches with scripted sticks. Use helpers like `run(state, inputs, seconds)`,
and place vehicles by building a state with spread copies for the precise scenes.

- **Setup.** `createMatch` on `game-1`, `game-19` and `game-20`: vehicle counts, clocks for both
  scoring rules.
- **Shell rules.**
  - normal, handicap (0.72), bouncing (×2), billiard (×4);
  - machine gun ignores the handicap;
  - skies wrap.
- **One shell at a time.** Pressing fire again while a shell flies does nothing; after it expires a
  new press fires.
- **Fire is a press.** Holding fire fires once (normal shells). A machine gun repeats every
  `MACHINE_GUN_INTERVAL` while held.
- **Guided.** Turning after firing bends the shell's direction; a straight shell keeps its line.
- **A scoring hit**, with two tanks facing each other on the Open Field (`game-5`):
  - one point;
  - `hit` event with the path;
  - both shells cleared;
  - the shooter turned by -1 step;
  - a freeze of `SPIN_SECONDS`.

  During the freeze:
  - nobody moves or fires;
  - the victim's heading changes about 50 steps per second;
  - the victim is shoved along the shot early on and then stops moving;
  - the clock still runs.

  `spin-over` fires at the end.

- **No friendly fire.** A bouncing shell coming back through its own tank does not hit it.
- **Billiard** (`game-8` or a built scene): a direct hit is ignored and the shell flies through; a
  banked hit scores.
- **Clock.**
  - a timed match ends after `ROUND_SECONDS`, with the winner on points;
  - `warning` comes once, at 20.48 s left;
  - a level score is a draw (`winner` null);
  - after `over`, steps change nothing.
- **First to 10.** Script ten hits (or build a state at 9) and the tenth ends the match at once.
- **Handicap.** Side 0's shell on switch A dies after 0.72 s, side 1's after 1.14 s.
- **Cartridge wiring.** On `game-15` with wiring, stick y turns side 0's biplane; without wiring, x
  does.
- **Formation.** On `game-19`, a hit on side 1's second plane scores for side 0. Both side-1 planes
  spin in the freeze.
- **Wrap.** A shell crossing the sky's edge still hits a plane on the other side of the wrap.
- **Muzzle in a wall.** A tank nosed into a wall: on a stop channel the shell is gone at once (with a
  `shell-gone` event); on a bouncing channel it starts reflected.
- **Determinism.** Two runs with the same scripted inputs give identical states.

`visibility.test.ts`:

- On `game-10`, a tank is unseen at the start. It is revealed while its shell flies, after a bump
  for `BUMP_REVEAL_SECONDS`, and while spinning after a hit.
- On a visible channel and on any aircraft it is always revealed.
- `insideCloud`: inside, outside, and across the wrap edge.

## Out of scope

The Remix rules (next round), AI, rendering, sound, the kit loop. Do not edit `types.ts`, `rules.ts`,
`vehicles.ts` or other existing engine files. If something there blocks you, say so in your report.

## Style

TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Intention-revealing
names, small functions (split `stepMatch` into one function per stage above), comments only where
they explain why, in plain words. No `any`, no non-null assertions, no commented-out code. Prettier:
single quotes, width 100, trailing commas. Import with `.ts` extensions.
