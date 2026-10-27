/**
 * The aiming brain the Neighbourhood Kids share. For every heading a vehicle
 * could face it traces where a shell fired now would go, bounces and all, and
 * how close it would pass the opponent's led position; it also says when an
 * enemy shell already in the air will reach a point. Exact geometry only:
 * a kid's hesitation and misjudgement are added by the commander.
 */
import type { Vec2 } from '../engine/vec.ts';
import {
  add,
  distance,
  headingVector,
  HEADING_STEPS,
  normalize,
  reflect,
  scale,
  vec,
} from '../engine/vec.ts';
import type { WallEdge } from '../engine/walls.ts';
import { segmentBlocked, traceShot } from '../engine/walls.ts';
import type { Shell, ShellRules } from '../engine/shell.ts';
import { MAX_FLIGHT_FACTOR } from '../engine/rules.ts';

/**
 * With the shooter given, the planner follows a shot this many bounces past the ones it plans: a
 * ricochet can come home on its fourth bounce as readily as its first.
 */
const SELF_WATCH_BOUNCES = 6;

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
  /**
   * Where the shooter stands, when its own ricochets can hit it (the Own ricochets setting): a
   * shell that comes back through here after a bounce, before it reaches the target, is no shot.
   */
  readonly self?: { readonly position: Vec2; readonly radius: number };
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
  /** The shell would come back off a wall into the shooter first (only with `ShotModel.self`). */
  readonly selfHit: boolean;
  /** Seconds until it would come back into the shooter; Infinity when it would not. */
  readonly returnsAt: number;
  /** The muzzle, each bounce point and the closest-approach point, in order. */
  readonly path: readonly Vec2[];
}

export interface ShotPreference {
  /** Ignore plans with fewer bounces (billiard channels, Ricochet Royale). */
  readonly minBounces?: number;
  /** Ignore plans with more bounces (a bot that does not see two-bounce banks). */
  readonly maxBounces?: number;
  /** Count a plan as a hit when it misses by at most this much (a sloppy bot). */
  readonly slack?: number;
}

export interface Threat {
  /** Seconds until the shell is closest to the point. */
  readonly time: number;
  /** Closest approach minus the radius; zero or less means it will hit. */
  readonly miss: number;
}

const MAX_WALK_STEP = 0.25;
const NUDGE_DISTANCE = 1e-6;
const MAX_THREAT_DISTANCE = 30;
const MAX_THREAT_BOUNCES = 8;

// Measures toroidal distance the shortest way round in a wrapping arena
function torusDistance(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  width: number,
  height: number,
): number {
  const normAx = ((ax % width) + width) % width;
  const normAy = ((ay % height) + height) % height;
  const normBx = ((bx % width) + width) % width;
  const normBy = ((by % height) + height) % height;

  let dx = Math.abs(normAx - normBx);
  if (dx > width * 0.5) {
    dx = width - dx;
  }
  let dy = Math.abs(normAy - normBy);
  if (dy > height * 0.5) {
    dy = height - dy;
  }
  return Math.hypot(dx, dy);
}

/** The signed shortest number of steps from one heading to another, in -8..8 (8 rather than -8). */
export function turnSteps(from: number, to: number): number {
  const diff = (((to - from) % HEADING_STEPS) + HEADING_STEPS) % HEADING_STEPS;
  return diff > 8 ? diff - 16 : diff;
}

/**
 * The best scoring hit: fewest turn steps away from `heading`, then soonest, then fewest bounces.
 * Null when no plan hits.
 */
export function bestShot(
  plans: readonly ShotPlan[],
  heading: number,
  preference?: ShotPreference,
): ShotPlan | null {
  let best: ShotPlan | null = null;
  let bestTurns = Infinity;
  let bestTime = Infinity;
  let bestBounces = Infinity;

  const slack = preference?.slack ?? 0;
  const minBounces = preference?.minBounces;
  const maxBounces = preference?.maxBounces;

  for (const plan of plans) {
    if (plan.miss > slack + 1e-9) {
      continue;
    }
    if (!plan.scores) {
      continue;
    }
    if (minBounces !== undefined && plan.bounces < minBounces) {
      continue;
    }
    if (maxBounces !== undefined && plan.bounces > maxBounces) {
      continue;
    }

    const turns = Math.abs(turnSteps(heading, plan.heading));

    if (best === null) {
      best = plan;
      bestTurns = turns;
      bestTime = plan.time;
      bestBounces = plan.bounces;
      continue;
    }

    // Sort priority: fewest turn steps, then soonest arrival, then fewest bounces
    if (turns < bestTurns) {
      best = plan;
      bestTurns = turns;
      bestTime = plan.time;
      bestBounces = plan.bounces;
    } else if (turns === bestTurns) {
      if (plan.time < bestTime - 1e-9) {
        best = plan;
        bestTurns = turns;
        bestTime = plan.time;
        bestBounces = plan.bounces;
      } else if (Math.abs(plan.time - bestTime) <= 1e-9) {
        if (plan.bounces < bestBounces) {
          best = plan;
          bestTurns = turns;
          bestTime = plan.time;
          bestBounces = plan.bounces;
        }
      }
    }
  }

  return best;
}

/** One plan per heading, 0 to 15, in order. */
export function planShots(
  origin: Vec2,
  muzzleReach: number,
  target: AimTarget,
  edges: readonly WallEdge[],
  shot: ShotModel,
): ShotPlan[] {
  const plans: ShotPlan[] = [];

  for (let heading = 0; heading < HEADING_STEPS; heading++) {
    const dir = headingVector(heading);
    // A vehicle nosed into a wall has its barrel through the wall. The engine then fizzles the shell
    // against the wall, or with bouncing walls throws it back off it from the vehicle's centre.
    const barrelEnd = add(origin, scale(dir, muzzleReach));
    const barrelBlocked = edges.length > 0 && segmentBlocked(origin, barrelEnd, edges);
    if (barrelBlocked && shot.walls === 'stop') {
      plans.push({
        heading,
        bounces: 0,
        time: 0,
        miss: Infinity,
        scores: false,
        selfHit: false,
        returnsAt: Infinity,
        path: [origin],
      });
      continue;
    }
    const muzzle = barrelBlocked ? origin : barrelEnd;

    let minDistance =
      shot.wrap !== undefined
        ? torusDistance(
            muzzle.x,
            muzzle.y,
            target.position.x,
            target.position.y,
            shot.wrap.width,
            shot.wrap.height,
          )
        : distance(muzzle, target.position);

    let bestTime = 0;
    let bestBounces = 0;
    let bestPoint: Vec2 = muzzle;
    let bestBouncePoints: Vec2[] = [];

    let currentPos = muzzle;
    let currentDir = dir;
    let remainingLife = shot.life;
    let legBounces = 0;
    let cumulativeDistance = 0;
    const recordedBouncePoints: Vec2[] = [];
    // When the shell would first pass back through the shooter after a bounce, if it would.
    let comesBackAt = Infinity;

    while (remainingLife > 1e-9) {
      const legDistanceToTrace = remainingLife * shot.speed;
      if (legDistanceToTrace <= 1e-9) {
        break;
      }

      let hitAt: Vec2 | null = null;
      let hitNormal: Vec2 | null = null;
      let hitKind: 'face' | 'corner' | null = null;
      let legEnd: Vec2;
      let legActualDistance: number;

      if (edges.length === 0 || shot.wrap !== undefined) {
        legEnd = add(currentPos, scale(currentDir, legDistanceToTrace));
        legActualDistance = legDistanceToTrace;
      } else {
        const trace = traceShot(currentPos, currentDir, legDistanceToTrace, edges, {
          bounce: true,
          maxHits: 1,
        });

        const firstHit = trace.hits[0];
        if (firstHit !== undefined) {
          hitAt = firstHit.at;
          hitNormal = firstHit.normal;
          hitKind = firstHit.kind;
          legEnd = firstHit.at;
          legActualDistance = distance(currentPos, legEnd);
        } else {
          legEnd = trace.end;
          legActualDistance = distance(currentPos, legEnd);
        }
      }

      const stepCount = Math.max(1, Math.ceil(legActualDistance / MAX_WALK_STEP));
      const startStep = legBounces > 0 ? 1 : 0;

      for (let s = startStep; s <= stepCount; s++) {
        const fraction = s / stepCount;
        const px = s === stepCount ? legEnd.x : currentPos.x + (legEnd.x - currentPos.x) * fraction;
        const py = s === stepCount ? legEnd.y : currentPos.y + (legEnd.y - currentPos.y) * fraction;
        const d = cumulativeDistance + legActualDistance * fraction;
        const t = shot.speed > 0 ? d / shot.speed : 0;

        const targetX = target.position.x + target.velocity.x * t;
        const targetY = target.position.y + target.velocity.y * t;

        const dist =
          shot.wrap !== undefined
            ? torusDistance(px, py, targetX, targetY, shot.wrap.width, shot.wrap.height)
            : Math.hypot(px - targetX, py - targetY);

        // Legs past the planned bounces are only followed to see whether the shell comes back.
        if (legBounces <= shot.maxBounces && dist < minDistance) {
          minDistance = dist;
          bestTime = t;
          bestBounces = legBounces;
          bestPoint = { x: px, y: py };
          bestBouncePoints = [...recordedBouncePoints];
        }

        if (
          shot.self !== undefined &&
          legBounces > 0 &&
          t < comesBackAt &&
          Math.hypot(px - shot.self.position.x, py - shot.self.position.y) <= shot.self.radius
        ) {
          comesBackAt = t;
        }
      }

      cumulativeDistance += legActualDistance;

      if (hitAt === null || hitNormal === null || hitKind === null) {
        break;
      }

      if (shot.walls === 'stop') {
        break;
      }

      const watchedBounces = shot.maxBounces + (shot.self === undefined ? 0 : SELF_WATCH_BOUNCES);
      if (legBounces >= watchedBounces) {
        break;
      }
      // Past the planned bounces the shell is only watched, and no shell outlives its flight cap.
      if (
        legBounces >= shot.maxBounces &&
        cumulativeDistance >= shot.speed * shot.life * MAX_FLIGHT_FACTOR
      ) {
        break;
      }

      recordedBouncePoints.push(hitAt);
      legBounces++;

      const nextDir =
        hitKind === 'corner'
          ? vec(-currentDir.x, -currentDir.y)
          : normalize(reflect(currentDir, hitNormal));

      currentDir = nextDir;
      remainingLife = shot.life * shot.bounceLifeRefresh;
      currentPos = add(hitAt, scale(nextDir, NUDGE_DISTANCE));
    }

    const reachesTarget = minDistance - target.radius <= 0;
    // Back into the shooter before the target, or after missing it: no shot worth taking.
    const selfHit = comesBackAt < Infinity && !(reachesTarget && bestTime < comesBackAt);
    const miss = selfHit ? Infinity : minDistance - target.radius;
    const scores = !(shot.billiard && bestBounces === 0);
    const path: readonly Vec2[] = [muzzle, ...bestBouncePoints, bestPoint];

    plans.push({
      heading,
      bounces: bestBounces,
      time: bestTime,
      miss,
      scores,
      selfHit,
      returnsAt: comesBackAt,
      path,
    });
  }

  return plans;
}

/** Where an enemy shell already in flight will pass `point`, following its bounces; null if it dies first. */
export function incomingThreat(
  shell: Shell,
  rules: ShellRules,
  point: Vec2,
  radius: number,
  edges: readonly WallEdge[],
): Threat | null {
  if (shell.life <= 0) {
    return null;
  }

  let currentPos = shell.position;
  let currentDir = normalize(shell.direction);
  let remainingLife = shell.life;
  let bounces = 0;

  let minDistance =
    rules.wrap !== undefined
      ? torusDistance(
          currentPos.x,
          currentPos.y,
          point.x,
          point.y,
          rules.wrap.width,
          rules.wrap.height,
        )
      : distance(currentPos, point);

  let closestTime = 0;
  let cumulativeDistance = 0;

  while (remainingLife > 1e-9) {
    const legDistanceToTrace = remainingLife * rules.speed;
    if (legDistanceToTrace <= 1e-9) {
      break;
    }

    let hitAt: Vec2 | null = null;
    let hitNormal: Vec2 | null = null;
    let hitKind: 'face' | 'corner' | null = null;
    let legEnd: Vec2;
    let legActualDistance: number;

    if (edges.length === 0 || rules.wrap !== undefined) {
      legEnd = add(currentPos, scale(currentDir, legDistanceToTrace));
      legActualDistance = legDistanceToTrace;
    } else {
      const trace = traceShot(currentPos, currentDir, legDistanceToTrace, edges, {
        bounce: true,
        maxHits: 1,
      });

      const firstHit = trace.hits[0];
      if (firstHit !== undefined) {
        hitAt = firstHit.at;
        hitNormal = firstHit.normal;
        hitKind = firstHit.kind;
        legEnd = firstHit.at;
        legActualDistance = distance(currentPos, legEnd);
      } else {
        legEnd = trace.end;
        legActualDistance = distance(currentPos, legEnd);
      }
    }

    const stepCount = Math.max(1, Math.ceil(legActualDistance / MAX_WALK_STEP));
    const startStep = bounces > 0 ? 1 : 0;

    for (let s = startStep; s <= stepCount; s++) {
      const fraction = s / stepCount;
      const px = s === stepCount ? legEnd.x : currentPos.x + (legEnd.x - currentPos.x) * fraction;
      const py = s === stepCount ? legEnd.y : currentPos.y + (legEnd.y - currentPos.y) * fraction;
      const d = cumulativeDistance + legActualDistance * fraction;
      const t = rules.speed > 0 ? d / rules.speed : 0;

      const dist =
        rules.wrap !== undefined
          ? torusDistance(px, py, point.x, point.y, rules.wrap.width, rules.wrap.height)
          : Math.hypot(px - point.x, py - point.y);

      if (dist < minDistance) {
        minDistance = dist;
        closestTime = t;
      }
    }

    cumulativeDistance += legActualDistance;

    if (hitAt === null || hitNormal === null || hitKind === null) {
      break;
    }

    if (rules.walls === 'stop') {
      break;
    }

    if (bounces >= MAX_THREAT_BOUNCES) {
      break;
    }

    bounces++;

    const nextDir =
      hitKind === 'corner'
        ? vec(-currentDir.x, -currentDir.y)
        : normalize(reflect(currentDir, hitNormal));

    currentDir = nextDir;
    remainingLife = rules.lifetime * rules.bounceLifeRefresh;
    currentPos = add(hitAt, scale(nextDir, NUDGE_DISTANCE));
  }

  if (minDistance > MAX_THREAT_DISTANCE) {
    return null;
  }

  return {
    time: closestTime,
    miss: minDistance - radius,
  };
}
