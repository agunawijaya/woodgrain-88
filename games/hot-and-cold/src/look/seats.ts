/**
 * The two seats' colours, shared with the rest of the collection: seat 1 is
 * orange and seat 2 sky blue, a pair that stays apart for the common kinds of
 * colour blindness; the colour-blind setting swaps in amber and periwinkle,
 * which differ in lightness as well as hue.
 */
import type { SeatColours } from './look.ts';

export type SeatPalette = 'standard' | 'colour-blind';

const PALETTES: Readonly<Record<SeatPalette, readonly [SeatColours, SeatColours]>> = {
  standard: [
    { main: '#ff8a2a', deep: '#b4501b' },
    { main: '#38a8ff', deep: '#1d68ad' },
  ],
  'colour-blind': [
    { main: '#ffb000', deep: '#a66f00' },
    { main: '#648fff', deep: '#3555b0' },
  ],
};

export function seatColours(
  palette: SeatPalette = 'standard',
): readonly [SeatColours, SeatColours] {
  return PALETTES[palette];
}
