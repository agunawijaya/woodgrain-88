---
id: tank-bounce
kind: engine
model: gemini-3.8-flash-high
fence:
  - games/tank-duel/src/engine/walls.ts
  - games/tank-duel/src/engine/shell.ts
  - games/tank-duel/tests/walls.test.ts
  - games/tank-duel/tests/shell.test.ts
acceptance:
  - pnpm exec vitest run --project tank-duel games/tank-duel/tests/walls.test.ts games/tank-duel/tests/shell.test.ts
  - pnpm exec eslint games/tank-duel/src/engine/walls.ts games/tank-duel/src/engine/shell.ts games/tank-duel/tests/walls.test.ts games/tank-duel/tests/shell.test.ts
  - pnpm exec prettier --check games/tank-duel/src/engine/walls.ts games/tank-duel/src/engine/shell.ts games/tank-duel/tests/walls.test.ts games/tank-duel/tests/shell.test.ts
  - pnpm exec tsc -p games/tank-duel/tsconfig.json
reads:
  - games/tank-duel/src/engine/vec.ts
  - tsconfig.base.json
---

## Goal

The pure geometry behind Tank Duel's shells: turning wall shapes into the faces a shell can hit,
tracing a shell along a straight line with bounces (faces and corners), and the small state machine
of one shell in flight (lifetime, bounce counter, the billiard rule, guided steering, wrap for
aircraft). No DOM, no three.js, no randomness. The renderer draws the bank-shot path from
`traceShot`, and the game engine (written later) calls `stepShell` once per fixed tick.

## Context

- World units, x right and y down the screen (see `vec.ts`, use its helpers; do not redefine
  `Vec2`). Tank arenas are 64 × 40 units, enclosed by border walls; walls are convex polygons (mostly
  axis-aligned rectangles, plus 45° diamond bumpers). Polygons may touch along edges (two blocks side
  by side) but never overlap.
- A shell is a point. Shells travel 40 units per second; a step is 1/60 s, so a step moves well under
  one unit, but `traceShot` must work for any distance (the renderer traces a whole flight at once).
- 1977 behaviour we keep, in our own geometry: a bouncing shell reflects off the face it hits; a
  shell that hits a corner comes straight back the way it came; each bounce refreshes the remaining
  life to 80% of the full lifetime; in billiard channels a shell only scores after at least one
  bounce, and its bounce count wraps every 32 bounces, so the 32nd, 64th... bounce briefly takes the
  scoring right away again until the next bounce. Shells never hit their owner (the caller handles
  that; nothing here knows about vehicles except the circle test).

## Interface to implement

```ts
// games/tank-duel/src/engine/walls.ts
import type { Vec2 } from './vec.ts';

/** A convex wall piece. Either winding is accepted. */
export type WallPolygon = readonly Vec2[];

/** One exposed face of the walls: the part of a polygon's edge that open floor can see. */
export interface WallEdge {
  readonly a: Vec2;
  readonly b: Vec2;
  /** Unit normal pointing out of the wall, into the open floor. */
  readonly normal: Vec2;
  /** Whether the end at a (or b) is an outside corner, where a shell glances straight back. */
  readonly cornerAtA: boolean;
  readonly cornerAtB: boolean;
}

export interface BounceHit {
  /** Where the shell touched the wall. */
  readonly at: Vec2;
  /** The outward normal of the face that was hit. */
  readonly normal: Vec2;
  /** 'face' mirrors off the surface; 'corner' sends the shell straight back. */
  readonly kind: 'face' | 'corner';
  /** Distance travelled from the start of the trace to this hit. */
  readonly distance: number;
}

export interface TraceOptions {
  /** Reflect off walls (true) or stop at the first one (false). */
  readonly bounce: boolean;
  /** Within this distance of a corner end, a hit counts as a corner. Default CORNER_RADIUS. */
  readonly cornerRadius?: number;
  /** Safety cap on hits in one trace. Default MAX_TRACE_HITS. */
  readonly maxHits?: number;
}

export interface TraceResult {
  /** The start, every hit point and the end, in order: the path to draw. */
  readonly points: readonly Vec2[];
  readonly hits: readonly BounceHit[];
  readonly end: Vec2;
  /** Unit direction of travel at the end. */
  readonly direction: Vec2;
  /** True when the shell met a wall with `bounce: false` (it stops at `end`), or hit maxHits. */
  readonly stopped: boolean;
}

export const CORNER_RADIUS = 0.15;
export const MAX_TRACE_HITS = 64;

/** The exposed faces of a set of convex polygons: shared seams removed, collinear runs merged. */
export function buildWallEdges(polygons: readonly WallPolygon[]): WallEdge[];
/** Moves a point from `start` along `direction` (any length, normalised inside) for `distance`. */
export function traceShot(
  start: Vec2,
  direction: Vec2,
  distance: number,
  edges: readonly WallEdge[],
  options: TraceOptions,
): TraceResult;
/** The first point where a segment touches a circle, as a fraction of the segment, or null. 0 when it starts inside. */
export function segmentHitsCircle(
  from: Vec2,
  to: Vec2,
  center: Vec2,
  radius: number,
): number | null;
/** The first point where a polyline touches a circle: distance along the path and the point, or null. */
export function pathHitsCircle(
  points: readonly Vec2[],
  center: Vec2,
  radius: number,
): { distance: number; at: Vec2 } | null;
/** Whether the straight segment between two points crosses any wall face (for line of sight). */
export function segmentBlocked(from: Vec2, to: Vec2, edges: readonly WallEdge[]): boolean;
```

```ts
// games/tank-duel/src/engine/shell.ts
import type { Vec2 } from './vec.ts';
import type { BounceHit, WallEdge } from './walls.ts';

export interface ShellRules {
  /** Units per second. */
  readonly speed: number;
  /** Full flight time in seconds. */
  readonly lifetime: number;
  readonly walls: 'stop' | 'bounce';
  /** Only shells that bounced can score. */
  readonly billiard: boolean;
  /** Each bounce resets the remaining life to this fraction of `lifetime`. */
  readonly bounceLifeRefresh: number;
  /** Aircraft skies wrap at their edges; tank arenas have walls instead. */
  readonly wrap?: { readonly width: number; readonly height: number };
}

export interface Shell {
  readonly owner: number;
  readonly position: Vec2;
  /** Unit direction. */
  readonly direction: Vec2;
  /** Seconds of flight left. */
  readonly life: number;
  /** Bounces since it was fired. */
  readonly bounces: number;
  /** Where it was fired and every point it bounced, in order (the renderer appends `position`). */
  readonly path: readonly Vec2[];
}

export interface ShellStep {
  /** The shell after the step, or null when its life ran out or it stopped at a wall. */
  readonly shell: Shell | null;
  /** The bounces during this step, in order. */
  readonly hits: readonly BounceHit[];
  /** The polyline the shell covered this step (start, hits, end), for hit tests against vehicles. */
  readonly travelled: readonly Vec2[];
}

/** After this many bounces the count wraps, and a billiard shell cannot score until it bounces again. */
export const BILLIARD_WRAP = 32;

export function fireShell(owner: number, muzzle: Vec2, direction: Vec2, rules: ShellRules): Shell;
/** Advances a shell by dt seconds. `steer`, for guided shells, replaces its direction first. */
export function stepShell(
  shell: Shell,
  dt: number,
  edges: readonly WallEdge[],
  rules: ShellRules,
  steer?: Vec2,
): ShellStep;
/** Whether a hit by this shell would score under the rules. */
export function canScore(shell: Shell, rules: ShellRules): boolean;
```

## Behaviour and edge cases

1. **Winding.** `buildWallEdges` accepts either winding; outward normals always point away from the
   polygon's interior. Polygons with fewer than 3 vertices or zero area are ignored.
2. **Seams.** Where two polygons touch along a line (collinear edges with opposite normals), the
   overlapping part is removed from both: it is inside the walls, not a face. Partial overlaps leave
   the uncovered parts (a 2-long edge against a 6-long edge leaves the 6-long one split in two pieces
   around the shared stretch).
3. **Merging.** After seams are removed, collinear edges with the same normal that touch end to end
   are merged into one edge, so a row of blocks gives one long face.
4. **Corners.** For each end P of an edge E, find the other edge that also ends at P (within 1e-6).
   P is an outside corner when that edge's normal points along the direction you travel on E towards
   P (dot product > 1e-9). When no other edge ends at P, P is an outside corner too. Inside corners
   (concave, where a face meets a wall) are not corners: the double reflection there already sends
   the shell back. Diamond vertices are outside corners.
5. **Trace.** Only faces the shell moves towards count (dot(direction, normal) < 0). Find the
   nearest face crossing within the remaining distance (ignore crossings closer than 1e-7 to the
   current point). If the hit point is within `cornerRadius` of an end that is a corner, the hit is
   a `corner`: the direction is reversed. Otherwise it is a `face`: the direction is reflected
   (`reflect` in vec.ts). If two faces are hit at the same distance (within 1e-9), the hit is a
   `corner` (reversed). Continue from the hit point with the remaining distance. Every hit adds its
   point to `points`.
6. **Stop.** With `bounce: false`, the first hit ends the trace there: `end` is the hit point,
   `stopped` is true, and `hits` holds that one hit (its `kind` computed as above). Reaching
   `maxHits` hits also stops (end at the last hit, `stopped` true).
7. **Zero distance or zero direction:** `points` is `[start, start]`, no hits, direction normalised
   (the zero vector stays zero), not stopped.
8. **Circle tests.** `segmentHitsCircle` returns the smallest t in [0, 1] where the distance to
   `center` equals `radius`, 0 when `from` is already inside, null when the segment never comes
   closer than `radius`. A zero-length segment returns 0 or null. `pathHitsCircle` walks the
   polyline in order and returns the first contact, its distance from the path's start, and the
   point.
9. **Line of sight.** `segmentBlocked` is true when the open segment crosses or touches any face
   (both directions count; ends exactly on a face count as blocked).
10. **fireShell** normalises the direction, sets `life` to `rules.lifetime`, `bounces` 0 and
    `path` to `[muzzle]`.
11. **stepShell.** If `steer` is given, the direction becomes `normalize(steer)` (a zero steer keeps
    the old direction). Trace `speed * dt` with `bounce: rules.walls === 'bounce'`.
    - Each bounce adds 1 to `bounces`, appends the hit point to `path`, and sets `life` to
      `rules.lifetime * rules.bounceLifeRefresh` before the rest of the step's time is taken off.
      Subtract the step's time from life after the bounces: `life = (refreshed or old life) - dt`
      (use the time after the last bounce when a bounce happened: `dt * (1 - hitDistance / stepDistance)`
      for the last hit, so a shell bouncing at the end of its life lives on).
    - With `walls: 'stop'`, a shell that meets a wall returns `shell: null` (the hit is reported).
    - When life is 0 or less the shell returns null (the hits of that step are still reported).
    - With `wrap`, the end position is folded into [0, width) × [0, height); `travelled` stays the
      unwrapped polyline (start, end) so hit tests stay continuous; skies have no edges.
12. **canScore.** With `billiard: false`, always true. With `billiard: true`, true only when
    `bounces % BILLIARD_WRAP !== 0` (no bounce yet, or exactly 32, 64, ... bounces: false).
13. Never mutate inputs; return new objects. No `Math.random`, no globals.

## Tests required

`games/tank-duel/tests/walls.test.ts`:

- a single rectangle: 4 edges, outward normals, all 8 ends outside corners; same result for both windings;
- two touching rectangles side by side (0..4 and 4..8 by 0..2): the shared seam is gone and the top and
  bottom faces are merged into single 8-long edges; the seam ends are no longer corners;
- an L made of a 2×6 and a 6×2 rectangle: the inside corner is not a corner, the outside ones are;
- partial overlap: a 2-long edge against a 6-long edge splits the 6-long one around it;
- a diamond: 4 diagonal normals, all ends corners;
- trace with no walls: a straight line, no hits;
- trace into a vertical face at 45°: one face hit, mirrored direction, correct end point after the
  remaining distance;
- trace into a box from inside (a closed arena of four rectangles): several bounces, every point on a
  face, total path length equals the distance;
- trace straight into an outside corner of a block: a `corner` hit, the shell comes back along its
  path;
- trace into an inside corner of the arena (into the top-left at exactly 45°): the shell comes back
  (two faces at the same distance give a corner, or two quick face hits; either way the final
  direction is reversed);
- `bounce: false` stops at the first wall; `maxHits` stops a trace in a tiny box;
- `segmentHitsCircle`: miss, tangent, through, starting inside, zero-length; `pathHitsCircle` on a bent
  path finds the contact on the second segment with the right distance;
- `segmentBlocked` with and without a wall between two points.

`games/tank-duel/tests/shell.test.ts`:

- `fireShell` normalises and starts the path at the muzzle;
- straight flight: life decreases by dt each step and the shell expires on time (within one step);
- `walls: 'stop'` returns null on the step it reaches a wall and reports the hit;
- bouncing: `bounces` counts, the path gets each bounce point, life is refreshed to 80% at a bounce;
- guided: a steer turns the shell; a zero steer keeps its direction;
- billiard: `canScore` false before the first bounce, true after 1 and 31 bounces, false at 32, true
  at 33 (build the shells directly as objects for these cases);
- wrap: a shell leaving the right edge comes back on the left, `travelled` unwrapped;
- inputs are not mutated.

## Out of scope

Vehicles, tank collisions, rendering, sound, arena data (another order writes
`games/tank-duel/src/arenas/`). Do not edit `vec.ts`; if you need a helper it lacks, write it
locally in your file.

## Style

TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Intention-revealing
names, small functions, comments only where they explain why. No `any`, no non-null assertions, no
commented-out code. Prettier: single quotes, width 100, trailing commas. Import with `.ts` extensions
(`import { dot } from './vec.ts'`).
