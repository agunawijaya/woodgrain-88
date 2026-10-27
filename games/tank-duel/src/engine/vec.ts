/**
 * Plain 2D vectors for the duel's flat world. The table is seen from above:
 * x runs right and y runs down the screen, towards the players, so a
 * heading's angle grows clockwise on screen. One world unit is half a
 * floor cell; the arena is 64 × 40 units.
 */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** Vehicles turn in sixteen steps of 22.5°, as in 1977: step 0 faces right (+x), step 4 faces down (+y). */
export const HEADING_STEPS = 16;

export function vec(x: number, y: number): Vec2 {
  return { x, y };
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Vec2, factor: number): Vec2 {
  return { x: a.x * factor, y: a.y * factor };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

/** The z of the 3D cross product: positive when b turns clockwise from a on screen. */
export function cross(a: Vec2, b: Vec2): number {
  return a.x * b.y - a.y * b.x;
}

export function length(a: Vec2): number {
  return Math.hypot(a.x, a.y);
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The unit vector along a; the zero vector stays zero rather than becoming NaN. */
export function normalize(a: Vec2): Vec2 {
  const size = length(a);
  return size === 0 ? { x: 0, y: 0 } : { x: a.x / size, y: a.y / size };
}

export function lerp(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Mirrors a direction off a surface with unit normal `normal`. */
export function reflect(direction: Vec2, normal: Vec2): Vec2 {
  const along = 2 * dot(direction, normal);
  return { x: direction.x - along * normal.x, y: direction.y - along * normal.y };
}

/** A heading step folded into [0, 16); fractional steps are kept for eased drawing. */
export function wrapStep(step: number): number {
  return ((step % HEADING_STEPS) + HEADING_STEPS) % HEADING_STEPS;
}

/** The angle of a heading step in radians, clockwise on screen from +x. */
export function headingAngle(step: number): number {
  return (wrapStep(step) / HEADING_STEPS) * Math.PI * 2;
}

/** The unit vector a vehicle at this heading step faces. */
export function headingVector(step: number): Vec2 {
  const angle = headingAngle(step);
  return { x: Math.cos(angle), y: Math.sin(angle) };
}
