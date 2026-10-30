/**
 * Gravity Duel's physics core: the whole-number motion every body in the game
 * follows.
 *
 * Positions are subpixels (256 to a step), velocities fine units (256 to a
 * speed unit, one sixteenth of a step per tick) and headings 16 steps of
 * 22.5°, exactly as the 1978 program kept them. Nothing here reads the clock
 * or draws a random number: a body's next tick is a function of its state and
 * the controls alone, so the match, the looks and the Kids all agree on the
 * motion.
 */
import {
  BURNS_PER_SEGMENT,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  FINE_PER_UNIT,
  HEADINGS,
  SUBPIXELS,
  THRUST_EVERY,
  THRUST_FINE,
  TURN_REPEAT_TICKS,
  type Body,
  type Controls,
  type Edges,
  type Ship,
} from './types.ts';

export interface Vector {
  readonly x: number;
  readonly y: number;
}

/** The pull's inverse-square strength, fitted to the cartridge's grid (NOTES.md, Gravity). */
const PULL_STRENGTH = 26_000;
/** The pull along one axis is capped at 255 fine units near the middle. */
const PULL_CAP = 255;

/** The non-negative remainder, so mod(−1, 256) is 255, never negative. */
function mod(value: number, size: number): number {
  return ((value % size) + size) % size;
}

/** 0 and −0 are the same number; return the plain one so outputs never carry a sign. */
function positiveZero(value: number): number {
  return value === 0 ? 0 : value;
}

/** The whole speed units in a velocity (rounded down, so −0.5 units is −1). */
export function speedUnits(fine: number): number {
  return fine >> 8;
}

/** Wrap a whole-unit count to the signed 8-bit range −128…127. */
function toSignedByte(whole: number): number {
  return mod(whole + 128, 256) - 128;
}

/**
 * Reflect a wrapped whole-unit count about the ±64 fold: 64→63, 65→62 and
 * −65→−64. The cartridge holds each velocity in one signed byte, so a speed
 * past 63 comes back as if it had overshot and rebounded. A ship nudging up
 * through the limit sits at 63, but a missile that adds its muzzle speed in
 * one go lands far below it (NOTES.md, Missiles).
 */
function foldWhole(whole: number): number {
  if (whole >= 64) return 127 - whole;
  if (whole <= -65) return -129 - whole;
  return whole;
}

/**
 * The cartridge's speed fold, applied to one axis of a velocity before every
 * move. Only the whole units fold; the fraction rides along unchanged.
 */
export function foldSpeed(fine: number): number {
  const whole = speedUnits(fine);
  const fraction = fine - whole * FINE_PER_UNIT;
  return foldWhole(toSignedByte(whole)) * FINE_PER_UNIT + fraction;
}

/** One thrust along a heading, in fine units. */
export function thrustVector(heading: number): Vector {
  const step = mod(heading, HEADINGS);
  const angle = (step * 2 * Math.PI) / HEADINGS;
  const x = positiveZero(Math.round(THRUST_FINE * Math.cos(angle)));
  // y runs down the screen, so north is a negative y.
  const y = positiveZero(-Math.round(THRUST_FINE * Math.sin(angle)));
  return { x, y };
}

/** What firing adds to the ship's velocity, in whole speed units. */
export function muzzleVelocity(heading: number): Vector {
  const thrust = thrustVector(heading);
  return { x: thrust.x >> 1, y: thrust.y >> 1 };
}

/**
 * The middle's pull on a body, in fine units, given the vector from the body
 * to the middle in subpixels. Strength falls with the square of the distance,
 * matching the cartridge's lookup (NOTES.md, Gravity), and is capped near the
 * middle.
 */
export function gravityPull(dx: number, dy: number): Vector {
  const ax = Math.abs(dx) / SUBPIXELS;
  const ay = Math.abs(dy) / SUBPIXELS;
  const distance = Math.sqrt(ax * ax + ay * ay);
  if (distance === 0) return { x: 0, y: 0 };
  return { x: axisPull(dx, ax, distance), y: axisPull(dy, ay, distance) };
}

/** One axis's pull, inverse-square: proportional to the axis distance over the cube of the whole. */
function axisPull(offset: number, steps: number, distance: number): number {
  if (steps === 0) return 0;
  const magnitude = Math.min(
    PULL_CAP,
    Math.floor((PULL_STRENGTH * steps) / (distance * distance * distance)),
  );
  return positiveZero(offset < 0 ? -magnitude : magnitude);
}

/**
 * Which body gravity pulls this tick. Only one of the four is pulled per odd
 * tick, so each is pulled once every 8 ticks.
 */
export function gravityTurn(tick: number): 0 | 1 | 2 | 3 | null {
  if (tick % 2 === 0) return null;
  return ((tick >> 1) & 3) as 0 | 1 | 2 | 3;
}

/** Moves a body one tick: fold, move, then the edges. Returns true when it bounced off a wall. */
export function moveBody(body: Body, edges: Edges, radius: number): boolean {
  body.vx = foldSpeed(body.vx);
  body.vy = foldSpeed(body.vy);
  body.prevX = body.x;
  body.prevY = body.y;
  body.wrapped = false;
  body.x += body.vx >> 4;
  body.y += body.vy >> 4;
  if (edges === 'wrap') {
    wrapPosition(body);
    return false;
  }
  return bounce(body, radius);
}

/** Bring a body back inside the field, marking it wrapped only when an edge was crossed. */
function wrapPosition(body: Body): void {
  const width = FIELD_WIDTH * SUBPIXELS;
  const height = FIELD_HEIGHT * SUBPIXELS;
  const x = mod(body.x, width);
  const y = mod(body.y, height);
  body.wrapped = x !== body.x || y !== body.y;
  body.x = x;
  body.y = y;
}

/** Reflect a body off a wall, reversing only the axis that crossed it. */
function bounce(body: Body, radius: number): boolean {
  const margin = radius * SUBPIXELS;
  const rightEdge = FIELD_WIDTH * SUBPIXELS - margin;
  const bottomEdge = FIELD_HEIGHT * SUBPIXELS - margin;
  let bounced = false;
  if (body.x < margin) {
    body.x = 2 * margin - body.x;
    body.vx = -body.vx;
    bounced = true;
  } else if (body.x > rightEdge) {
    body.x = 2 * rightEdge - body.x;
    body.vx = -body.vx;
    bounced = true;
  }
  if (body.y < margin) {
    body.y = 2 * margin - body.y;
    body.vy = -body.vy;
    bounced = true;
  } else if (body.y > bottomEdge) {
    body.y = 2 * bottomEdge - body.y;
    body.vy = -body.vy;
    bounced = true;
  }
  return bounced;
}

/**
 * Turns a ship by its controls, with the cartridge's tap-then-repeat cadence:
 * a press steps at once, then repeats every 8 held ticks. Holding both
 * directions counts as holding neither, as it did on the cartridge's stick.
 */
export function turnShip(ship: Ship, controls: Controls): void {
  const turning = controls.left !== controls.right;
  if (!turning) {
    ship.turnWait = 0;
    return;
  }
  if (ship.turnWait === 0) {
    ship.heading = mod(ship.heading + (controls.left ? 1 : -1), HEADINGS);
    ship.turnWait = TURN_REPEAT_TICKS;
  }
  ship.turnWait -= 1;
}

/**
 * Thrust for one tick. `unlimited` is docking (fuel never runs out). Returns
 * 'fuel-out' when this tick's thrust burned the last fuel segment, otherwise
 * null.
 */
export function thrustShip(
  ship: Ship,
  controls: Controls,
  tick: number,
  unlimited: boolean,
): 'fuel-out' | null {
  ship.thrusting = controls.thrust && (unlimited || ship.fuel > 0);
  if (ship.thrusting && tick % THRUST_EVERY === 0) {
    const thrust = thrustVector(ship.heading);
    ship.vx += thrust.x;
    ship.vy += thrust.y;
    if (!unlimited && burnFuel(ship)) return 'fuel-out';
  }
  return null;
}

/** One burn from the fuel counter. Returns true when this burn took the last segment. */
export function burnFuel(ship: Ship): boolean {
  ship.burnsLeft -= 1;
  if (ship.burnsLeft === 0) {
    ship.burnsLeft = BURNS_PER_SEGMENT;
    ship.fuel = Math.max(0, ship.fuel - 1);
    return ship.fuel === 0;
  }
  return false;
}

/** Drops a whole fuel segment at once (cloaking). Returns true when the tank is now empty. */
export function dropSegment(ship: Ship): boolean {
  ship.fuel = Math.max(0, ship.fuel - 1);
  return ship.fuel === 0;
}

/** The signed difference b − a along an axis of length `size` subpixels, the short way round when edges wrap. */
export function axisDelta(a: number, b: number, size: number, edges: Edges): number {
  const delta = b - a;
  if (edges !== 'wrap') return delta;
  const half = size / 2;
  return mod(delta + half, size) - half;
}

/** Whether two bodies' circles overlap; radii in steps. */
export function touching(
  a: Body,
  b: Body,
  radiusA: number,
  radiusB: number,
  edges: Edges,
): boolean {
  const dx = axisDelta(a.x, b.x, FIELD_WIDTH * SUBPIXELS, edges);
  const dy = axisDelta(a.y, b.y, FIELD_HEIGHT * SUBPIXELS, edges);
  const reach = (radiusA + radiusB) * SUBPIXELS;
  return dx * dx + dy * dy < reach * reach;
}

/** The cartridge's docking measure: |Δ whole units of vx| + |Δ whole units of vy|. */
export function speedDifference(a: Body, b: Body): number {
  const dx = Math.abs(speedUnits(a.vx) - speedUnits(b.vx));
  const dy = Math.abs(speedUnits(a.vy) - speedUnits(b.vy));
  return dx + dy;
}
