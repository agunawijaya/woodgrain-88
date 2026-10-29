/**
 * Tests for Trailblaze Doodle board packing: compact URL-safe base64 encoding
 * and decoding, corrupt string rejection, and non-border filled percent calculation.
 */
import { describe, expect, it } from 'vitest';
import { createRng } from '@woodgrain-88/kit';
import { isBorderCell } from '../../src/engine/grid.ts';
import { BORDER, CELL_COUNT, EMPTY } from '../../src/engine/types.ts';
import { decodeBoard, encodeBoard, filledPercent } from '../../src/doodle/board.ts';

describe('Doodle board packing', () => {
  describe('encodeBoard and decodeBoard round-trips', () => {
    it('round-trips an empty board (all EMPTY cells)', () => {
      const cells = new Int8Array(CELL_COUNT).fill(EMPTY);
      const encoded = encodeBoard(cells);

      expect(typeof encoded).toBe('string');
      // 800 cells * 2 bits = 1600 bits packed into 6-bit URL-safe chars -> 267 chars
      expect(encoded).toHaveLength(267);

      const decoded = decodeBoard(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded).toEqual(cells);
    });

    it('round-trips a bordered board (perimeter BORDER, interior EMPTY)', () => {
      const cells = new Int8Array(CELL_COUNT);
      for (let c = 0; c < CELL_COUNT; c++) {
        cells[c] = isBorderCell(c) ? BORDER : EMPTY;
      }

      const encoded = encodeBoard(cells);
      expect(encoded).toHaveLength(267);

      const decoded = decodeBoard(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded).toEqual(cells);
    });

    it('round-trips a seeded random board with all 4 cell states', () => {
      const rng = createRng(19881029);
      const cells = new Int8Array(CELL_COUNT);
      const states = [EMPTY, BORDER, 0, 1] as const;

      for (let c = 0; c < CELL_COUNT; c++) {
        const choice = rng.int(0, states.length - 1);
        cells[c] = states[choice] ?? EMPTY;
      }

      const encoded = encodeBoard(cells);
      const decoded = decodeBoard(encoded);

      expect(decoded).not.toBeNull();
      expect(decoded).toEqual(cells);
    });
  });

  describe('decodeBoard rejection of invalid input', () => {
    it('rejects strings with wrong length', () => {
      expect(decodeBoard('')).toBeNull();
      expect(decodeBoard('abc')).toBeNull();
      // 266 chars (1 short) and 268 chars (1 too long)
      expect(decodeBoard('A'.repeat(266))).toBeNull();
      expect(decodeBoard('A'.repeat(268))).toBeNull();
    });

    it('rejects strings containing characters outside the URL-safe base64 alphabet', () => {
      const valid = encodeBoard(new Int8Array(CELL_COUNT).fill(EMPTY));
      expect(decodeBoard(valid)).not.toBeNull();

      // Replace first character with illegal chars (+, /, @, !, space)
      const invalidChars = ['+', '/', '@', '!', ' ', '=', '#'];
      for (const char of invalidChars) {
        const corrupted = char + valid.slice(1);
        expect(decodeBoard(corrupted)).toBeNull();
      }
    });

    it('rejects strings where unused padding bits in the final character are non-zero', () => {
      const valid = encodeBoard(new Int8Array(CELL_COUNT).fill(EMPTY));
      // In a 267-char string encoding 800 cells (1600 bits), the last character holds 2 cells (4 bits).
      // The lower 2 bits must be zero. If modified so lower bits are 1, it must be rejected.
      // 'B' in base64 is index 1 (binary 000001, lowest 2 bits are 01)
      const corrupted = valid.slice(0, 266) + 'B';
      expect(decodeBoard(corrupted)).toBeNull();
    });
  });

  describe('filledPercent', () => {
    it('returns 0 on an empty board and on a bordered board with no trails', () => {
      const empty = new Int8Array(CELL_COUNT).fill(EMPTY);
      expect(filledPercent(empty)).toBe(0);

      const bordered = new Int8Array(CELL_COUNT);
      for (let c = 0; c < CELL_COUNT; c++) {
        bordered[c] = isBorderCell(c) ? BORDER : EMPTY;
      }
      expect(filledPercent(bordered)).toBe(0);
    });

    it('calculates the share of non-border cells holding trail, rounded down', () => {
      const cells = new Int8Array(CELL_COUNT);
      for (let c = 0; c < CELL_COUNT; c++) {
        cells[c] = isBorderCell(c) ? BORDER : EMPTY;
      }
      // Non-border cells = 684.
      // Place 68 trail cells: 68 / 684 * 100 = 9.9415% -> 9%
      let laid = 0;
      for (let c = 0; c < CELL_COUNT && laid < 68; c++) {
        if (!isBorderCell(c)) {
          cells[c] = laid % 2 === 0 ? 0 : 1;
          laid++;
        }
      }
      expect(filledPercent(cells)).toBe(9);

      // Place 342 trail cells: 342 / 684 * 100 = 50%
      for (let c = 0; c < CELL_COUNT && laid < 342; c++) {
        if (!isBorderCell(c) && cells[c] === EMPTY) {
          cells[c] = laid % 2 === 0 ? 0 : 1;
          laid++;
        }
      }
      expect(filledPercent(cells)).toBe(50);

      // Fill all 684 non-border cells: 100%
      for (let c = 0; c < CELL_COUNT; c++) {
        if (!isBorderCell(c)) {
          cells[c] = 0;
        }
      }
      expect(filledPercent(cells)).toBe(100);
    });

    it('works on a wraparound arena where no cells are border', () => {
      // 800 non-border cells. Place 200 trail cells -> 25%
      const wrap = new Int8Array(CELL_COUNT).fill(EMPTY);
      for (let c = 0; c < 200; c++) {
        wrap[c] = 0;
      }
      expect(filledPercent(wrap)).toBe(25);
    });
  });
});
