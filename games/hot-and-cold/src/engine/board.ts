/**
 * A round's field. Every square holds one kind of clue for the whole round:
 * a bomb, a distance or, by default, an arrow. What a distance or an arrow
 * says is worked out at the moment it is checked, against wherever the flag
 * is then, so a moving flag keeps every clue honest. The flag itself is
 * checked before the square's kind, which is why a flag that wanders onto a
 * bomb square is captured safely.
 *
 * The 1978 composition is kept (one flag, 8 bombs, 27 distances, the rest
 * arrows) but the layout is our own: a seeded shuffle, so a daily field is
 * the same for everyone. (In 1978 the whole layout followed from where the
 * flag was; see NOTES.md.)
 */
import type { Rng } from '@woodgrain-88/kit';
import { bearingTowards, kingDistance, SQUARE_COUNT, type Bearing, type Square } from './grid.ts';

export type SquareKind = 'arrow' | 'distance' | 'bomb';

export interface Board {
  readonly kinds: readonly SquareKind[];
  /** Where the flags start; moving flags' later squares live in the round state. */
  readonly flags: readonly Square[];
}

export interface Composition {
  readonly bombs: number;
  readonly distances: number;
}

export const CARTRIDGE_COMPOSITION: Composition = { bombs: 8, distances: 27 };

export type Clue =
  | { readonly kind: 'flag' }
  | { readonly kind: 'bomb' }
  | { readonly kind: 'distance'; readonly distance: number }
  | { readonly kind: 'arrow'; readonly bearing: Bearing };

/** Flag squares are drawn first and are never bombs or distances: they hold arrows, as in 1978. */
export function generateBoard(
  rng: Rng,
  composition: Composition = CARTRIDGE_COMPOSITION,
  flagCount = 1,
): Board {
  const order = rng.shuffle(Array.from({ length: SQUARE_COUNT }, (_, square) => square));
  const flags = order.slice(0, flagCount);
  const kinds: SquareKind[] = Array.from({ length: SQUARE_COUNT }, () => 'arrow');
  order.slice(flagCount).forEach((square, place) => {
    if (place < composition.bombs) kinds[square] = 'bomb';
    else if (place < composition.bombs + composition.distances) kinds[square] = 'distance';
  });
  return { kinds, flags };
}

/**
 * What checking `square` shows while the flags stand on `flags`. With two flags, clues point to
 * the nearer one (by king distance; on a tie, the first).
 */
export function clueAt(board: Board, square: Square, flags: readonly Square[]): Clue {
  if (flags.includes(square)) return { kind: 'flag' };
  const kind = board.kinds[square] ?? 'arrow';
  if (kind === 'bomb') return { kind: 'bomb' };
  const target = nearestFlag(square, flags);
  if (kind === 'distance') return { kind: 'distance', distance: kingDistance(square, target) };
  return { kind: 'arrow', bearing: bearingTowards(square, target) };
}

function nearestFlag(square: Square, flags: readonly Square[]): Square {
  let best = flags[0] ?? square;
  for (const flag of flags) {
    if (kingDistance(square, flag) < kingDistance(square, best)) best = flag;
  }
  return best;
}
