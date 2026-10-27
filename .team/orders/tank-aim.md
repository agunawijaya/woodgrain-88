---
id: tank-aim
kind: ai
model: gemini-3.8-flash-high
fence:
  - games/tank-duel/src/ai/aim.ts
  - games/tank-duel/tests/aim.test.ts
acceptance:
  - pnpm exec vitest run --project tank-duel games/tank-duel/tests/aim.test.ts
  - pnpm exec eslint games/tank-duel/src/ai/aim.ts games/tank-duel/tests/aim.test.ts
  - pnpm exec prettier --check games/tank-duel/src/ai/aim.ts games/tank-duel/tests/aim.test.ts
  - pnpm exec tsc -p games/tank-duel/tsconfig.json
reads:
  - games/tank-duel/src/engine/vec.ts
  - games/tank-duel/src/engine/walls.ts
  - games/tank-duel/src/engine/shell.ts
  - games/tank-duel/src/engine/rules.ts
  - games/tank-duel/src/arenas/format.ts
  - games/tank-duel/src/arenas/layouts.ts
  - games/tank-duel/tests/walls.test.ts
---

## Goal

The aiming brain the Neighbourhood Kids share. It answers one question for every heading a vehicle can
face: "if I fired now, where would my shell go, and would it meet my opponent?". The shell is traced
against the walls with real bounces, respecting the shell's life (and the life a bounce gives back),
and the target is led by its velocity. It also tells a bot when an enemy shell is about to reach it.
Pure geometry, no randomness. Personality (hesitation, misjudgement, preferring banks) is applied by
the AI later; this module is exact.

## Context

- Shells fly in straight lines at `speed` and bounce off wall faces (`walls.ts` `traceShot`: a `face`
  hit reflects with `reflect` from `vec.ts`, a `corner` hit reverses). A shell lives `life` seconds;
  each bounce resets its remaining life to `life * bounceLifeRefresh`. With `walls: 'stop'` the first
  wall ends it. In billiard channels a hit only counts after at least one bounce.
- Vehicles turn in 16 heading steps (`headingVector`). Shells start at the muzzle,
  `origin + headingVector(h) * muzzleReach`.
- Aircraft channels have no walls and wrap at the sky's edges (64 × 40): there, distances to the
  target are measured the short way round.

## Interface to implement

```ts
// games/tank-duel/src/ai/aim.ts
import type { Vec2 } from '../engine/vec.ts';
import type { WallEdge } from '../engine/walls.ts';
import type { Shell, ShellRules } from '../engine/shell.ts';

export interface ShotModel {
  readonly speed: number;
  readonly life: number;
  readonly walls: 'stop' | 'bounce';
  readonly billiard: boolean;
  readonly bounceLifeRefresh: number;
  /** The most bounces the planner follows before giving up on a shot. */
  readonly maxBounces: number;
  /** Set for skies: the board wraps at width × height. */
  readonly wrap?: { readonly width: number; readonly height: number };
}

export interface AimTarget {
  readonly position: Vec2;
  /** Units per second; the planner leads the target along it. */
  readonly velocity: Vec2;
  readonly radius: number;
}

export interface ShotPlan {
  readonly heading: number;
  /** Bounces before the shell reaches the target (or before it dies, for a miss). */
  readonly bounces: number;
  /** Seconds from firing to the closest approach. */
  readonly time: number;
  /** Closest approach to the led target minus its radius; zero or less is a hit. */
  readonly miss: number;
  /** Whether a hit here would score under the billiard rule. */
  readonly scores: boolean;
  /** The muzzle, each bounce point and the closest-approach point, in order. */
  readonly path: readonly Vec2[];
}

/** One plan per heading, 0 to 15, in order. */
export function planShots(
  origin: Vec2,
  muzzleReach: number,
  target: AimTarget,
  edges: readonly WallEdge[],
  shot: ShotModel,
): ShotPlan[];

export interface ShotPreference {
  /** Ignore plans with fewer bounces (billiard channels, Ricochet Royale). */
  readonly minBounces?: number;
  /** Ignore plans with more bounces (a bot that does not see two-bounce banks). */
  readonly maxBounces?: number;
  /** Count a plan as a hit when it misses by at most this much (a sloppy bot). */
  readonly slack?: number;
}

/**
 * The best scoring hit: fewest turn steps away from `heading`, then soonest, then fewest bounces.
 * Null when no plan hits.
 */
export function bestShot(
  plans: readonly ShotPlan[],
  heading: number,
  preference?: ShotPreference,
): ShotPlan | null;

/** The signed shortest number of steps from one heading to another, in -8..8 (8 rather than -8). */
export function turnSteps(from: number, to: number): number;

export interface Threat {
  /** Seconds until the shell is closest to the point. */
  readonly time: number;
  /** Closest approach minus the radius; zero or less means it will hit. */
  readonly miss: number;
}

/** Where an enemy shell already in flight will pass `point`, following its bounces; null if it dies first. */
export function incomingThreat(
  shell: Shell,
  rules: ShellRules,
  point: Vec2,
  radius: number,
  edges: readonly WallEdge[],
): Threat | null;
```

## Behaviour and edge cases

1. **Tracing a plan.** Start at the muzzle with the heading's direction and `remaining = life`.
   Repeat:
   - trace up to `remaining * speed` with `traceShot(..., { bounce: true, maxHits: 1 })`;
   - if a wall is hit and `walls` is `'stop'`, the flight ends there;
   - if a wall is hit and `walls` is `'bounce'`, compute the new direction yourself: `face` →
     `reflect(direction, normal)`, `corner` → reverse. Then set `remaining = life * bounceLifeRefresh`,
     count the bounce, and continue from the hit point (nudged 1e-6 along the new direction);
   - otherwise the flight ends at full range.

   Stop after `maxBounces` bounces: the last leg runs until the next wall or the end of its life.
   With `wrap`, there are no walls (`edges` is empty).

2. **Closest approach with lead.** Walk the flight in steps of at most 0.25 units, keeping the
   distance flown `d` (time `t = d / speed`). At each step compare the shell point with the led
   target `target.position + target.velocity * t` (wrapped into the sky when `wrap` is set, and
   measured the short way round). Keep the closest approach.
   - `miss` is that distance minus `target.radius`.
   - `time` and `bounces` are taken at that moment.
   - `path` holds the muzzle, the bounce points before that moment, and the closest point.
   - With `wrap`, path points are not folded back into the sky.
3. **scores**: true unless `billiard` is set and `bounces` is 0.
4. **bestShot.** Consider plans with `miss <= (slack ?? 0)`, with `scores` true, and within
   `minBounces` and `maxBounces`. Pick the fewest `|turnSteps(heading, plan.heading)|`, then the
   smallest `time`, then the fewest bounces. Null when none qualifies.
5. **turnSteps**: `((to - from) mod 16 + 16) mod 16`, minus 16 when above 8. So 0→15 is -1, 0→8 is 8
   and 3→3 is 0.
6. **incomingThreat.** Trace the shell from its position and direction with its remaining life, using
   the same loop as 1 with the rules' `walls`, `lifetime` and `bounceLifeRefresh` (at most 8
   bounces). Return the closest approach to the still `point` as a `Threat`. Return null if the shell
   is already dead (`life <= 0`) or the closest approach is more than 30 units.
7. No randomness, no globals, never mutate inputs. Keep it fast: `planShots` is called several times
   a second per bot, so avoid allocating inside the 0.25-unit walk beyond the few `Vec2`s you keep.

## Tests required (`games/tank-duel/tests/aim.test.ts`)

Build arenas from `compileArena` and the layouts, or small hand-made boxes with `buildWallEdges`.

- **Open Field, target straight ahead.** A shooter at (10, 20), target at (40, 20) and still: heading 0
  hits with 0 bounces, `time` ≈ distance / speed, `bestShot` from heading 0 picks it.
- **Out of range.** The same, but life too short to reach: no plan hits.
- **Lead.** A target crossing at speed 3 upwards: the hitting plan's closest approach matches the led
  position, and a still target at the same place gives a different `time` or heading choice.
- **Bank shot.** On Sandbag Line, shooter (8, 20) and target (56, 20) have no direct line (the central
  wall). With `walls: 'bounce'` and `maxBounces: 2`, at least one plan hits with 1 or 2 bounces, and
  its path's bounce points lie on wall faces.
- **Billiard.** In an open box, a direct hit has `scores` false and `bestShot` with `minBounces: 1`
  ignores it, choosing a banked plan if one exists.
- **Stop walls.** The same bank scene with `walls: 'stop'`: nothing hits.
- **turnSteps.** Cases 0→15, 15→0, 0→8, 4→12, 3→3.
- **Preference order.** Hand-made plans to check fewest turns, then time, then bounces, and slack.
- **Wrap.** In an empty sky with wrap, a shooter at (2, 20) facing left (heading 8) hits a target at
  (60, 20) the short way round.
- **incomingThreat.**
  - a shell flying straight at a tank returns `miss <= 0` and the right time;
  - one flying away returns null or a positive miss;
  - one that bounces off a wall into the point is found.

## Out of scope

Choosing when to fire, moving, personalities and perception (the AI order after this). Do not edit
the engine files; if you need a helper they lack, write it in your own file.

## Style

TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Intention-revealing
names (no single letters outside tiny loops), small functions, comments only where they explain why,
in plain words. No `any`, no non-null assertions, no commented-out code. Prettier: single quotes,
width 100, trailing commas. Import with `.ts` extensions.
