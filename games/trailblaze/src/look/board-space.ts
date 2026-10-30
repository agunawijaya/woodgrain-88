/**
 * Where the grid sits on the table, the same in every look: one cell is one
 * unit, the board is centred on the origin, columns run along x and rows
 * along z, so the top row of the arena is the far side of the table.
 */
import { Vector3 } from 'three';
import { columnOf, rowOf } from '../engine/grid.ts';
import { vectorOf } from '../engine/headings.ts';
import { COLUMNS, ROWS, type Cell, type Heading } from '../engine/types.ts';

export const HALF_WIDTH = COLUMNS / 2;
export const HALF_DEPTH = ROWS / 2;

export function cellCentre(cell: Cell, y = 0, target = new Vector3()): Vector3 {
  return target.set(columnOf(cell) - (COLUMNS - 1) / 2, y, rowOf(cell) - (ROWS - 1) / 2);
}

/** The heading as a step on the table: diagonals are one unit along each axis. */
export function headingStep(heading: Heading, target = new Vector3()): Vector3 {
  const { east, south } = vectorOf(heading);
  return target.set(east, 0, south);
}

/** The turn about y that points a model built facing +x along the heading. */
export function headingYaw(heading: Heading): number {
  const { east, south } = vectorOf(heading);
  return Math.atan2(-south, east);
}

/** Brings a point that rode off one edge of a wraparound arena back in at the other. */
export function wrapOntoBoard(point: Vector3): Vector3 {
  point.x = wrapSpan(point.x, HALF_WIDTH);
  point.z = wrapSpan(point.z, HALF_DEPTH);
  return point;
}

function wrapSpan(value: number, half: number): number {
  const span = half * 2;
  return ((((value + half) % span) + span) % span) - half;
}

export function isOnBoard(point: Vector3): boolean {
  return Math.abs(point.x) <= HALF_WIDTH && Math.abs(point.z) <= HALF_DEPTH;
}

/** The shortest turn from one yaw to another, in (-π, π]. */
export function yawDelta(from: number, to: number): number {
  const turn = (to - from) % (Math.PI * 2);
  if (turn > Math.PI) return turn - Math.PI * 2;
  if (turn <= -Math.PI) return turn + Math.PI * 2;
  return turn;
}

/**
 * How far a vehicle's nose reaches ahead of the point the rider is drawn at, in cells. Vehicles are
 * drawn longer than a cell, back from the nose, so their front stays where the rules have them.
 */
export const NOSE_AHEAD = 0.4;
