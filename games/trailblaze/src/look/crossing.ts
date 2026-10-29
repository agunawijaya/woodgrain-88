/**
 * How a rider crosses one cell on screen. The rules move riders from cell
 * centre to cell centre; the picture moves them from the edge they came in by
 * to the edge they leave by, along a smooth curve that bends through the
 * cell's centre, so a turn is a curve and not a corner. Trails are drawn
 * along exactly the same curves, so a rider always rides on its own line.
 *
 * The curve is a quadratic Bézier: from the entry edge, pulled towards the
 * cell's centre, to the exit edge. On a straight it is a straight line.
 */
import { Vector2, Vector3 } from 'three';
import { vectorOf } from '../engine/headings.ts';
import type { Cell, Heading } from '../engine/types.ts';
import { cellCentre, headingStep } from './board-space.ts';

export type TurnKind = 'straight' | 'right' | 'left' | 'other';

export interface Crossing {
  readonly cell: Cell;
  readonly entered: Heading;
  readonly left: Heading;
}

const scratchEntry = new Vector3();
const scratchExit = new Vector3();
const scratchCentre = new Vector3();
const scratchStep = new Vector3();

/** The point where a rider heading this way comes into the cell (an edge, or a corner). */
export function entryPoint(cell: Cell, heading: Heading, target = new Vector3()): Vector3 {
  return cellCentre(cell, 0, target).addScaledVector(headingStep(heading, scratchStep), -0.5);
}

/** The point where a rider heading this way leaves the cell. */
export function exitPoint(cell: Cell, heading: Heading, target = new Vector3()): Vector3 {
  return cellCentre(cell, 0, target).addScaledVector(headingStep(heading, scratchStep), 0.5);
}

/** The point `t` (0 to 1) of the way along a crossing. */
export function crossingPoint(crossing: Crossing, t: number, target = new Vector3()): Vector3 {
  const entry = entryPoint(crossing.cell, crossing.entered, scratchEntry);
  const exit = exitPoint(crossing.cell, crossing.left, scratchExit);
  const centre = cellCentre(crossing.cell, 0, scratchCentre);
  const a = (1 - t) * (1 - t);
  const b = 2 * t * (1 - t);
  const c = t * t;
  return target.set(
    entry.x * a + centre.x * b + exit.x * c,
    0,
    entry.z * a + centre.z * b + exit.z * c,
  );
}

/** The direction of travel at point `t` of a crossing (not normalised). */
export function crossingTangent(crossing: Crossing, t: number, target = new Vector3()): Vector3 {
  const entry = entryPoint(crossing.cell, crossing.entered, scratchEntry);
  const exit = exitPoint(crossing.cell, crossing.left, scratchExit);
  const centre = cellCentre(crossing.cell, 0, scratchCentre);
  return target.set(
    2 * (1 - t) * (centre.x - entry.x) + 2 * t * (exit.x - centre.x),
    0,
    2 * (1 - t) * (centre.z - entry.z) + 2 * t * (exit.z - centre.z),
  );
}

/** A right-angle turn between two cardinal headings gets its own curved piece; anything else is approximated. */
export function turnKind(entered: Heading, left: Heading): TurnKind {
  if (entered === left) return 'straight';
  const a = vectorOf(entered);
  const b = vectorOf(left);
  const cardinal =
    Math.abs(a.east) + Math.abs(a.south) === 1 && Math.abs(b.east) + Math.abs(b.south) === 1;
  if (!cardinal || a.east * b.east + a.south * b.south !== 0) return 'other';
  return a.east * b.south - a.south * b.east > 0 ? 'right' : 'left';
}

/**
 * The right turn's curve in a corner's own frame (the trail comes in along +x at the cell's left
 * edge and leaves along +z), for building geometry that matches what riders ride along.
 */
export function rightTurnPath(steps = 14): Vector2[] {
  return Array.from({ length: steps + 1 }, (_, step) => {
    const t = step / steps;
    const a = (1 - t) * (1 - t);
    const c = t * t;
    return new Vector2(-0.5 * a, 0.5 * c);
  });
}
