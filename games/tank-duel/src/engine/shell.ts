/**
 * One shell in flight: its lifetime, bounces, guided steering and the
 * billiard rule.
 */
import type { Vec2 } from './vec.ts';
import { length, normalize, vec } from './vec.ts';
import type { BounceHit, WallEdge } from './walls.ts';
import { traceShot } from './walls.ts';

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
  /** However often it bounces, no shell flies longer than this many seconds in all. */
  readonly maxFlight: number;
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
  /** Seconds since it was fired. */
  readonly age: number;
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

export function fireShell(owner: number, muzzle: Vec2, direction: Vec2, rules: ShellRules): Shell {
  return {
    owner,
    position: muzzle,
    direction: normalize(direction),
    life: rules.lifetime,
    age: 0,
    bounces: 0,
    path: [muzzle],
  };
}

/** Advances a shell by dt seconds. `steer`, for guided shells, replaces its direction first. */
export function stepShell(
  shell: Shell,
  dt: number,
  edges: readonly WallEdge[],
  rules: ShellRules,
  steer?: Vec2,
): ShellStep {
  // Guided shells reorient immediately on input; zero vector maintains heading
  let direction = shell.direction;
  if (steer !== undefined && length(steer) > 1e-9) {
    direction = normalize(steer);
  }

  const stepDistance = rules.speed * dt;
  const trace = traceShot(shell.position, direction, stepDistance, edges, {
    bounce: rules.walls === 'bounce',
  });

  const hits = trace.hits;
  const travelled = trace.points;

  // Solid walls absorb shells on impact when bouncing is disabled
  if (rules.walls === 'stop' && hits.length > 0) {
    return {
      shell: null,
      hits,
      travelled,
    };
  }

  let life: number;
  const age = shell.age + dt;
  let bounces = shell.bounces;
  let path = shell.path;

  if (hits.length > 0) {
    bounces += hits.length;
    path = [...shell.path, ...hits.map((h) => h.at)];

    // Bouncing restores remaining life, subtracting only elapsed time after the final bounce
    const lastHit = hits[hits.length - 1];
    const timeRemaining =
      lastHit !== undefined && stepDistance > 1e-9
        ? dt * Math.max(0, 1 - lastHit.distance / stepDistance)
        : 0;

    life = Math.min(
      rules.lifetime * rules.bounceLifeRefresh - timeRemaining,
      rules.maxFlight - age,
    );
  } else {
    life = shell.life - dt;
  }

  if (life <= 1e-9) {
    return {
      shell: null,
      hits,
      travelled,
    };
  }

  // Open sky maps wrap around borders while keeping the flight path continuous
  let position = trace.end;
  if (rules.wrap !== undefined) {
    const w = rules.wrap.width;
    const h = rules.wrap.height;
    position = vec(((position.x % w) + w) % w, ((position.y % h) + h) % h);
  }

  const updatedShell: Shell = {
    owner: shell.owner,
    position,
    direction: trace.direction,
    life,
    age,
    bounces,
    path,
  };

  return {
    shell: updatedShell,
    hits,
    travelled,
  };
}

/** Whether a hit by this shell would score under the rules. */
export function canScore(shell: Shell, rules: ShellRules): boolean {
  if (!rules.billiard) {
    return true;
  }
  // Billiard shells must bounce before scoring, resetting every BILLIARD_WRAP bounces
  return shell.bounces % BILLIARD_WRAP !== 0;
}
