/**
 * Gravity Duel's sound, synthesised by the kit: one palette per look, the
 * same cue meaning the same thing in all four. Each ship's engine sounds only
 * while it thrusts, and the two engines are pitched apart, a fourth, as the
 * cartridge gave each player's rumble its own note. A shot, a hit, the cloak
 * coming on and off, the last fuel, a dock, the star taking a missile, a
 * homecoming and the clock's warning each have a sound of their own.
 */
import type { HeldVoice, SoundDef } from '@woodgrain-88/kit';
import type { LookId } from '../look/look.ts';

export type Cue =
  | 'fire'
  | 'hit'
  | 'swallow'
  | 'refuel'
  | 'cloak-on'
  | 'cloak-off'
  | 'low-fuel'
  | 'dock'
  | 'reload'
  | 'warning'
  | 'point'
  | 'win'
  | 'count'
  | 'go';

export interface LookSound {
  readonly cues: Readonly<Record<Cue, SoundDef>>;
  /** Seat 0's engine at full thrust; seat 1 plays it ENGINE_INTERVAL higher. */
  readonly engine: readonly HeldVoice[];
}

/** Seat 1's engine sits a fourth above seat 0's, so the two ships are told apart by ear. */
export const ENGINE_INTERVAL = 4 / 3;

const COUNT: SoundDef = { wave: 'square', freq: 660, duration: 0.08, gain: 0.08, lowpass: 3000 };
const GO: SoundDef = { wave: 'square', freq: 1320, duration: 0.22, gain: 0.1, lowpass: 4000 };

const DEEP: LookSound = {
  engine: [
    { wave: 'sawtooth', freq: 62, gain: 0.07, lowpass: 380, vibrato: { cents: 8, rate: 7 } },
    { wave: 'noise', freq: 900, gain: 0.03, lowpass: 1400 },
  ],
  cues: {
    fire: { wave: 'sine', freq: [1700, 420], duration: 0.14, gain: 0.12 },
    hit: [
      { wave: 'noise', freq: [3600, 180], duration: 0.6, gain: 0.32, envelope: { release: 0.5 } },
      { wave: 'sine', freq: [180, 34], duration: 0.55, gain: 0.34 },
      { wave: 'square', freq: [990, 120], duration: 0.2, gain: 0.05, lowpass: 2200 },
    ],
    swallow: [
      { wave: 'noise', freq: [600, 90], duration: 0.5, gain: 0.16, lowpass: 900 },
      { wave: 'sine', freq: [140, 60], duration: 0.45, gain: 0.14 },
    ],
    refuel: [
      { wave: 'triangle', freq: 523, duration: 0.07, gain: 0.12 },
      { wave: 'triangle', freq: 784, duration: 0.07, gain: 0.12, delay: 0.07 },
      { wave: 'triangle', freq: 1046, duration: 0.16, gain: 0.13, delay: 0.14 },
    ],
    'cloak-on': {
      wave: 'sine',
      freq: [880, 2400],
      duration: 0.35,
      gain: 0.08,
      vibrato: { cents: 40, rate: 18 },
    },
    'cloak-off': {
      wave: 'sine',
      freq: [2400, 880],
      duration: 0.3,
      gain: 0.08,
      vibrato: { cents: 40, rate: 18 },
    },
    'low-fuel': [
      { wave: 'square', freq: 1175, duration: 0.07, gain: 0.07, lowpass: 3000 },
      { wave: 'square', freq: 1175, duration: 0.07, gain: 0.07, lowpass: 3000, delay: 0.14 },
    ],
    dock: [
      { wave: 'sine', freq: 1318, duration: 0.12, gain: 0.14 },
      { wave: 'sine', freq: 1976, duration: 0.3, gain: 0.12, delay: 0.1 },
    ],
    reload: { wave: 'square', freq: [300, 900], duration: 0.18, gain: 0.07, lowpass: 2000 },
    warning: [
      { wave: 'square', freq: 880, duration: 0.09, gain: 0.08, lowpass: 2500 },
      { wave: 'square', freq: 880, duration: 0.09, gain: 0.08, lowpass: 2500, delay: 0.18 },
      { wave: 'square', freq: 880, duration: 0.09, gain: 0.08, lowpass: 2500, delay: 0.36 },
    ],
    point: [
      { wave: 'triangle', freq: 1046, duration: 0.08, gain: 0.13 },
      { wave: 'triangle', freq: 1568, duration: 0.14, gain: 0.13, delay: 0.08 },
    ],
    win: [
      { wave: 'triangle', freq: 523, duration: 0.12, gain: 0.15 },
      { wave: 'triangle', freq: 659, duration: 0.12, gain: 0.15, delay: 0.12 },
      { wave: 'triangle', freq: 784, duration: 0.12, gain: 0.15, delay: 0.24 },
      { wave: 'triangle', freq: 1046, duration: 0.45, gain: 0.17, delay: 0.36 },
    ],
    count: COUNT,
    go: GO,
  },
};

const BRASS: LookSound = {
  // Clockwork: a whirring spring and the tick of an escapement.
  engine: [
    { wave: 'triangle', freq: 110, gain: 0.05, vibrato: { cents: 25, rate: 14 } },
    { wave: 'noise', freq: 2400, gain: 0.025, lowpass: 3200 },
  ],
  cues: {
    fire: [
      { wave: 'triangle', freq: 2093, duration: 0.05, gain: 0.12 },
      { wave: 'noise', freq: 5000, duration: 0.03, gain: 0.05, lowpass: 7000 },
    ],
    hit: [
      { wave: 'noise', freq: [2600, 400], duration: 0.4, gain: 0.26, envelope: { release: 0.3 } },
      { wave: 'triangle', freq: [660, 330], duration: 0.3, gain: 0.16 },
      { wave: 'square', freq: 1760, duration: 0.04, gain: 0.05, delay: 0.1, lowpass: 3000 },
      { wave: 'square', freq: 1480, duration: 0.04, gain: 0.05, delay: 0.18, lowpass: 3000 },
    ],
    swallow: { wave: 'noise', freq: [7000, 2000], duration: 0.35, gain: 0.08, lowpass: 8000 },
    refuel: [
      { wave: 'noise', freq: 3000, duration: 0.03, gain: 0.06 },
      { wave: 'noise', freq: 3000, duration: 0.03, gain: 0.06, delay: 0.06 },
      { wave: 'noise', freq: 3000, duration: 0.03, gain: 0.06, delay: 0.12 },
      { wave: 'sine', freq: 1568, duration: 0.35, gain: 0.1, delay: 0.18 },
    ],
    'cloak-on': [
      { wave: 'sine', freq: 2637, duration: 0.08, gain: 0.07 },
      { wave: 'sine', freq: 2093, duration: 0.08, gain: 0.07, delay: 0.08 },
      { wave: 'sine', freq: 1760, duration: 0.14, gain: 0.07, delay: 0.16 },
    ],
    'cloak-off': [
      { wave: 'sine', freq: 1760, duration: 0.08, gain: 0.07 },
      { wave: 'sine', freq: 2093, duration: 0.08, gain: 0.07, delay: 0.08 },
      { wave: 'sine', freq: 2637, duration: 0.14, gain: 0.07, delay: 0.16 },
    ],
    'low-fuel': [
      { wave: 'triangle', freq: 784, duration: 0.12, gain: 0.1 },
      { wave: 'triangle', freq: 659, duration: 0.18, gain: 0.1, delay: 0.16 },
    ],
    dock: [
      { wave: 'sine', freq: 1568, duration: 0.5, gain: 0.12, envelope: { release: 0.6 } },
      { wave: 'sine', freq: 2349, duration: 0.4, gain: 0.06, envelope: { release: 0.5 } },
    ],
    reload: [
      { wave: 'noise', freq: 2400, duration: 0.03, gain: 0.07 },
      { wave: 'noise', freq: 2000, duration: 0.03, gain: 0.07, delay: 0.05 },
    ],
    warning: [
      { wave: 'sine', freq: 988, duration: 0.25, gain: 0.1, envelope: { release: 0.4 } },
      {
        wave: 'sine',
        freq: 784,
        duration: 0.35,
        gain: 0.1,
        delay: 0.3,
        envelope: { release: 0.5 },
      },
    ],
    point: [
      { wave: 'sine', freq: 1318, duration: 0.1, gain: 0.12 },
      { wave: 'sine', freq: 1976, duration: 0.25, gain: 0.1, delay: 0.1 },
    ],
    win: [
      { wave: 'sine', freq: 784, duration: 0.2, gain: 0.12 },
      { wave: 'sine', freq: 988, duration: 0.2, gain: 0.12, delay: 0.2 },
      { wave: 'sine', freq: 1175, duration: 0.2, gain: 0.12, delay: 0.4 },
      { wave: 'sine', freq: 1568, duration: 0.6, gain: 0.14, delay: 0.6 },
    ],
    count: COUNT,
    go: GO,
  },
};

const PAPER: LookSound = {
  // A child making a rocket noise: a wobbly "brrr".
  engine: [
    { wave: 'sawtooth', freq: 90, gain: 0.06, lowpass: 600, vibrato: { cents: 60, rate: 11 } },
  ],
  cues: {
    fire: { wave: 'square', freq: [1400, 500], duration: 0.12, gain: 0.08, lowpass: 3000 },
    hit: [
      { wave: 'noise', freq: [1800, 200], duration: 0.5, gain: 0.26, envelope: { release: 0.4 } },
      { wave: 'square', freq: [300, 60], duration: 0.4, gain: 0.1, lowpass: 900 },
    ],
    swallow: [
      { wave: 'sine', freq: [500, 200], duration: 0.12, gain: 0.14 },
      { wave: 'sine', freq: [200, 420], duration: 0.12, gain: 0.12, delay: 0.12 },
    ],
    refuel: {
      wave: 'sine',
      freq: [500, 1500],
      duration: 0.4,
      gain: 0.1,
      vibrato: { cents: 15, rate: 6 },
    },
    'cloak-on': { wave: 'noise', freq: 6000, duration: 0.25, gain: 0.06, lowpass: 9000 },
    'cloak-off': { wave: 'noise', freq: 4000, duration: 0.2, gain: 0.06, lowpass: 7000 },
    'low-fuel': {
      wave: 'sawtooth',
      freq: [330, 300],
      duration: 0.3,
      gain: 0.06,
      lowpass: 1500,
      vibrato: { cents: 50, rate: 9 },
    },
    dock: [
      { wave: 'triangle', freq: 1046, duration: 0.1, gain: 0.14 },
      { wave: 'triangle', freq: 1318, duration: 0.1, gain: 0.14, delay: 0.1 },
      { wave: 'triangle', freq: 1568, duration: 0.2, gain: 0.14, delay: 0.2 },
    ],
    reload: { wave: 'square', freq: [600, 1200], duration: 0.12, gain: 0.06, lowpass: 2500 },
    warning: [
      { wave: 'triangle', freq: 1760, duration: 0.08, gain: 0.1 },
      { wave: 'triangle', freq: 1760, duration: 0.08, gain: 0.1, delay: 0.16 },
    ],
    point: [
      { wave: 'triangle', freq: 784, duration: 0.08, gain: 0.13 },
      { wave: 'triangle', freq: 1175, duration: 0.14, gain: 0.13, delay: 0.08 },
    ],
    win: [
      { wave: 'square', freq: 523, duration: 0.1, gain: 0.08, lowpass: 2500 },
      { wave: 'square', freq: 659, duration: 0.1, gain: 0.08, lowpass: 2500, delay: 0.1 },
      { wave: 'square', freq: 784, duration: 0.1, gain: 0.08, lowpass: 2500, delay: 0.2 },
      { wave: 'triangle', freq: 1046, duration: 0.4, gain: 0.16, delay: 0.3 },
    ],
    count: COUNT,
    go: GO,
  },
};

const WHIRL: LookSound = {
  // A propeller under water, and the hiss of bubbles.
  engine: [
    { wave: 'triangle', freq: 70, gain: 0.07, vibrato: { cents: 12, rate: 16 } },
    { wave: 'noise', freq: 500, gain: 0.03, lowpass: 900 },
  ],
  cues: {
    fire: [
      { wave: 'sine', freq: [220, 90], duration: 0.18, gain: 0.16 },
      { wave: 'noise', freq: 1600, duration: 0.25, gain: 0.04, lowpass: 2400, delay: 0.05 },
    ],
    hit: [
      {
        wave: 'noise',
        freq: [900, 120],
        duration: 0.7,
        gain: 0.3,
        lowpass: 1200,
        envelope: { release: 0.6 },
      },
      { wave: 'sine', freq: [120, 30], duration: 0.6, gain: 0.34 },
    ],
    swallow: {
      wave: 'sine',
      freq: [300, 80],
      duration: 0.5,
      gain: 0.12,
      vibrato: { cents: 80, rate: 20 },
    },
    refuel: [
      { wave: 'sine', freq: 988, duration: 0.6, gain: 0.1, envelope: { release: 0.7 } },
      { wave: 'sine', freq: 1482, duration: 0.5, gain: 0.04, envelope: { release: 0.6 } },
    ],
    'cloak-on': {
      wave: 'sine',
      freq: [400, 120],
      duration: 0.4,
      gain: 0.1,
      vibrato: { cents: 60, rate: 22 },
    },
    'cloak-off': {
      wave: 'sine',
      freq: [120, 400],
      duration: 0.35,
      gain: 0.1,
      vibrato: { cents: 60, rate: 22 },
    },
    'low-fuel': [
      { wave: 'sine', freq: 1318, duration: 0.05, gain: 0.1 },
      { wave: 'sine', freq: 1318, duration: 0.05, gain: 0.06, delay: 0.3 },
    ],
    dock: { wave: 'sine', freq: 1568, duration: 0.6, gain: 0.14, envelope: { release: 0.9 } },
    reload: { wave: 'noise', freq: [800, 2000], duration: 0.2, gain: 0.06, lowpass: 2600 },
    warning: { wave: 'sawtooth', freq: 147, duration: 0.6, gain: 0.08, lowpass: 600 },
    point: [
      { wave: 'sine', freq: 1046, duration: 0.1, gain: 0.13 },
      { wave: 'sine', freq: 1568, duration: 0.18, gain: 0.12, delay: 0.1 },
    ],
    win: [
      { wave: 'triangle', freq: 587, duration: 0.14, gain: 0.14 },
      { wave: 'triangle', freq: 740, duration: 0.14, gain: 0.14, delay: 0.14 },
      { wave: 'triangle', freq: 880, duration: 0.14, gain: 0.14, delay: 0.28 },
      { wave: 'triangle', freq: 1175, duration: 0.5, gain: 0.16, delay: 0.42 },
    ],
    count: COUNT,
    go: GO,
  },
};

export const LOOK_SOUNDS: Readonly<Record<LookId, LookSound>> = {
  deep: DEEP,
  brass: BRASS,
  paper: PAPER,
  whirl: WHIRL,
};
