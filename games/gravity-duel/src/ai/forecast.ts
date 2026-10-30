/**
 * Looking ahead the way a pilot does: where a coasting body will drift, and
 * which heading would send a missile into a target that keeps moving. It runs
 * the real physics on scratch copies, so the star bends the forecast exactly
 * as it will bend the flight; how wrong a Kid gets it is decided by what it
 * feeds in (its lead share, its lookahead), not here.
 */
import { gravityPull, moveBody, muzzleVelocity, speedUnits, axisDelta } from '../engine/physics.ts';
import {
  CENTRE_X,
  CENTRE_Y,
  CENTRE_RADIUS,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  GRAVITY_EVERY,
  HEADINGS,
  MISSILE_LIFE,
  MISSILE_RADIUS,
  SUBPIXELS,
  type Body,
  type VariationRules,
} from '../engine/types.ts';

export interface Motion {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
}

const WIDTH = FIELD_WIDTH * SUBPIXELS;
const HEIGHT = FIELD_HEIGHT * SUBPIXELS;

function scratch(motion: Motion): Body {
  return { ...motion, prevX: motion.x, prevY: motion.y, wrapped: false };
}

/**
 * One tick of drift. Gravity is applied every GRAVITY_EVERY ticks on `phase`, close enough to the
 * engine's staggered turns for a forecast; `pullSense` scales it for a pilot who only half allows
 * for the star.
 */
function drift(
  body: Body,
  rules: VariationRules,
  radius: number,
  tick: number,
  phase: number,
  pullSense = 1,
) {
  moveBody(body, rules.edges, radius);
  if (rules.gravity && tick % GRAVITY_EVERY === phase) {
    const pull = gravityPull(CENTRE_X - body.x, CENTRE_Y - body.y);
    body.vx += Math.trunc(pull.x * pullSense);
    body.vy += Math.trunc(pull.y * pullSense);
  }
}

/** Distance between two points in steps, the short way round when the edges wrap. */
export function distanceSteps(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  rules: VariationRules,
): number {
  const dx = axisDelta(ax, bx, WIDTH, rules.edges) / SUBPIXELS;
  const dy = axisDelta(ay, by, HEIGHT, rules.edges) / SUBPIXELS;
  return Math.hypot(dx, dy);
}

/** Distance from the middle in steps (the middle never wraps). */
export function distanceFromCentre(x: number, y: number): number {
  return Math.hypot((x - CENTRE_X) / SUBPIXELS, (y - CENTRE_Y) / SUBPIXELS);
}

/**
 * The tick, within `ticks`, at which a body coasting from `start` first comes within `clearance`
 * steps of the middle, or null if it stays clear.
 */
export function ticksToCentre(
  start: Motion,
  ticks: number,
  rules: VariationRules,
  radius: number,
  clearance: number,
): number | null {
  const body = scratch(start);
  for (let tick = 1; tick <= ticks; tick++) {
    drift(body, rules, radius, tick, 0);
    if (distanceFromCentre(body.x, body.y) < clearance) return tick;
  }
  return null;
}

/** Where a coasting body will be `ticks` from now. */
export function coastTo(
  start: Motion,
  ticks: number,
  rules: VariationRules,
  radius: number,
): Motion {
  const body = scratch(start);
  for (let tick = 1; tick <= ticks; tick++) drift(body, rules, radius, tick, 0);
  return { x: body.x, y: body.y, vx: body.vx, vy: body.vy };
}

/**
 * The closest a body coasting from `start` comes to a point moving in a straight line from
 * `target` at its velocity scaled by `share`, within `ticks`; and when.
 */
export function closestApproach(
  start: Motion,
  target: Motion,
  share: number,
  ticks: number,
  rules: VariationRules,
  radius: number,
): { readonly miss: number; readonly at: number } {
  const body = scratch(start);
  let miss = Infinity;
  let at = 0;
  for (let tick = 1; tick <= ticks; tick++) {
    drift(body, rules, radius, tick, 0);
    const tx = target.x + (target.vx >> 4) * share * tick;
    const ty = target.y + (target.vy >> 4) * share * tick;
    const distance = distanceSteps(body.x, body.y, tx, ty, rules);
    if (distance < miss) {
      miss = distance;
      at = tick;
    }
  }
  return { miss, at };
}

export interface Shot {
  readonly heading: number;
  /** The closest the missile is forecast to pass the target, in steps. */
  readonly miss: number;
  /** Ticks from firing to that closest pass. */
  readonly at: number;
  /** Radians the star bends the missile before it gets there, signed. */
  readonly bend: number;
}

/** How a pilot reckons a shot. */
export interface ShotSense {
  /** The share of the target's travel it leads by: 1 exactly, less leads short. */
  readonly lead: number;
  /** How much of the star's pull it allows for, 0–1. */
  readonly pull: number;
  /** The widest forecast miss, in steps, it thinks worth a missile. */
  readonly tolerance: number;
  /** Steps of forecast miss it gives up, per radian, for a shot the star bends. */
  readonly bendBonus: number;
}

/**
 * The best heading to fire from `shooter` at a target forecast as a straight line from `target`,
 * reckoned as the pilot's `sense` allows, considering only `headings`. Flights the middle would
 * swallow are skipped. Null when nothing passes within the tolerance.
 */
export function bestShot(
  shooter: Motion,
  target: Motion,
  rules: VariationRules,
  headings: readonly number[],
  sense: ShotSense,
): Shot | null {
  let best: Shot | null = null;
  let bestScore = Infinity;
  for (const heading of headings) {
    const shot = flyMissile(shooter, target, rules, heading, sense);
    if (!shot || shot.miss > sense.tolerance) continue;
    const score = shot.miss - sense.bendBonus * Math.abs(shot.bend);
    if (score < bestScore) {
      best = shot;
      bestScore = score;
    }
  }
  return best;
}

function flyMissile(
  shooter: Motion,
  target: Motion,
  rules: VariationRules,
  heading: number,
  sense: ShotSense,
): Shot | null {
  const muzzle = muzzleVelocity(heading);
  const missile = scratch({
    x: shooter.x,
    y: shooter.y,
    vx: (speedUnits(shooter.vx) + muzzle.x) * 256,
    vy: (speedUnits(shooter.vy) + muzzle.y) * 256,
  });
  const swallows = rules.centre === 'star' || rules.centre === 'starbase';
  let miss = Infinity;
  let at = 0;
  let bend = 0;
  let direction = Math.atan2(-missile.vy, missile.vx);
  for (let tick = 1; tick <= MISSILE_LIFE; tick++) {
    drift(missile, rules, MISSILE_RADIUS, tick, 0, sense.pull);
    if (swallows && distanceFromCentre(missile.x, missile.y) < CENTRE_RADIUS + MISSILE_RADIUS) {
      return miss === Infinity ? null : { heading, miss, at, bend };
    }
    const now = Math.atan2(-missile.vy, missile.vx);
    bend += wrapAngle(now - direction);
    direction = now;
    const tx = target.x + (target.vx >> 4) * sense.lead * tick;
    const ty = target.y + (target.vy >> 4) * sense.lead * tick;
    const distance = distanceSteps(missile.x, missile.y, tx, ty, rules);
    if (distance < miss) {
      miss = distance;
      at = tick;
    }
  }
  return { heading, miss, at, bend };
}

/** An angle wrapped into (−π, π]. */
export function wrapAngle(angle: number): number {
  let wrapped = angle;
  while (wrapped > Math.PI) wrapped -= 2 * Math.PI;
  while (wrapped <= -Math.PI) wrapped += 2 * Math.PI;
  return wrapped;
}

/** The heading (0–15) nearest a direction given in fine units or steps (y down). */
export function headingToward(dx: number, dy: number): number {
  const angle = Math.atan2(-dy, dx);
  return ((Math.round(angle / (Math.PI / 8)) % HEADINGS) + HEADINGS) % HEADINGS;
}

/** The signed number of heading steps from `from` to `to`, the short way: −7 to 8. */
export function headingDifference(from: number, to: number): number {
  const difference = (((to - from) % HEADINGS) + HEADINGS) % HEADINGS;
  return difference > HEADINGS / 2 ? difference - HEADINGS : difference;
}

export interface FieldPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Where a body coasting from `start` will be over the next `ticks`, one point every `every` ticks:
 * the trajectory guide's dotted line for a ship.
 */
export function coastPath(
  start: Motion,
  ticks: number,
  rules: VariationRules,
  radius: number,
  every: number,
): FieldPoint[] {
  const body = scratch(start);
  const points: FieldPoint[] = [];
  for (let tick = 1; tick <= ticks; tick++) {
    drift(body, rules, radius, tick, 0);
    if (tick % every === 0) points.push({ x: body.x, y: body.y });
  }
  return points;
}

/** Where a coasting body will be, and how fast, every `every` ticks over the next `ticks`. */
export function coastTrack(
  start: Motion,
  ticks: number,
  rules: VariationRules,
  radius: number,
  every: number,
): Motion[] {
  const body = scratch(start);
  const track: Motion[] = [];
  for (let tick = 1; tick <= ticks; tick++) {
    drift(body, rules, radius, tick, 0);
    if (tick % every === 0) track.push({ x: body.x, y: body.y, vx: body.vx, vy: body.vy });
  }
  return track;
}

/** The flight a missile fired now on `heading` would take, one point every `every` ticks. */
export function missilePath(
  shooter: Motion,
  heading: number,
  rules: VariationRules,
  every: number,
): FieldPoint[] {
  const muzzle = muzzleVelocity(heading);
  const missile = scratch({
    x: shooter.x,
    y: shooter.y,
    vx: (speedUnits(shooter.vx) + muzzle.x) * 256,
    vy: (speedUnits(shooter.vy) + muzzle.y) * 256,
  });
  const swallows = rules.centre === 'star' || rules.centre === 'starbase';
  const points: FieldPoint[] = [];
  for (let tick = 1; tick <= MISSILE_LIFE; tick++) {
    drift(missile, rules, MISSILE_RADIUS, tick, 0);
    if (swallows && distanceFromCentre(missile.x, missile.y) < CENTRE_RADIUS + MISSILE_RADIUS)
      break;
    if (tick % every === 0) points.push({ x: missile.x, y: missile.y });
  }
  return points;
}
