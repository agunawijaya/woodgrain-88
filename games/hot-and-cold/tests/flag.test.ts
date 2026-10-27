/**
 * Tests for flag movement: still flags, edge/corner wrapping, wall/corner bouncing,
 * invariant field bounds over repeated stepping, and compass headings.
 */
import { describe, expect, it } from 'vitest';
import { HEADINGS, stepFlag, type Heading } from '../src/engine/flag.ts';
import { isSquare, squareAt, SQUARE_COUNT } from '../src/engine/grid.ts';

describe('flag', () => {
  it('keeps a still flag on its square with heading unchanged', () => {
    const heading: Heading = { east: 1, south: 1 };
    const step = stepFlag(25, heading, 'still');
    expect(step.square).toBe(25);
    expect(step.heading).toEqual(heading);
  });

  it('wraps a wrapping flag across edges and corners with unchanged heading', () => {
    // From the rightmost column (col 8, row 3) heading east, re-enters at col 0, row 3.
    const rightEdgeSquare = squareAt(8, 3);
    const eastHeading: Heading = { east: 1, south: 0 };
    const eastStep = stepFlag(rightEdgeSquare, eastHeading, 'wrap');
    expect(eastStep.square).toBe(squareAt(0, 3));
    expect(eastStep.heading).toEqual(eastHeading);

    // Corner stepping southeast from (8, 6) wraps both axes to (0, 0).
    const bottomCorner = squareAt(8, 6);
    const seHeading: Heading = { east: 1, south: 1 };
    const seStep = stepFlag(bottomCorner, seHeading, 'wrap');
    expect(seStep.square).toBe(squareAt(0, 0));
    expect(seStep.heading).toEqual(seHeading);

    // Corner stepping northwest from (0, 0) wraps both axes to (8, 6).
    const topCorner = squareAt(0, 0);
    const nwHeading: Heading = { east: -1, south: -1 };
    const nwStep = stepFlag(topCorner, nwHeading, 'wrap');
    expect(nwStep.square).toBe(squareAt(8, 6));
    expect(nwStep.heading).toEqual(nwHeading);
  });

  it('bounces a bouncing flag off edges and corners, reversing axis directions', () => {
    // Column 8 heading east lands on column 7, heading west.
    const eastEdge = squareAt(8, 3);
    const eastHeading: Heading = { east: 1, south: 0 };
    const bounceEast = stepFlag(eastEdge, eastHeading, 'bounce');
    expect(bounceEast.square).toBe(squareAt(7, 3));
    expect(bounceEast.heading).toEqual({ east: -1, south: 0 });

    // Row 0 heading north lands on row 1, heading south.
    const northEdge = squareAt(4, 0);
    const northHeading: Heading = { east: 0, south: -1 };
    const bounceNorth = stepFlag(northEdge, northHeading, 'bounce');
    expect(bounceNorth.square).toBe(squareAt(4, 1));
    expect(bounceNorth.heading).toEqual({ east: 0, south: 1 });

    // Diagonal into bottom-right corner (8, 6) reflects on both axes to (7, 5).
    const cornerSquare = squareAt(8, 6);
    const seHeading: Heading = { east: 1, south: 1 };
    const cornerBounce = stepFlag(cornerSquare, seHeading, 'bounce');
    expect(cornerBounce.square).toBe(squareAt(7, 5));
    expect(cornerBounce.heading).toEqual({ east: -1, south: -1 });

    // Diagonal into top-left corner (0, 0) reflects on both axes to (1, 1).
    const topLeftCorner = squareAt(0, 0);
    const nwHeading: Heading = { east: -1, south: -1 };
    const nwBounce = stepFlag(topLeftCorner, nwHeading, 'bounce');
    expect(nwBounce.square).toBe(squareAt(1, 1));
    expect(nwBounce.heading).toEqual({ east: 1, south: 1 });

    // Interior flag simply steps one square forward along its heading.
    const interiorSquare = squareAt(4, 3);
    const interiorHeading: Heading = { east: 1, south: 1 };
    const interiorStep = stepFlag(interiorSquare, interiorHeading, 'bounce');
    expect(interiorStep.square).toBe(squareAt(5, 4));
    expect(interiorStep.heading).toEqual(interiorHeading);
  });

  it('never leaves the field across 500 steps from every square and heading for bounce and wrap', () => {
    let allValid = true;

    for (let startSquare = 0; startSquare < SQUARE_COUNT; startSquare++) {
      for (const initialHeading of HEADINGS) {
        for (const motion of ['bounce', 'wrap'] as const) {
          let square = startSquare;
          let heading = initialHeading;

          for (let step = 0; step < 500; step++) {
            const next = stepFlag(square, heading, motion);
            square = next.square;
            heading = next.heading;
            if (!isSquare(square)) {
              allValid = false;
              break;
            }
          }
        }
      }
    }

    expect(allValid).toBe(true);
  });

  it('defines HEADINGS with eight distinct non-zero compass headings', () => {
    expect(HEADINGS).toHaveLength(8);

    const keys = new Set<string>();
    for (const h of HEADINGS) {
      // Must not stand still.
      expect(h.east === 0 && h.south === 0).toBe(false);
      // Valid step deltas.
      expect([-1, 0, 1]).toContain(h.east);
      expect([-1, 0, 1]).toContain(h.south);
      keys.add(`${h.east},${h.south}`);
    }

    expect(keys.size).toBe(8);
  });
});
