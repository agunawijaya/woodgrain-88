/**
 * Tests for the 40x20 arena grid: coordinate round-tripping, edge and corner
 * wraparound arithmetic, perimeter border identification, and starting positions.
 */
import { describe, expect, it } from 'vitest';
import { START, cellAt, columnOf, isBorderCell, rowOf, stepFrom } from '../../src/engine/grid.ts';
import { CELL_COUNT, COLUMNS, ROWS } from '../../src/engine/types.ts';

describe('grid', () => {
  it('round-trips all 800 cells between (column, row) and cell index', () => {
    expect(CELL_COUNT).toBe(800);
    let count = 0;
    for (let row = 0; row < ROWS; row++) {
      for (let column = 0; column < COLUMNS; column++) {
        const cell = cellAt(column, row);
        expect(cell).toBe(count);
        expect(columnOf(cell)).toBe(column);
        expect(rowOf(cell)).toBe(row);
        count++;
      }
    }
    expect(count).toBe(CELL_COUNT);
  });

  it('steps inside the arena without wrapping and wraps across all four edges and corners', () => {
    const centre = cellAt(20, 10);
    expect(stepFrom(centre, 'right')).toEqual({ cell: cellAt(21, 10), wrapped: false });
    expect(stepFrom(centre, 'left')).toEqual({ cell: cellAt(19, 10), wrapped: false });
    expect(stepFrom(centre, 'up')).toEqual({ cell: cellAt(20, 9), wrapped: false });
    expect(stepFrom(centre, 'down')).toEqual({ cell: cellAt(20, 11), wrapped: false });
    expect(stepFrom(centre, 'up-left')).toEqual({ cell: cellAt(19, 9), wrapped: false });
    expect(stepFrom(centre, 'down-right')).toEqual({ cell: cellAt(21, 11), wrapped: false });

    // Four cardinal edge wraps
    expect(stepFrom(cellAt(0, 7), 'left')).toEqual({
      cell: cellAt(COLUMNS - 1, 7),
      wrapped: true,
    });
    expect(stepFrom(cellAt(COLUMNS - 1, 7), 'right')).toEqual({
      cell: cellAt(0, 7),
      wrapped: true,
    });
    expect(stepFrom(cellAt(15, 0), 'up')).toEqual({
      cell: cellAt(15, ROWS - 1),
      wrapped: true,
    });
    expect(stepFrom(cellAt(15, ROWS - 1), 'down')).toEqual({
      cell: cellAt(15, 0),
      wrapped: true,
    });

    // Four diagonal corner wraps
    expect(stepFrom(cellAt(0, 0), 'up-left')).toEqual({
      cell: cellAt(COLUMNS - 1, ROWS - 1),
      wrapped: true,
    });
    expect(stepFrom(cellAt(COLUMNS - 1, 0), 'up-right')).toEqual({
      cell: cellAt(0, ROWS - 1),
      wrapped: true,
    });
    expect(stepFrom(cellAt(0, ROWS - 1), 'down-left')).toEqual({
      cell: cellAt(COLUMNS - 1, 0),
      wrapped: true,
    });
    expect(stepFrom(cellAt(COLUMNS - 1, ROWS - 1), 'down-right')).toEqual({
      cell: cellAt(0, 0),
      wrapped: true,
    });
  });

  it('marks the 116 perimeter cells as border and the 684 interior cells as open', () => {
    let borderCount = 0;
    let interiorCount = 0;
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      const col = columnOf(cell);
      const row = rowOf(cell);
      const onEdge = row === 0 || row === ROWS - 1 || col === 0 || col === COLUMNS - 1;
      expect(isBorderCell(cell)).toBe(onEdge);
      if (onEdge) {
        borderCount++;
      } else {
        interiorCount++;
      }
    }
    expect(borderCount).toBe(116);
    expect(interiorCount).toBe(684);
  });

  it('places seat 0 at (10, 10) facing right and seat 1 at (30, 10) facing left', () => {
    expect(START[0]).toEqual({ cell: cellAt(10, 10), heading: 'right' });
    expect(START[1]).toEqual({ cell: cellAt(30, 10), heading: 'left' });
  });
});
