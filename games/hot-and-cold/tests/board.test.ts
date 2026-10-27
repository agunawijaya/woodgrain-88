/**
 * Tests for board generation, tile composition, seeded determinism,
 * and clue evaluation for flags, bombs, distances, and arrows.
 */
import { createRng } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import {
  CARTRIDGE_COMPOSITION,
  clueAt,
  generateBoard,
  type Board,
  type SquareKind,
} from '../src/engine/board.ts';
import { bearingTowards, kingDistance, squareAt } from '../src/engine/grid.ts';

describe('board', () => {
  it('generates cartridge composition with 1 flag, 8 bombs, 27 distances, and 28 arrows including the flag square', () => {
    const rng = createRng('fixed-board-seed');
    const board = generateBoard(rng, CARTRIDGE_COMPOSITION, 1);

    expect(board.flags).toHaveLength(1);
    const flagSquare = board.flags[0];
    expect(flagSquare).toBeDefined();
    if (flagSquare !== undefined) {
      expect(board.kinds[flagSquare]).toBe('arrow');
    }

    const bombs = board.kinds.filter((kind) => kind === 'bomb').length;
    const distances = board.kinds.filter((kind) => kind === 'distance').length;
    const arrows = board.kinds.filter((kind) => kind === 'arrow').length;

    expect(bombs).toBe(8);
    expect(distances).toBe(27);
    // 27 non-flag arrow squares plus 1 flag square (which is also an arrow) = 28.
    expect(arrows).toBe(28);
    expect(bombs + distances + arrows).toBe(63);

    // Replay with identical seed yields identical board.
    const replayRng = createRng('fixed-board-seed');
    const replayBoard = generateBoard(replayRng, CARTRIDGE_COMPOSITION, 1);
    expect(board).toEqual(replayBoard);

    // Different seed yields a different board layout.
    const diffRng = createRng('different-seed');
    const diffBoard = generateBoard(diffRng, CARTRIDGE_COMPOSITION, 1);
    expect(board).not.toEqual(diffBoard);
  });

  it('respects a custom composition with 16 bombs and 20 distances', () => {
    const rng = createRng('custom-composition-seed');
    const custom = { bombs: 16, distances: 20 };
    const board = generateBoard(rng, custom, 1);

    const bombs = board.kinds.filter((kind) => kind === 'bomb').length;
    const distances = board.kinds.filter((kind) => kind === 'distance').length;
    const arrows = board.kinds.filter((kind) => kind === 'arrow').length;

    expect(bombs).toBe(16);
    expect(distances).toBe(20);
    expect(arrows).toBe(63 - 16 - 20);
  });

  it('generates two distinct flags neither of which holds a bomb or a distance', () => {
    const rng = createRng('two-flags-seed');
    const board = generateBoard(rng, CARTRIDGE_COMPOSITION, 2);

    expect(board.flags).toHaveLength(2);
    const [flagA, flagB] = board.flags;
    expect(flagA).toBeDefined();
    expect(flagB).toBeDefined();
    expect(flagA).not.toBe(flagB);

    if (flagA !== undefined && flagB !== undefined) {
      expect(board.kinds[flagA]).toBe('arrow');
      expect(board.kinds[flagB]).toBe('arrow');
    }
  });

  it('evaluates clues prioritizing flags over bombs, distances, and arrows, and chooses the nearer of two flags', () => {
    // White-box board where square 10 is marked as a bomb.
    const kinds: SquareKind[] = Array.from({ length: 63 }, () => 'arrow');
    kinds[10] = 'bomb';
    kinds[15] = 'distance';
    kinds[20] = 'arrow';

    const board: Board = { kinds, flags: [10] };

    // When the flag stands on a bomb square, checking it must reveal the flag rather than detonating.
    expect(clueAt(board, 10, [10])).toEqual({ kind: 'flag' });

    // When the flag is elsewhere, the bomb square reads bomb.
    expect(clueAt(board, 10, [30])).toEqual({ kind: 'bomb' });

    // A distance square reads the king distance to the flag.
    const distanceSquare = 15;
    const flagPos = 30;
    expect(clueAt(board, distanceSquare, [flagPos])).toEqual({
      kind: 'distance',
      distance: kingDistance(distanceSquare, flagPos),
    });

    // An arrow square reads the bearing to the flag.
    const arrowSquare = 20;
    expect(clueAt(board, arrowSquare, [flagPos])).toEqual({
      kind: 'arrow',
      bearing: bearingTowards(arrowSquare, flagPos),
    });

    // With two flags, clues point to the nearer flag by king distance.
    // Flag A at (0, 0), Flag B at (8, 6).
    const flagNear = squareAt(0, 0);
    const flagFar = squareAt(8, 6);
    const twoFlags = [flagNear, flagFar];

    // (1, 1) is this board's bomb square, so probe from (2, 1): 2 from flagNear, 6 from flagFar.
    const probeSquareNear = squareAt(2, 1);
    expect(clueAt(board, probeSquareNear, twoFlags)).toEqual({
      kind: 'arrow',
      bearing: bearingTowards(probeSquareNear, flagNear),
    });

    // Probe nearer to flagFar: square at (7, 5).
    const probeSquareFar = squareAt(7, 5);
    kinds[probeSquareFar] = 'distance';
    expect(clueAt(board, probeSquareFar, twoFlags)).toEqual({
      kind: 'distance',
      distance: 1,
    });

    // Tie-breaker: when king distance is equal, clues refer to the first flag.
    const midRowSquare = squareAt(4, 0);
    const tiedFlags = [squareAt(2, 0), squareAt(6, 0)];
    expect(clueAt(board, midRowSquare, tiedFlags)).toEqual({
      kind: 'arrow',
      bearing: 'w',
    });
  });
});
