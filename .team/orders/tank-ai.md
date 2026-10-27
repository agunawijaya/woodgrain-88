---
id: tank-ai
kind: ai
model: gemini-3.8-flash-high
fence:
  - games/tank-duel/src/ai/perception.ts
  - games/tank-duel/src/ai/navigation.ts
  - games/tank-duel/src/ai/commander.ts
  - games/tank-duel/src/ai/personality.ts
  - games/tank-duel/tests/perception.test.ts
  - games/tank-duel/tests/navigation.test.ts
  - games/tank-duel/tests/commander.test.ts
acceptance:
  - pnpm exec vitest run --project tank-duel games/tank-duel/tests/perception.test.ts games/tank-duel/tests/navigation.test.ts games/tank-duel/tests/commander.test.ts
  - pnpm exec eslint games/tank-duel/src/ai games/tank-duel/tests/perception.test.ts games/tank-duel/tests/navigation.test.ts games/tank-duel/tests/commander.test.ts
  - pnpm exec prettier --check games/tank-duel/src/ai games/tank-duel/tests/perception.test.ts games/tank-duel/tests/navigation.test.ts games/tank-duel/tests/commander.test.ts
  - pnpm exec tsc -p games/tank-duel/tsconfig.json
reads:
  - games/tank-duel/src/engine/types.ts
  - games/tank-duel/src/engine/rules.ts
  - games/tank-duel/src/engine/match.ts
  - games/tank-duel/src/engine/visibility.ts
  - games/tank-duel/src/engine/vehicles.ts
  - games/tank-duel/src/engine/controls.ts
  - games/tank-duel/src/engine/shell.ts
  - games/tank-duel/src/engine/walls.ts
  - games/tank-duel/src/engine/vec.ts
  - games/tank-duel/src/ai/aim.ts
  - games/tank-duel/src/arenas/format.ts
  - packages/kit/src/kids.ts
  - packages/kit/src/rng.ts
---

## Goal

The Neighbourhood Kids as tank commanders and pilots. They share one AI that plays fair and gets
its character from personality. It sees only what a player sees, gets the same handicaps, and
produces stick input exactly like a person's.

- It aims with real bank-shot geometry (`aim.ts`), leads moving targets, curls guided shells round
  corners, dodges incoming fire, uses cover, and finds its way round mazes.
- It flies aircraft, which never stop: it uses speed, turns, and clouds to hide in.
- Personality changes choices, timing and mistakes, never information.

## Context

- A match advances with `stepMatch(state, [stick0, stick1], dt, world)` (`engine/match.ts`). A
  commander is asked once per step for its side's `StickInput` (x left/right, y down/up, fire). It
  does not need to call `intentFor`; give the stick a person would. For tanks: x turns (+1 =
  clockwise), y up drives. For aircraft: x turns, y up fast, y down slow. Assume wiring is off
  (bots are never on the cartridge wiring).
- Fair play: perceive the opponent only through `isRevealed` (and, in skies, not when
  `insideCloud`). When it is hidden, use the last position and time it was seen. Shells are always
  visible.
- Kid parameters: `aiSettings(kidId, ranges)` from `@woodgrain-88/kit` (`reactionMs`, `errorRate`,
  `risk`, `randomness`, `deception`, `memory`, `mirror`, `swing`). Use `errorRateForRound` for hot
  and cold spells (draw once per point). Also use the raw `KidPersonality` (`kidById(id).personality`)
  for aggression, caution, patience, deception and adaptivity. Randomness only through the kit
  `Rng` passed in (`createRng(seed).fork('ai/<kid>')` by the caller).
- The six characters, as the game describes them:
  - **Dee** rushes, fires early, chases.
  - **Moss** holds cover, waits for clean shots, and backs off when the angles are bad.
  - **Pip** takes erratic routes and throws wild guided curls, with the odd genius bank.
  - **Grandpa Lou** turns slowly but aims nearly perfectly, banks included.
  - **Rosa** baits with curved guided shots, feints direction changes, and ambushes from cover.
  - **Benny** learns the player's habits over the match (favourite lanes, turn direction) and
    mirrors them or cuts them off.

## Interface to implement

```ts
// games/tank-duel/src/ai/perception.ts
import type { MatchState, Side, VehicleState } from '../engine/types.ts';
import type { MatchWorld } from '../engine/match.ts';
import type { Vec2 } from '../engine/vec.ts';

export interface Sighting {
  readonly id: number;
  readonly position: Vec2;
  /** Estimated from the last two sightings; zero when only seen once. */
  readonly velocity: Vec2;
  readonly heading: number;
  /** Match time when it was last seen. */
  readonly seenAt: number;
  /** Whether it is in view this step. */
  readonly visible: boolean;
}

export interface Picture {
  readonly own: readonly VehicleState[];
  readonly enemies: readonly Sighting[];
}

/** Remembers what one side has seen of the other; feed it every step. */
export interface Lookout {
  observe(state: MatchState, world: MatchWorld): Picture;
}

export function createLookout(side: Side): Lookout;
```

```ts
// games/tank-duel/src/ai/navigation.ts
import type { Arena } from '../arenas/format.ts';
import type { Vec2 } from '../engine/vec.ts';

/** Routes over the arena's tank footprints (2 × 2 cells of open floor, as the validator uses). */
export interface Navigator {
  /** Waypoints (cell-footprint centres) from `from` to the footprint nearest `to`; empty when unreachable. */
  route(from: Vec2, to: Vec2): Vec2[];
  /** Footprint centres with no straight line of sight to `threat` (walls between): cover spots. */
  coverFrom(threat: Vec2): Vec2[];
  /** Whether a footprint centre exists near this point (within one cell). */
  walkable(point: Vec2): boolean;
}

export function createNavigator(arena: Arena): Navigator;
```

```ts
// games/tank-duel/src/ai/personality.ts
import type { KidId } from '@woodgrain-88/kit';

/** How a kid plays Tank Duel, worked out from the kit personality and settings. */
export interface DuelStyle {
  readonly kid: KidId;
  /** Seconds between fresh decisions (reaction). */
  readonly thinkEvery: number;
  /** Chance a decision's chosen heading is one step off. */
  readonly misjudge: number;
  /** How far off a plan may be and still be fired (aim slack, units). */
  readonly slack: number;
  /** Most bounces it plans (0 direct only, up to 2). */
  readonly bankDepth: number;
  /** 0–1: how keen it is to close in rather than hold position. */
  readonly push: number;
  /** 0–1: how readily it breaks off to dodge and take cover. */
  readonly care: number;
  /** 0–1: chance per decision to wander to a random spot (Pip). */
  readonly wander: number;
  /** 0–1: chance to fire a baiting guided shot away from the target and curl it in (Rosa). */
  readonly bait: number;
  /** Learns the opponent's habits (Benny). */
  readonly learns: boolean;
  /** Turns ease a step later than needed: slow, deliberate turning (Lou). */
  readonly turnLag: number;
}

export function duelStyle(kid: KidId): DuelStyle;
```

```ts
// games/tank-duel/src/ai/commander.ts
import type { KidId, Rng } from '@woodgrain-88/kit';
import type { MatchWorld } from '../engine/match.ts';
import type { ChannelRules, MatchState, Side, StickInput } from '../engine/types.ts';

export interface Commander {
  readonly kid: KidId;
  /** The stick for this step. Call once per step with the state before stepping. */
  think(state: MatchState, world: MatchWorld, dt: number): StickInput;
}

export function createCommander(
  kid: KidId,
  side: Side,
  channel: ChannelRules,
  world: MatchWorld,
  rng: Rng,
): Commander;
```

## Behaviour and edge cases

1. **Perception.**
   - Each step, for every enemy vehicle, check whether it is visible: `isRevealed`, and in skies not
     `insideCloud`.
   - Visible: record position, heading and time, and estimate velocity from the previous sighting
     (only if it was the step before; else zero).
   - Hidden: keep the last sighting with `visible: false` (unseen at the start: the spawn position,
     time 0).
   - A commander must never read a hidden enemy's real position. A test checks this: a hidden enemy
     that moves does not change the picture.
2. **Navigation.**
   - Footprints are 2 × 2 cells of non-solid floor; neighbours are one cell up, down, left or right.
   - `route` runs a breadth-first search, then trims to the corners where direction changes (plus the
     final point). Waypoints are footprint centres in world units.
   - `coverFrom` returns footprints whose centre has no line of sight to the threat
     (`segmentBlocked` with the arena's wall edges).
   - Precompute the footprint grid once.
3. **Personality mapping** (`duelStyle`). Use `aiSettings(kid, { reactionMs: [700, 180], errorRate:
[0.02, 0.4] })`.
   - `thinkEvery`: `reactionMs / 1000`.
   - `misjudge`: `errorRate * 0.6`.
   - `slack`: `0.2 + aggression * 1.4 - patience * 0.4`, at least 0.
   - `bankDepth`: 2 when the kid's error is at most 0.1 (Lou) or for Pip (genius banks, rarely
     taken); otherwise 1. Pip only uses bank depth 2 on 1 decision in 6 (rng).
   - `push`: aggression. `care`: caution. `wander`: `randomness * 0.25`. `bait`: `deception * 0.5`.
   - `learns`: `mirror` or adaptivity > 0.9.
   - `turnLag`: 0.15 s when reaction < 0.3 (Lou), else 0.
   - Document each line with its reason in one short comment.
4. **The decision loop** (`think`):
   - Observe every step.
   - Make a fresh decision only every `thinkEvery` seconds (jittered ±20% with the rng), and
     immediately when an enemy shell becomes a threat. Between decisions, keep steering towards the
     last chosen heading and keep driving or firing as decided.
   - Turning: turn towards the desired heading by the shortest way (`turnSteps`); release the stick
     when the heading matches. With `turnLag`, hold the release a little late so it may overshoot a
     step and correct.
   - Fire only when the own side has no shell in the air and the current heading equals the planned
     heading. Release fire for at least one step between shots (fire is a press).
   - During a freeze, return no input.
5. **Tank decisions**, in priority order:
   1. **Dodge.** If `incomingThreat` from the enemy shell says `miss <= 0.6` within 0.8 s:
      - with probability `0.3 + care * 0.7`, turn a quarter (4 steps) away from the shell's line and
        drive;
      - Dee often ignores it (her `care` is low).
   2. **Steer a guided shell** in flight:
      - aim its line at the enemy's led position by turning towards the bearing (`turnSteps`);
      - with `bait`, first curl it wide (hold the turn one extra step) before bringing it in;
      - keep the tank still unless the enemy is closing.
   3. **Shoot.** Plan with `planShots` from the leader's position (`muzzleReach` = `TANK_MUZZLE`),
      using the channel's shell rules (`shellRulesFor` with the bot's own handicap: assume switch B;
      the caller may pass handicap later) and `maxBounces = bankDepth`.
      - Choose `bestShot` with `minBounces: 1` in billiard channels, and `slack`.
      - On a `misjudge` draw, shift the chosen heading by ±1.
      - On a `randomness` draw, take the second-best plan if there is one.
      - A patient kid (patience > 0.6) only fires when `time` is under 0.9 s or the plan banks.
   4. **Move.** Otherwise:
      - choose a goal: with `push`, the enemy's (last seen) position; with `care`, the nearest cover
        spot from the enemy that still sees a lane towards it (a cover spot with a bank or direct
        plan to the enemy's last position); with `wander`, a random walkable spot;
      - for Benny, the spot where the opponent was seen most often in the last `memory` points,
        approached from the side the opponent turns away from most;
      - route there with `navigation.route` and drive along the waypoints (turn to the waypoint's
        heading step, drive when within one step of it);
      - re-route when the goal changes or every 2 s.
6. **Aircraft decisions:**
   - Always flying.
   - **Shoot:** plan with wrap (no walls, `maxBounces: 0`) and turn to the plan's heading; fire when
     lined up.
   - **Move:** aggressive kids go fast (y up) when far away (> 25 units) and slow (y down) when close
     and behind the enemy. Cautious kids head for the nearest cloud when the enemy is lined up on
     them and they are not.
   - Machine guns: hold fire while lined up within one step.
   - Formations share one stick: plan from the leader.
7. **Benny's learning:**
   - Count, per point, where the opponent spends time (a 4 × 3 grid of zones) and which way it
     turns.
   - Keep only the last `memory` points.
   - Used as in 5.4. With no memory yet, play like a balanced kid.
8. **Determinism.** The same kid, seed, channel and match history give the same sticks. All
   randomness comes from the given `Rng`.
9. **Performance.** `planShots` at most once per decision. Navigation is precomputed. Thinking must
   stay under 0.3 ms per step on average for one commander (a test measures 600 steps loosely, under
   1 s total).

## Tests required

- `perception.test.ts`:
  - a visible enemy is seen with its velocity;
  - on an invisible channel a hidden enemy keeps its last sighting;
  - moving the hidden enemy does not change the picture (the fair-play test);
  - in a sky, a plane inside a cloud is not seen.
- `navigation.test.ts`:
  - routes on Old Quarter between the spawns exist, and every waypoint is walkable;
  - an unreachable goal gives the nearest footprint's route or empty, as documented;
  - `coverFrom` spots have no line of sight to the threat.
- `commander.test.ts`:
  - on the Open Field with the enemy straight ahead (`game-5`), every kid eventually fires and Lou's
    shot hits;
  - on Sandbag Line with the enemy behind the central wall and billiard rules (`game-8`), Lou finds a
    bank (fires on a heading whose plan has 1+ bounces);
  - a bot never fires while its shell is in the air;
  - a bot dodges a shell aimed at it more often when it is Moss than when it is Dee (run 20 seeded
    trials each);
  - in a sky channel a bot never stops (y is never forced to make speed zero; it just flies);
  - no input during a freeze;
  - determinism: the same seed gives the same sticks over 600 steps;
  - thinking time stays under the budget.

## Out of scope

Simulations and balance tuning (the next order), rendering, sound, the kit loop. Do not edit engine
files. If a rule blocks you, report it instead.

## Style

TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Intention-revealing
names, small functions, comments only where they explain why, in plain words. No `any`, no non-null
assertions, no commented-out code. Prettier: single quotes, width 100, trailing commas. Import with
`.ts` extensions; kit imports from `@woodgrain-88/kit`.
