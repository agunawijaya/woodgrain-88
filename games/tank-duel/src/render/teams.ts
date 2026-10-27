/**
 * The two sides' colours. Each tank is painted like a miniature (olive or
 * desert) and carries a bright trim in its team colour; aircraft are painted
 * in it. The standard trims are an orange and a sky blue, a pair that stays
 * distinct for the common kinds of colour blindness; the colour-blind-safe
 * setting swaps them for an amber and a deep periwinkle that differ in
 * lightness as well as hue.
 */
import type { AircraftLook } from './models/biplane.ts';
import type { TankLook } from './models/tank.ts';

export type TeamPalette = 'standard' | 'colour-blind';

export interface TeamColours {
  readonly tanks: readonly [TankLook, TankLook];
  readonly aircraft: readonly [AircraftLook, AircraftLook];
  /** The score plates' colours. */
  readonly plates: readonly [string, string];
}

const PALETTES: Readonly<Record<TeamPalette, TeamColours>> = {
  standard: {
    tanks: [
      { paint: '#58673a', trim: '#ff8a2a' },
      { paint: '#bf8442', trim: '#38a8ff' },
    ],
    aircraft: [
      { body: '#efe4c8', trim: '#ff6418' },
      { body: '#b8d8f0', trim: '#22aef0' },
    ],
    plates: ['#ff8a2a', '#38a8ff'],
  },
  'colour-blind': {
    tanks: [
      { paint: '#58673a', trim: '#ffb000' },
      { paint: '#bf8442', trim: '#5a7dff' },
    ],
    aircraft: [
      { body: '#efe4c8', trim: '#ffb000' },
      { body: '#dbe2f5', trim: '#5a7dff' },
    ],
    plates: ['#ffb000', '#648fff'],
  },
};

export function teamColours(palette: TeamPalette = 'standard'): TeamColours {
  return PALETTES[palette];
}
