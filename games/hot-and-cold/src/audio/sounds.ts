/**
 * Hot & Cold's sound palette, synthesised by the kit: one table per look,
 * with the same cue for the same meaning in all three. A step, a check, a
 * distance (its note climbs as the flag gets nearer, so a hunt you can hear
 * gets warmer), an arrow, a bomb, the trip home, a bump and the flag's
 * fanfare. The snowfield crunches and chimes, the tabletop clicks and knocks
 * like wood, the radar pings and hisses.
 */
import type { SoundBank, SoundDef } from '@woodgrain-88/kit';
import type { LookId } from '../look/look.ts';

export type Cue =
  'step' | 'check' | 'distance' | 'arrow' | 'bomb' | 'home' | 'bump' | 'turn' | 'tick' | 'flag';

/** The distance note for a 1: each step further away is two semitones lower. */
export const NEAREST_PITCH = 1;
const SEMITONES_PER_STEP = 2;

/** How much higher than the bank's own distance note a clue of `distance` plays. */
export function distancePitch(distance: number): number {
  return NEAREST_PITCH * 2 ** ((-(distance - 1) * SEMITONES_PER_STEP) / 12);
}

type Palette = Readonly<Record<Cue, SoundDef>>;

const POLAR: Palette = {
  step: { wave: 'noise', freq: [900, 500], duration: 0.07, gain: 0.12, lowpass: 1600 },
  check: [
    { wave: 'noise', freq: [600, 1800], duration: 0.16, gain: 0.14, lowpass: 2600 },
    { wave: 'noise', freq: [300, 200], duration: 0.08, gain: 0.08, delay: 0.1 },
  ],
  distance: [
    { wave: 'triangle', freq: 1046, duration: 0.18, gain: 0.2, envelope: { release: 0.5 } },
    { wave: 'sine', freq: 2093, duration: 0.12, gain: 0.06, envelope: { release: 0.4 } },
  ],
  arrow: [
    { wave: 'triangle', freq: [660, 990], duration: 0.14, gain: 0.16 },
    {
      wave: 'triangle',
      freq: 990,
      duration: 0.12,
      gain: 0.12,
      delay: 0.15,
      envelope: { release: 0.3 },
    },
  ],
  bomb: [
    { wave: 'noise', freq: [1800, 300], duration: 0.5, gain: 0.32, envelope: { release: 0.5 } },
    { wave: 'sine', freq: [110, 40], duration: 0.45, gain: 0.36 },
  ],
  home: { wave: 'noise', freq: [2400, 900], duration: 0.55, gain: 0.1, lowpass: 3000 },
  bump: { wave: 'noise', freq: [380, 160], duration: 0.08, gain: 0.14 },
  turn: { wave: 'triangle', freq: 1318, duration: 0.1, gain: 0.1, envelope: { release: 0.4 } },
  tick: { wave: 'triangle', freq: 1760, duration: 0.03, gain: 0.08 },
  flag: [
    { wave: 'triangle', freq: 784, duration: 0.12, gain: 0.18 },
    { wave: 'triangle', freq: 988, duration: 0.12, gain: 0.18, delay: 0.12 },
    { wave: 'triangle', freq: 1175, duration: 0.12, gain: 0.18, delay: 0.24 },
    {
      wave: 'triangle',
      freq: 1568,
      duration: 0.6,
      gain: 0.22,
      delay: 0.36,
      envelope: { release: 0.8 },
    },
    {
      wave: 'sine',
      freq: 3136,
      duration: 0.5,
      gain: 0.05,
      delay: 0.36,
      vibrato: { cents: 20, rate: 6 },
    },
  ],
};

const TABLETOP: Palette = {
  step: [
    { wave: 'triangle', freq: [520, 380], duration: 0.03, gain: 0.18 },
    { wave: 'noise', freq: 2400, duration: 0.02, gain: 0.06 },
  ],
  check: [
    { wave: 'noise', freq: [3200, 1600], duration: 0.03, gain: 0.14 },
    { wave: 'triangle', freq: [700, 420], duration: 0.05, gain: 0.16, delay: 0.09 },
  ],
  distance: [
    {
      wave: 'sine',
      freq: 784,
      duration: 0.05,
      gain: 0.26,
      envelope: { decay: 0.12, sustain: 0.2, release: 0.35 },
    },
    { wave: 'sine', freq: 3136, duration: 0.02, gain: 0.05 },
  ],
  arrow: [
    { wave: 'sine', freq: 523, duration: 0.05, gain: 0.2, envelope: { release: 0.2 } },
    { wave: 'sine', freq: 784, duration: 0.05, gain: 0.2, delay: 0.1, envelope: { release: 0.3 } },
  ],
  bomb: [
    { wave: 'noise', freq: [2600, 700], duration: 0.12, gain: 0.3 },
    { wave: 'square', freq: [180, 60], duration: 0.16, gain: 0.14, lowpass: 900 },
    { wave: 'sine', freq: [1400, 300], duration: 0.5, gain: 0.1, delay: 0.15 },
  ],
  home: {
    wave: 'sine',
    freq: [1200, 500],
    duration: 0.4,
    gain: 0.1,
    vibrato: { cents: 30, rate: 12 },
  },
  bump: { wave: 'triangle', freq: [300, 220], duration: 0.05, gain: 0.18 },
  turn: [
    { wave: 'sine', freq: 659, duration: 0.05, gain: 0.12, envelope: { release: 0.25 } },
    {
      wave: 'sine',
      freq: 880,
      duration: 0.05,
      gain: 0.12,
      delay: 0.08,
      envelope: { release: 0.3 },
    },
  ],
  tick: { wave: 'triangle', freq: 1200, duration: 0.02, gain: 0.1 },
  flag: [
    { wave: 'sine', freq: 523, duration: 0.06, gain: 0.22, envelope: { release: 0.25 } },
    {
      wave: 'sine',
      freq: 659,
      duration: 0.06,
      gain: 0.22,
      delay: 0.09,
      envelope: { release: 0.25 },
    },
    {
      wave: 'sine',
      freq: 784,
      duration: 0.06,
      gain: 0.22,
      delay: 0.18,
      envelope: { release: 0.25 },
    },
    {
      wave: 'sine',
      freq: 1047,
      duration: 0.06,
      gain: 0.22,
      delay: 0.27,
      envelope: { release: 0.25 },
    },
    {
      wave: 'triangle',
      freq: 1319,
      duration: 0.4,
      gain: 0.2,
      delay: 0.38,
      envelope: { release: 0.7 },
    },
  ],
};

const RADAR: Palette = {
  step: { wave: 'sine', freq: 1500, duration: 0.025, gain: 0.08 },
  check: { wave: 'sine', freq: [900, 1800], duration: 0.08, gain: 0.12 },
  distance: [
    {
      wave: 'sine',
      freq: 880,
      duration: 0.14,
      gain: 0.22,
      envelope: { release: 0.7 },
      vibrato: { cents: 8, rate: 7 },
    },
    {
      wave: 'sine',
      freq: 880,
      duration: 0.08,
      gain: 0.07,
      delay: 0.22,
      envelope: { release: 0.5 },
    },
  ],
  arrow: [
    { wave: 'sine', freq: [700, 1050], duration: 0.18, gain: 0.18 },
    { wave: 'square', freq: 1050, duration: 0.03, gain: 0.04, delay: 0.2, lowpass: 2400 },
  ],
  bomb: [
    { wave: 'noise', freq: [4200, 1800], duration: 0.6, gain: 0.26, envelope: { release: 0.3 } },
    { wave: 'square', freq: [220, 110], duration: 0.3, gain: 0.08, lowpass: 900 },
  ],
  home: { wave: 'sine', freq: [2000, 400], duration: 0.3, gain: 0.08 },
  bump: { wave: 'square', freq: 220, duration: 0.05, gain: 0.06, lowpass: 900 },
  turn: { wave: 'sine', freq: 1175, duration: 0.08, gain: 0.1, envelope: { release: 0.3 } },
  tick: { wave: 'square', freq: 2400, duration: 0.012, gain: 0.04, lowpass: 4000 },
  flag: [
    { wave: 'sine', freq: 1319, duration: 0.1, gain: 0.2, envelope: { release: 0.3 } },
    { wave: 'sine', freq: 1319, duration: 0.1, gain: 0.2, delay: 0.18, envelope: { release: 0.3 } },
    {
      wave: 'sine',
      freq: 1760,
      duration: 0.5,
      gain: 0.24,
      delay: 0.36,
      envelope: { release: 0.9 },
    },
    {
      wave: 'triangle',
      freq: 880,
      duration: 0.5,
      gain: 0.08,
      delay: 0.36,
      envelope: { release: 0.9 },
    },
  ],
};

const PALETTES: Readonly<Record<LookId, Palette>> = {
  polar: POLAR,
  tabletop: TABLETOP,
  radar: RADAR,
};

/** The sound's name in the kit's bank. */
export function cueName(look: LookId, cue: Cue): string {
  return `hc-${look}-${cue}`;
}

/** Every look's sounds, named for the kit's bank. */
export const HOT_COLD_SOUNDS: SoundBank = Object.fromEntries(
  (Object.keys(PALETTES) as LookId[]).flatMap((look) =>
    (Object.keys(PALETTES[look]) as Cue[]).map((cue) => [cueName(look, cue), PALETTES[look][cue]]),
  ),
);
