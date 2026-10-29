/**
 * The two seats' colours, the same pair as the rest of the collection: seat 1
 * is orange and seat 2 sky blue, which stay apart for the common kinds of
 * colour blindness; the colour-blind setting swaps in amber and periwinkle,
 * which differ in lightness as well as hue. Shape and pattern tell the riders
 * apart too, in every look, so colour is never the only clue.
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

/**
 * Four Way's two extra riders, in the other corners: green and magenta, apart from orange and
 * blue and from each other; the colour-blind set keeps to hues that stay distinct for the common
 * kinds. Each rider also has its own shape mark, so colour is never the only clue.
 */
const EXTRA_RIDERS: Readonly<Record<SeatPalette, readonly [SeatColours, SeatColours]>> = {
  standard: [
    { main: '#2fbf71', deep: '#1b7a47' },
    { main: '#e05aa8', deep: '#94306b' },
  ],
  'colour-blind': [
    { main: '#dc267f', deep: '#8f164f' },
    { main: '#9c8cf0', deep: '#5546a8' },
  ],
};

/** All four riders' colours, for Four Way: the duel's two, then the corners' two. */
export function fourWayColours(palette: SeatPalette = 'standard'): readonly SeatColours[] {
  return [...PALETTES[palette], ...EXTRA_RIDERS[palette]];
}
