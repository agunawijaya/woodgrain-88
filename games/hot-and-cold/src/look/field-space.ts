/**
 * Where the field sits in the world, shared by every look: squares are four
 * units across, the field is centred on the origin, row 0 lies at the back
 * (the top of the screen) and column 0 on the left. Seat 1's home corner is
 * therefore the far left and seat 2's the near right.
 */
import { Vector3 } from 'three';
import { COLUMNS, ROWS, spotOf, squareAt, type Square } from '../engine/grid.ts';

export const SQUARE_SIZE = 4;
export const FIELD_WIDTH = COLUMNS * SQUARE_SIZE;
export const FIELD_DEPTH = ROWS * SQUARE_SIZE;

export function squareX(column: number): number {
  return (column - (COLUMNS - 1) / 2) * SQUARE_SIZE;
}

export function squareZ(row: number): number {
  return (row - (ROWS - 1) / 2) * SQUARE_SIZE;
}

export function squareCentre(square: Square, height = 0, into = new Vector3()): Vector3 {
  const { column, row } = spotOf(square);
  return into.set(squareX(column), height, squareZ(row));
}

/** A bearing index (0 north … 7 north-west) as a turn about the vertical axis, for three.js. */
export function bearingYaw(degreesClockwiseFromNorth: number): number {
  return -(degreesClockwiseFromNorth * Math.PI) / 180;
}

/** The square under a point on the field's surface, or null off the field. */
export function squareAtPoint(x: number, z: number): Square | null {
  const column = Math.round(x / SQUARE_SIZE + (COLUMNS - 1) / 2);
  const row = Math.round(z / SQUARE_SIZE + (ROWS - 1) / 2);
  if (column < 0 || column >= COLUMNS || row < 0 || row >= ROWS) return null;
  return squareAt(column, row);
}
