---
id: gd-match
kind: engine
member: deepseek-pro
fence:
  - games/gravity-duel/src/engine/match.ts
  - games/gravity-duel/tests/match-setup.test.ts
  - games/gravity-duel/tests/match-combat.test.ts
  - games/gravity-duel/tests/match-docking.test.ts
  - games/gravity-duel/tests/helpers.ts
acceptance:
  - pnpm exec vitest run --root games/gravity-duel tests/match-setup.test.ts tests/match-combat.test.ts tests/match-docking.test.ts
  - pnpm exec eslint games/gravity-duel/src/engine/match.ts games/gravity-duel/tests
  - pnpm exec prettier --check games/gravity-duel/src/engine/match.ts games/gravity-duel/tests
  - pnpm exec tsc -p games/gravity-duel/tsconfig.json
reads:
  - games/gravity-duel/src/engine/types.ts
  - games/gravity-duel/src/engine/physics.ts
  - games/gravity-duel/src/engine/variations.ts
  - games/gravity-duel/docs/NOTES.md
  - games/gravity-duel/tests/physics.test.ts
  - research/dossiers/16-gravity-duel.md
---

## Goal

Build Gravity Duel's match rules: `games/gravity-duel/src/engine/match.ts`, which creates a match
and advances it one 20 ms tick at a time. It covers firing, hits and spins, the cloak and its
fuel, the star, the starbase, mutual reload, docking, scoring and the clock, exactly as specified
below. Write the tests first, in the three test files, with shared builders in `tests/helpers.ts`.

## Context

- `docs/NOTES.md` is the verified behaviour (read all of Verified behaviour and Engine decisions).
  Where the dossier differs, NOTES.md wins: in particular, **a cloaked ship cannot turn, thrust or
  fire, and nothing it or its missile touches counts while it is cloaked**.
- `src/engine/types.ts` has every shape and constant; `src/engine/physics.ts` has the physics
  (fold, thrust, turning, fuel burns, gravity, moving, touching). Use them; do not change either
  file, and do not reimplement what physics.ts already does.
- `src/engine/variations.ts` gives each cartridge variation's rules (`variation(n)`).
- Seeded randomness only through `match.random` (kit `createRng(setup.seed).fork('pods')`); no
  `Math.random`, no wall clock.

## Interface to implement

```ts
import type { Controls, Match, MatchSetup, Seat } from './types.ts';

/** Where each seat starts, and where the star and the starbase send it back to. */
export const START_SPOTS: readonly [
  { readonly x: number; readonly y: number; readonly heading: number },
  { readonly x: number; readonly y: number; readonly heading: number },
];

export function createMatch(setup: MatchSetup): Match;

/** Advances the match one tick with each seat's controls (seat 1's are ignored in solo). */
export function stepMatch(match: Match, controls: readonly [Controls, Controls]): void;

/** The other seat. */
export function rival(seat: Seat): Seat;
```

`START_SPOTS` are seat 0 at (30 × 256, 20 × 256) heading 0, seat 1 at (130 × 256, 70 × 256)
heading 8.

## Behaviour and edge cases

**Creating** (`createMatch`):

1. Ships at their start spots, at rest, with `prev` equal to the position, `wrapped` false,
   `turnWait` 0, `burnsLeft = BURNS_PER_SEGMENT − 1`, `cloaked`/`cloakHeld` false, `spin` 0,
   `thrusting` false, `dockCooldown` 0 and `score` 0.
   - In a duel, `fuel = FUEL_SEGMENTS` and `ammo = AMMO_SEGMENTS`; in docking both are 0 (unused).
   - Seat 1 has `present: false` in solo; it never moves, acts, scores or is touched.
2. **Shots in a duel:** not live, `life` 0, `age` 0, `turned` 0, sitting on their ship.
3. **Shots in docking:**
   - pod 0 is live at (seat 0's x, `CENTRE_Y`) with a random velocity;
   - with `pods: 'own'`, pod 1 is live at (seat 1's x, `CENTRE_Y`) with pod 0's velocity mirrored
     horizontally (`vx` negated);
   - otherwise pod 1 is not live.
4. **A random pod velocity**, x then y: whole units `random.int(2, 14)`, negated when
   `random.chance(0.5)`, times 256.
5. `tick` 0, `clockLeft = setup.clockTicks`, phase 'playing', `winner` null, `events` empty.

**A tick** (`stepMatch`), in this order. Clear `events` first. If the phase is 'over', only
steps 5 (move) and 6 (gravity) run: the field keeps drifting. Otherwise:

1. `tick += 1`.
2. For seat 0 then seat 1 (present ships only), all of a) to f):

   a. **Cloak burn.** If cloaked and `tick % THRUST_EVERY === 0`, call `burnFuel`. If that emptied
   the tank: **burnout** (see Burnout below).

   b. **Cloak toggle** (only when the rules allow the cloak):
   - The stick is _pulled on its own_ when `cloak` is held and `left`, `right` and `thrust` are
     not.
   - Pulled on its own and `cloakHeld` false: flip `cloaked`, set `cloakHeld` true and emit
     `cloak` with the new state. If it just turned on, call `dropSegment`, and if that emptied
     the tank, burnout.
   - Pulled on its own and `cloakHeld` true: nothing.
   - Not pulled on its own: `cloakHeld = false`.

   c. If the ship is cloaked now, skip d) to f) for this seat.

   d. **Fire** (duels only):
   - Needs `fire` held, the seat's shot `life === 0` and `ammo > 0`. Then `ammo −= 1`.
   - The shot goes live: `life = MISSILE_LIFE`, `age` 0, `turned` 0, position and `prev` the
     ship's, `wrapped` false.
   - Its velocity per axis is `(speedUnits(ship.v) + muzzleVelocity(heading)) × 256`: the
     ship's fraction is dropped and nothing is folded here (the fold happens when it moves).
   - Emit `fired`. Holding fire keeps firing as soon as the countdown allows.

   e. `turnShip`, then `thrustShip(ship, controls, tick, mode !== 'duel')`; emit `fuel-out` if it
   says so.

   f. **Touches**, on the current positions (the middle is a body at (`CENTRE_X`, `CENTRE_Y`)).
   The rival only counts when present and not cloaked. Handle at most one per seat per tick,
   the first that applies in this order:

   **Duel:**
   1. **Missile hits the rival:** own shot live and `touching(shot, rival, MISSILE_RADIUS,
SHIP_RADIUS)`. The shot is no longer live. If the rival is not spinning, it starts
      spinning (`spin = SPIN_TICKS`), this seat scores (see Scoring), and `hit` is emitted with
      `turned` from the shot. A hit on a spinning rival only removes the missile.
   2. **Self-touch:** own shot live, `age >= SELF_HIT_GRACE` and `touching(shot, ship,
MISSILE_RADIUS, SHIP_RADIUS)`. The shot is no longer live. On this seat's switch 'A' the
      ship explodes (see Explode); emit `self-hit` with `exploded` (true only on 'A').
   3. **Ship touches the middle**, when it is a star or a starbase (`touching(ship, middle,
SHIP_RADIUS, CENTRE_RADIUS)`):
      - **star:** the ship goes back to its start spot at rest (see Restart), explodes, and
        `star-crash` is emitted;
      - **starbase:** first record `speed = |speedUnits(vx)| + |speedUnits(vy)|`, then send it
        back to its start spot at rest, refill `fuel` and `ammo` to full, and emit `refuelled`
        with that speed. It never explodes, however fast it came in. Put a short comment here
        on the cartridge's speed check that could never fire, because the velocity was zeroed
        first.
   4. **Missile meets the middle** (star or starbase): own shot live and `touching(shot,
middle, MISSILE_RADIUS, CENTRE_RADIUS)`. The shot is no longer live; emit `swallowed`.

   **Docking** (race and solo):
   - The seat's pod is pod `seat` with `pods: 'own'`, else pod 0.
   - It docks when the pod is live, `dockCooldown === 0`, `touching(ship, pod, SHIP_RADIUS,
POD_RADIUS)`, and `speedDifference(ship, pod)` is ≤ 1 on this seat's switch 'A' or < 16
     on 'B'.
   - Then: this seat scores, the pod gets a fresh random velocity (Creating, item 4) and stays where it
     is, `dockCooldown = DOCK_COOLDOWN`, and `docked` is emitted with the pod's index.

3. **Countdowns.**
   - **Duel**, for each shot with `life > 0`: `life −= 1` and `age += 1`. When `life` reaches 0,
     the shot is no longer live. If at that moment both ships have `ammo === 0`, both refill to
     `AMMO_SEGMENTS`; emit `reload`.
   - **Docking:** `dockCooldown −= 1` while above 0.
4. **Spins.** Each present ship with `spin > 0`: `spin −= 1` and the heading steps +1 (mod 16).
5. **Move.**
   - Each present ship: `moveBody(ship, edges, SHIP_RADIUS)`.
   - Each live shot: `moveBody(shot, edges, MISSILE_RADIUS in a duel, POD_RADIUS in docking)`.
6. **Gravity**, only when the rules have gravity:
   - `gravityTurn(tick)` picks body 0 (ship 0), 1 (ship 1), 2 (shot 0) or 3 (shot 1); skip it if
     it is an absent ship or a shot that is not live.
   - Add `gravityPull(CENTRE_X − x, CENTRE_Y − y)` to its velocity.
   - For a live missile in a duel, also add to `turned` the signed change of its direction of
     travel caused by this pull: `atan2(−vy, vx)` after minus before, wrapped into (−π, π].
     Counter-clockwise is positive; y runs down, hence `−vy`.
7. **Clock** (playing only):
   - `clockLeft −= 1`;
   - emit `clock-warning` on the tick it reaches `CLOCK_WARNING_TICKS`;
   - at 0 the match is over with reason 'clock'.

**Used above:**

- **Burnout:**
  - the ship explodes (see Explode);
  - it is uncloaked with `cloakHeld = true` (it must let go before cloaking again);
  - emit `cloak-burnout`;
  - it then carries on with the rest of its turn this tick, uncloaked.
- **Scoring:** `score += 1` and emit `scored` with the new score. After step 2 of the tick (both
  seats done), if any present ship has reached `setup.target`, the match is over with reason
  'target'. The winner is the higher score, or null if both reached it on the same tick.
- **Explode:** if the ship is not already spinning, it starts spinning and the rival scores.
  Already spinning: nothing more.
- **Restart:**
  - position = its `START_SPOTS` entry and `prev` the same;
  - velocity 0, `wrapped` false;
  - the heading is kept.
- **Over:**
  - phase 'over';
  - `winner` is the seat with the higher score, null on a tie, and always null in solo;
  - emit `over` with the winner and the reason.

Keep functions short and named for what they do (`fire`, `touchesInDuel`, `dock`,
`countDown`, `applyGravity`, `explode`, `restart`, …). Give the module a header comment, and
comment _why_ where the cartridge is surprising (the cloak killing the controls, the dead speed
check, mutual reload, the missile countdown running on after a hit).

## Tests required

`tests/helpers.ts`:

- `setupFor(variationNumber, overrides?)`: target 10, cartridge clock, switches B/B, seed 1;
- `controls(partial)`: IDLE with overrides;
- `runTicks(match, n, seat0?, seat1?)`;
- a way to place a body at a given step position and velocity.

Tests put bodies where they need them instead of flying them there. One `it` per behaviour:

- **match-setup:** start spots and headings; full fuel and ammo in duels, none in docking;
  seat 1 absent in solo; pods for 'own', 'shared' and solo; pod velocities within 2–14 units per
  axis, never zero; pod 1 mirrors pod 0; the same seed gives the same pods; a different seed
  usually does not; the clock starts full.
- **match-combat:**
  - firing needs a ready missile and ammo, and spends one segment;
  - holding fire refires exactly every 128 ticks;
  - a missile starts with the ship's whole units plus the muzzle;
  - a hit scores, spins the victim 64 ticks one step a tick, and play goes on;
  - a spinning victim cannot be scored on again, though the missile is still removed;
  - a spinning ship can still thrust and fire;
  - a hit does not reload early: the next shot waits for the full 128 ticks;
  - ships pass through each other;
  - self-touch is ignored for 8 ticks, then on 'A' explodes and scores for the rival, and on 'B'
    only removes the missile;
  - the star swallows missiles;
  - a ship touching the star restarts at rest, explodes, and the rival scores;
  - a cloaked ship passes through the star;
  - the starbase refuels and rearms, restarts at rest, and never explodes even at top speed,
    reporting the speed it came in at;
  - the starbase swallows missiles;
  - mutual reload: an empty ship stays empty while the rival has missiles, and both refill when
    a missile ends with both empty;
  - the cloak toggles only when pulled on its own and must be let go between toggles;
  - cloaking costs a segment at once, then burns every fourth tick from the thrust counter;
  - cloaking with the last segment, or burning it while cloaked, blows the ship up and the rival
    scores, leaving it uncloaked;
  - thrust burning the last segment is safe;
  - a cloaked ship cannot turn, thrust or fire;
  - while its ship is cloaked a missile cannot hit or be swallowed, and it can again after
    uncloaking;
  - the cloak does nothing in variations 1 and 8–17;
  - gravity pulls only in gravity variations, each body once every 8 ticks;
  - a missile curving round the star accumulates `turned`, with sign;
  - edges follow the variation for ships and missiles;
  - reaching the target ends the match at once, with a winner;
  - the clock warns at 1,024 ticks left and ends the match at 0, the higher score winning or a
    draw;
  - after the end only drifting happens;
  - the same setup and inputs give an identical match after 5,000 ticks of scripted play (compare
    ships, shots, scores and tick).
- **match-docking:**
  - a dock needs a touch and matched speeds: under 16 on 'B', at most 1 on 'A';
  - a dock scores, re-aims the pod where it is, and blocks that ship for 128 ticks;
  - with own pods, seat 1 cannot dock with pod 0 nor seat 0 with pod 1;
  - with a shared pod, both seats can dock with pod 0;
  - in solo only seat 0 plays;
  - thrust never runs out in docking;
  - the beacon pulls ships and pods but harms nothing;
  - no firing or cloaking in docking.

## Out of scope

- Remix rules, the Kids, sessions, input mapping, rendering, sound: later orders.
- Do not change `types.ts`, `physics.ts`, `variations.ts`, `NOTES.md` or any file outside the
  fence. If the interface or a rule looks wrong, say so in your report.
