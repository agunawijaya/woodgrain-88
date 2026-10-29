/**
 * Tests for reachable-space flood fill: exact pocket counts, breadth-first cell
 * ordering, diagonal corner slips under 8-way vs 4-way steering, wraparound edges,
 * and limit capping.
 */
import { describe, expect, it } from 'vitest';
import { cellAt } from '../../src/engine/grid.ts';
import { createMatch, startMatch } from '../../src/engine/match.ts';
import { openSpace, pocketCells } from '../../src/engine/space.ts';
import { CELL_COUNT, COLUMNS, ROWS } from '../../src/engine/types.ts';
import { variationRules } from '../../src/engine/variations.ts';

function sealBox(cells: Int8Array, left: number, top: number, right: number, bottom: number): void {
  for (let col = left; col <= right; col++) {
    cells[cellAt(col, top)] = 0;
    cells[cellAt(col, bottom)] = 0;
  }
  for (let row = top; row <= bottom; row++) {
    cells[cellAt(left, row)] = 0;
    cells[cellAt(right, row)] = 0;
  }
}

describe('space', () => {
  it('counts a sealed pocket of known size exactly and excludes the origin cell', () => {
    const match = createMatch({
      rules: variationRules(1),
      players: 2,
      switches: ['B', 'B'],
      target: 10,
    });
    startMatch(match);

    // Seal a 5x4 box whose interior is columns 5..7 (3 wide) by rows 5..6 (2 tall) = 6 cells.
    sealBox(match.cells, 4, 4, 8, 7);
    const origin = cellAt(5, 5);

    // Origin is one of the 6 interior cells, so 5 other empty cells are reachable.
    expect(openSpace(match, origin, 100)).toBe(5);
    const pocket = pocketCells(match, origin, 100);
    expect(pocket).toHaveLength(5);
    expect(pocket).not.toContain(origin);
    expect(new Set(pocket).size).toBe(5);

    // First-ring cardinal neighbours of (5, 5) come before distance-2 cell (7, 6).
    expect(pocket.slice(0, 2).sort((a, b) => a - b)).toEqual(
      [cellAt(5, 6), cellAt(6, 5)].sort((a, b) => a - b),
    );
    expect(pocket[pocket.length - 1]).toBe(cellAt(7, 6));
  });

  it('slips diagonally between two corner-touching trail cells under 8-way steering but not 4-way', () => {
    const match4 = createMatch({
      rules: variationRules(1), // 4-way
      players: 2,
      switches: ['B', 'B'],
      target: 10,
    });
    startMatch(match4);

    const match8 = createMatch({
      rules: variationRules(5), // 8-way
      players: 2,
      switches: ['B', 'B'],
      target: 10,
    });
    startMatch(match8);

    // Seal a box around (5..6, 5..6) (4 interior cells), then place trail blocks at
    // (6, 5) and (5, 6) so (5, 5) and (6, 6) touch only diagonally at their corner.
    for (const m of [match4, match8]) {
      sealBox(m.cells, 4, 4, 7, 7);
      m.cells[cellAt(6, 5)] = 0;
      m.cells[cellAt(5, 6)] = 0;
    }

    const origin = cellAt(5, 5);
    expect(openSpace(match4, origin, 10)).toBe(0);
    expect(pocketCells(match4, origin, 10)).toEqual([]);

    expect(openSpace(match8, origin, 10)).toBe(1);
    expect(pocketCells(match8, origin, 10)).toEqual([cellAt(6, 6)]);
  });

  it('joins opposite edges in wraparound arenas and stops at edges in bordered arenas', () => {
    const wrapMatch = createMatch({
      rules: variationRules(8), // wraparound, 4-way
      players: 2,
      switches: ['B', 'B'],
      target: 10,
    });
    startMatch(wrapMatch);

    // Fill the entire board with trail except (0, 5) and (39, 5).
    wrapMatch.cells.fill(0);
    wrapMatch.cells[cellAt(0, 5)] = -1;
    wrapMatch.cells[cellAt(COLUMNS - 1, 5)] = -1;

    expect(openSpace(wrapMatch, cellAt(0, 5), 10)).toBe(1);
    expect(pocketCells(wrapMatch, cellAt(0, 5), 10)).toEqual([cellAt(COLUMNS - 1, 5)]);

    const borderedMatch = createMatch({
      rules: variationRules(1), // bordered, 4-way
      players: 2,
      switches: ['B', 'B'],
      target: 10,
    });
    startMatch(borderedMatch);
    borderedMatch.cells.fill(0);
    borderedMatch.cells[cellAt(0, 5)] = -1;
    borderedMatch.cells[cellAt(COLUMNS - 1, 5)] = -1;

    expect(openSpace(borderedMatch, cellAt(0, 5), 10)).toBe(0);
    expect(pocketCells(borderedMatch, cellAt(0, 5), 10)).toEqual([]);
  });

  it('caps the count and returned cell list at limit', () => {
    const match = createMatch({
      rules: variationRules(1),
      players: 2,
      switches: ['B', 'B'],
      target: 10,
    });
    startMatch(match);

    const origin = cellAt(10, 10);
    expect(openSpace(match, origin, 0)).toBe(0);
    expect(pocketCells(match, origin, 0)).toEqual([]);

    expect(openSpace(match, origin, 12)).toBe(12);
    expect(pocketCells(match, origin, 12)).toHaveLength(12);

    // Full bordered interior has 684 cells; excluding origin leaves 683.
    expect(openSpace(match, origin, CELL_COUNT)).toBe((COLUMNS - 2) * (ROWS - 2) - 1);
  });
});
