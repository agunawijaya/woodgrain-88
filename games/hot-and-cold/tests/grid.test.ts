/**
 * Tests for the 9x7 field grid: coordinate round-tripping, king distance,
 * bearings between squares, and wrapped stepping.
 */
import { describe, expect, it } from 'vitest';
import {
  bearingDegrees,
  bearingTowards,
  COLUMNS,
  isSquare,
  kingDistance,
  ROWS,
  spotOf,
  squareAt,
  SQUARE_COUNT,
  stepBetween,
  stepFrom,
} from '../src/engine/grid.ts';

describe('grid', () => {
  it('round-trips squareAt and spotOf for all 63 squares with 0 at top left and 62 at bottom right', () => {
    expect(SQUARE_COUNT).toBe(63);
    expect(COLUMNS).toBe(9);
    expect(ROWS).toBe(7);

    // Square 0 is the top-left corner (col 0, row 0).
    expect(spotOf(0)).toEqual({ column: 0, row: 0 });
    expect(squareAt(0, 0)).toBe(0);

    // Square 62 is the bottom-right corner (col 8, row 6).
    expect(spotOf(62)).toEqual({ column: 8, row: 6 });
    expect(squareAt(8, 6)).toBe(62);

    // Verify exact round-trip conversion for every square on the board.
    for (let square = 0; square < SQUARE_COUNT; square++) {
      expect(isSquare(square)).toBe(true);
      const spot = spotOf(square);
      expect(spot.column).toBeGreaterThanOrEqual(0);
      expect(spot.column).toBeLessThan(COLUMNS);
      expect(spot.row).toBeGreaterThanOrEqual(0);
      expect(spot.row).toBeLessThan(ROWS);
      expect(squareAt(spot.column, spot.row)).toBe(square);
    }

    // Boundary checks for isSquare
    expect(isSquare(-1)).toBe(false);
    expect(isSquare(63)).toBe(false);
    expect(isSquare(1.5)).toBe(false);
  });

  it('measures king distance as the larger of column and row differences without wrapping', () => {
    // Same row, opposite ends: squares 0 and 8 are 8 apart, not wrapped to 1.
    expect(kingDistance(0, 8)).toBe(8);
    expect(kingDistance(8, 0)).toBe(8);

    // Same column, top to bottom: squares 0 and 54 are 6 apart.
    const bottomSquare = squareAt(0, 6);
    expect(kingDistance(0, bottomSquare)).toBe(6);

    // Opposite corners: col diff 8, row diff 6 -> king distance is 8.
    expect(kingDistance(0, 62)).toBe(8);

    // Same square is distance 0.
    expect(kingDistance(14, 14)).toBe(0);

    // Check asymmetric column/row differences.
    const from = squareAt(2, 1);
    const to = squareAt(5, 5);
    // col diff is 3, row diff is 4 -> max is 4.
    expect(kingDistance(from, to)).toBe(4);
    expect(kingDistance(to, from)).toBe(4);
  });

  it('determines cardinal bearing in same row or column, and diagonal bearing by signs otherwise', () => {
    // Same row: east or west.
    const rowMid = squareAt(4, 3);
    const rowEast = squareAt(7, 3);
    const rowWest = squareAt(1, 3);
    expect(bearingTowards(rowMid, rowEast)).toBe('e');
    expect(bearingTowards(rowMid, rowWest)).toBe('w');

    // Same column: north or south.
    const colNorth = squareAt(4, 1);
    const colSouth = squareAt(4, 5);
    expect(bearingTowards(rowMid, colNorth)).toBe('n');
    expect(bearingTowards(rowMid, colSouth)).toBe('s');

    // Diagonal by coordinate signs regardless of slope.
    // From (0, 3) to (8, 2): column diff is +8, row diff is -1 -> 'ne'.
    const steepNeFrom = squareAt(0, 3);
    const steepNeTo = squareAt(8, 2);
    expect(bearingTowards(steepNeFrom, steepNeTo)).toBe('ne');

    // Steep northwest: column diff -7, row diff -1 -> 'nw'.
    expect(bearingTowards(squareAt(8, 3), squareAt(1, 2))).toBe('nw');

    // Steep southeast: column diff +1, row diff +4 -> 'se'.
    expect(bearingTowards(squareAt(2, 1), squareAt(3, 5))).toBe('se');

    // Steep southwest: column diff -5, row diff +1 -> 'sw'.
    expect(bearingTowards(squareAt(6, 2), squareAt(1, 3))).toBe('sw');

    // Bearing degrees should match compass clockwise angles from north.
    expect(bearingDegrees('n')).toBe(0);
    expect(bearingDegrees('ne')).toBe(45);
    expect(bearingDegrees('e')).toBe(90);
    expect(bearingDegrees('se')).toBe(135);
    expect(bearingDegrees('s')).toBe(180);
    expect(bearingDegrees('sw')).toBe(225);
    expect(bearingDegrees('w')).toBe(270);
    expect(bearingDegrees('nw')).toBe(315);
  });

  it('wraps stepFrom across every edge and corner, and stepBetween reports wrapped neighbor steps or null', () => {
    // Stepping west from square 0 wraps to column 8 in the same row.
    expect(stepFrom(0, -1, 0)).toBe(8);

    // Stepping north from square 0 wraps to row 6 in the same column.
    expect(stepFrom(0, 0, -1)).toBe(squareAt(0, 6));

    // Corner stepping northwest from 0 wraps on both axes to bottom-right (62).
    expect(stepFrom(0, -1, -1)).toBe(62);

    // Corner stepping southeast from 62 wraps on both axes to top-left (0).
    expect(stepFrom(62, 1, 1)).toBe(0);

    // Stepping east from column 8 wraps to column 0.
    expect(stepFrom(8, 1, 0)).toBe(0);

    // stepBetween returns the wrapped direction between neighbors.
    // From 0 to 8: stepping west (-1, 0) is the shortest neighbour step.
    expect(stepBetween(0, 8)).toEqual({ east: -1, south: 0 });
    expect(stepBetween(8, 0)).toEqual({ east: 1, south: 0 });

    // Diagonal corner neighbors across wrapped edges.
    expect(stepBetween(0, 62)).toEqual({ east: -1, south: -1 });
    expect(stepBetween(62, 0)).toEqual({ east: 1, south: 1 });

    // Direct adjacent non-wrapped neighbors.
    expect(stepBetween(0, 1)).toEqual({ east: 1, south: 0 });
    expect(stepBetween(1, 0)).toEqual({ east: -1, south: 0 });
    expect(stepBetween(0, squareAt(0, 1))).toEqual({ east: 0, south: 1 });

    // Non-neighbors return null.
    expect(stepBetween(0, 2)).toBeNull();
    expect(stepBetween(0, squareAt(0, 2))).toBeNull();
    expect(stepBetween(0, 0)).toBeNull();
  });
});
