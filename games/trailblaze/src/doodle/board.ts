/**
 * Packing and unpacking Trailblaze arena boards for Doodle save slots
 * and URLs: compact URL-safe base64 encoding (2 bits per cell, 267 chars),
 * and non-border trail fill calculations.
 */
import { BORDER, CELL_COUNT, EMPTY, type CellContent } from '../engine/types.ts';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const LOOKUP: readonly number[] = (() => {
  const table = new Array<number>(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) {
    table[ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

function cellToBits(value: number): number {
  switch (value) {
    case EMPTY:
      return 0;
    case BORDER:
      return 1;
    case 0:
      return 2;
    case 1:
      return 3;
    default:
      return 0;
  }
}

function bitsToCell(bits: number): CellContent {
  switch (bits) {
    case 0:
      return EMPTY;
    case 1:
      return BORDER;
    case 2:
      return 0;
    case 3:
      return 1;
    default:
      return EMPTY;
  }
}

/** Packs CELL_COUNT cell contents (EMPTY, BORDER, seat 0, seat 1) into a short ASCII string. */
export function encodeBoard(cells: Int8Array): string {
  const chars: string[] = [];

  // Each URL-safe base64 character stores 6 bits (3 cells at 2 bits each).
  // 800 cells = 266 triplets (798 cells) + 1 final pair (2 cells, 4 bits + 2 zero-padding bits).
  for (let i = 0; i < 798; i += 3) {
    const c0 = cells[i] ?? EMPTY;
    const c1 = cells[i + 1] ?? EMPTY;
    const c2 = cells[i + 2] ?? EMPTY;
    const b0 = cellToBits(c0);
    const b1 = cellToBits(c1);
    const b2 = cellToBits(c2);
    const index = (b0 << 4) | (b1 << 2) | b2;
    chars.push(ALPHABET[index] ?? 'A');
  }

  const c798 = cells[798] ?? EMPTY;
  const c799 = cells[799] ?? EMPTY;
  const b0 = cellToBits(c798);
  const b1 = cellToBits(c799);
  const lastIndex = (b0 << 4) | (b1 << 2);
  chars.push(ALPHABET[lastIndex] ?? 'A');

  return chars.join('');
}

/** The reverse; null for a string that is not a packed board. */
export function decodeBoard(text: string): Int8Array | null {
  if (text.length !== 267) {
    return null;
  }

  const out = new Int8Array(CELL_COUNT);
  let cellIndex = 0;

  for (let i = 0; i < 266; i++) {
    const code = text.charCodeAt(i);
    if (code >= 128) return null;
    const val = LOOKUP[code];
    if (val === undefined || val < 0) return null;

    out[cellIndex++] = bitsToCell((val >> 4) & 3);
    out[cellIndex++] = bitsToCell((val >> 2) & 3);
    out[cellIndex++] = bitsToCell(val & 3);
  }

  const lastCode = text.charCodeAt(266);
  if (lastCode >= 128) return null;
  const lastVal = LOOKUP[lastCode];
  if (lastVal === undefined || lastVal < 0) return null;

  // The lowest 2 bits are unused padding and must be zero.
  if ((lastVal & 3) !== 0) {
    return null;
  }

  out[798] = bitsToCell((lastVal >> 4) & 3);
  out[799] = bitsToCell((lastVal >> 2) & 3);

  return out;
}

/** Share of the non-border cells holding trail, 0–100, rounded down. */
export function filledPercent(cells: Int8Array): number {
  let trailCount = 0;
  let nonBorderCount = 0;

  for (const content of cells) {
    if (content !== BORDER) {
      nonBorderCount++;
      if (content === 0 || content === 1) {
        trailCount++;
      }
    }
  }

  if (nonBorderCount === 0) {
    return 0;
  }

  return Math.floor((trailCount / nonBorderCount) * 100);
}
