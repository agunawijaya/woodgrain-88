/**
 * The two ships' colours, the collection's pair: seat 1 orange, seat 2 sky
 * blue, which stay apart for the common kinds of colour blindness; the
 * colour-blind setting swaps in amber and periwinkle, which differ in
 * lightness too. The ships differ in shape as well, so colour is never the
 * only clue.
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
