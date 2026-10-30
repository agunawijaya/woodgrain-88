/**
 * A stand-in for the engine, for the hero scenes only: bodies drifting under a
 * pull toward the star that weakens with distance, thrust along a heading,
 * and walls that bounce. Smooth and continuous, so the art can be judged
 * before the cartridge's own fixed-step physics exists. Dev only; the game
 * never imports it.
 */

/** Strength of the pull: acceleration = PULL / distance, in units per second squared. */
export const PULL = 420;
/** The pull stops growing inside this radius, so nothing slingshots off to infinity. */
const CORE = 1.4;
export const THRUST = 9;
export const MAX_SPEED = 40;
export const MISSILE_SPEED = 22.5;

export interface Body {
  x: number;
  z: number;
  vx: number;
  vz: number;
}

export interface Walls {
  readonly halfWidth: number;
  readonly halfDepth: number;
}

/** One small step: the star's pull, thrust if any, the speed cap, and a bounce off the walls (true if it bounced). */
export function stepBody(
  body: Body,
  dt: number,
  options: { thrustHeading?: number; walls?: Walls; gravity?: boolean } = {},
): boolean {
  if (options.gravity !== false) {
    const distance = Math.max(CORE, Math.hypot(body.x, body.z));
    const pull = PULL / distance / distance;
    body.vx -= body.x * pull * dt;
    body.vz -= body.z * pull * dt;
  }
  if (options.thrustHeading !== undefined) {
    body.vx += Math.cos(options.thrustHeading) * THRUST * dt;
    body.vz -= Math.sin(options.thrustHeading) * THRUST * dt;
  }
  const speed = Math.hypot(body.vx, body.vz);
  if (speed > MAX_SPEED) {
    body.vx *= MAX_SPEED / speed;
    body.vz *= MAX_SPEED / speed;
  }
  body.x += body.vx * dt;
  body.z += body.vz * dt;
  const walls = options.walls;
  if (!walls) return false;
  let bounced = false;
  if (Math.abs(body.x) > walls.halfWidth) {
    body.x = Math.sign(body.x) * walls.halfWidth;
    body.vx = -body.vx;
    bounced = true;
  }
  if (Math.abs(body.z) > walls.halfDepth) {
    body.z = Math.sign(body.z) * walls.halfDepth;
    body.vz = -body.vz;
    bounced = true;
  }
  return bounced;
}

/** The heading a velocity points along, radians counter-clockwise from +x seen from above. */
export function headingOf(vx: number, vz: number): number {
  return Math.atan2(-vz, vx);
}
