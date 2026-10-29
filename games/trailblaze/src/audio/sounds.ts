/**
 * Trailblaze's sound, synthesised by the kit: one palette per look, with the
 * same cue for the same meaning in all four. Each rider hums while it rides,
 * and the hum climbs with the speed-up, as the 1977 cartridge's tone did. A
 * turn ticks, a gap hisses, a crash is the look's own (an explosion, a clonk
 * and a whistle, a wrap and a thud, a crack and a slide), the trap closing
 * has a sound of its own, and points and wins are short tunes.
 */
import type { HeldVoice, SoundDef } from '@woodgrain-88/kit';
import type { LookId } from '../look/look.ts';

export type Cue = 'turn' | 'gap' | 'crash' | 'point' | 'trap' | 'win' | 'count' | 'go';

export interface LookSound {
  readonly cues: Readonly<Record<Cue, SoundDef>>;
  /** What each rider sounds like while it rides, at the starting speed. */
  readonly hum: readonly HeldVoice[];
}

/** The hum's pitch at each speed-up stage, from the start (0) to top speed (4): a fifth in all. */
export const HUM_PITCH: readonly number[] = [1, 1.12, 1.26, 1.36, 1.5];

const NEON: LookSound = {
  hum: [
    { wave: 'sawtooth', freq: 55, gain: 0.05, lowpass: 420, vibrato: { cents: 6, rate: 5 } },
    { wave: 'square', freq: 110, gain: 0.018, lowpass: 700 },
  ],
  cues: {
    turn: { wave: 'sine', freq: [880, 1320], duration: 0.05, gain: 0.08 },
    gap: { wave: 'noise', freq: 4200, duration: 0.06, gain: 0.05, lowpass: 6500 },
    crash: [
      { wave: 'noise', freq: [3200, 220], duration: 0.55, gain: 0.32, envelope: { release: 0.5 } },
      { wave: 'sine', freq: [220, 38], duration: 0.5, gain: 0.32 },
      { wave: 'square', freq: [880, 110], duration: 0.22, gain: 0.06, lowpass: 2400 },
    ],
    point: [
      { wave: 'triangle', freq: 1318, duration: 0.08, gain: 0.14 },
      { wave: 'triangle', freq: 1760, duration: 0.12, gain: 0.14, delay: 0.08 },
    ],
    trap: [
      {
        wave: 'sine',
        freq: [440, 220],
        duration: 0.4,
        gain: 0.12,
        vibrato: { cents: 30, rate: 9 },
      },
      { wave: 'sawtooth', freq: 73, duration: 0.45, gain: 0.08, lowpass: 500 },
    ],
    win: [
      { wave: 'triangle', freq: 523, duration: 0.12, gain: 0.16 },
      { wave: 'triangle', freq: 659, duration: 0.12, gain: 0.16, delay: 0.12 },
      { wave: 'triangle', freq: 784, duration: 0.12, gain: 0.16, delay: 0.24 },
      { wave: 'triangle', freq: 1046, duration: 0.4, gain: 0.18, delay: 0.36 },
    ],
    count: { wave: 'square', freq: 660, duration: 0.08, gain: 0.08, lowpass: 3000 },
    go: { wave: 'square', freq: 1320, duration: 0.22, gain: 0.1, lowpass: 4000 },
  },
};

const TRAINS: LookSound = {
  hum: [
    { wave: 'noise', freq: 320, gain: 0.04, lowpass: 750 },
    { wave: 'triangle', freq: 70, gain: 0.03 },
  ],
  cues: {
    turn: { wave: 'noise', freq: [1300, 800], duration: 0.04, gain: 0.08, lowpass: 2600 },
    gap: { wave: 'triangle', freq: 2093, duration: 0.05, gain: 0.05 },
    crash: [
      { wave: 'noise', freq: [900, 160], duration: 0.45, gain: 0.3, envelope: { release: 0.3 } },
      { wave: 'triangle', freq: [190, 60], duration: 0.3, gain: 0.22 },
      {
        wave: 'sine',
        freq: [1568, 1480],
        duration: 0.5,
        gain: 0.1,
        delay: 0.1,
        vibrato: { cents: 25, rate: 11 },
      },
    ],
    point: [
      { wave: 'triangle', freq: 880, duration: 0.06, gain: 0.16 },
      { wave: 'triangle', freq: 1175, duration: 0.06, gain: 0.16, delay: 0.07 },
    ],
    trap: { wave: 'square', freq: [392, 196], duration: 0.3, gain: 0.07, lowpass: 1200 },
    win: [
      { wave: 'sine', freq: 1568, duration: 0.18, gain: 0.12, vibrato: { cents: 20, rate: 10 } },
      {
        wave: 'sine',
        freq: 1568,
        duration: 0.45,
        gain: 0.12,
        delay: 0.26,
        vibrato: { cents: 20, rate: 10 },
      },
    ],
    count: { wave: 'triangle', freq: 1046, duration: 0.05, gain: 0.12 },
    go: { wave: 'triangle', freq: 1568, duration: 0.12, gain: 0.14 },
  },
};

const MUMMY: LookSound = {
  hum: [{ wave: 'noise', freq: 520, gain: 0.035, lowpass: 950 }],
  cues: {
    turn: { wave: 'noise', freq: [650, 420], duration: 0.05, gain: 0.06, lowpass: 1600 },
    gap: { wave: 'noise', freq: 2600, duration: 0.05, gain: 0.04, lowpass: 4000 },
    crash: [
      { wave: 'noise', freq: [2200, 500], duration: 0.35, gain: 0.2 },
      { wave: 'sine', freq: [130, 48], duration: 0.4, gain: 0.3, delay: 0.25 },
    ],
    point: [
      { wave: 'triangle', freq: 587, duration: 0.1, gain: 0.15 },
      { wave: 'triangle', freq: 880, duration: 0.14, gain: 0.15, delay: 0.1 },
    ],
    trap: [
      { wave: 'noise', freq: [6000, 800], duration: 0.25, gain: 0.28 },
      { wave: 'sine', freq: [72, 40], duration: 0.6, gain: 0.24, delay: 0.05 },
    ],
    win: [
      { wave: 'triangle', freq: 587, duration: 0.12, gain: 0.16 },
      { wave: 'triangle', freq: 698, duration: 0.12, gain: 0.16, delay: 0.12 },
      { wave: 'triangle', freq: 880, duration: 0.12, gain: 0.16, delay: 0.24 },
      { wave: 'triangle', freq: 1175, duration: 0.4, gain: 0.18, delay: 0.36 },
    ],
    count: { wave: 'noise', freq: 900, duration: 0.05, gain: 0.1, lowpass: 1800 },
    go: { wave: 'sine', freq: [98, 60], duration: 0.3, gain: 0.28 },
  },
};

const ICE: LookSound = {
  hum: [{ wave: 'noise', freq: 3200, gain: 0.022, lowpass: 5200 }],
  cues: {
    turn: { wave: 'noise', freq: [5200, 2600], duration: 0.08, gain: 0.07, lowpass: 7000 },
    gap: { wave: 'sine', freq: 2637, duration: 0.04, gain: 0.04 },
    crash: [
      { wave: 'noise', freq: [5200, 1500], duration: 0.25, gain: 0.26 },
      { wave: 'triangle', freq: [660, 330], duration: 0.3, gain: 0.1 },
      { wave: 'noise', freq: [800, 200], duration: 0.35, gain: 0.15, delay: 0.1 },
    ],
    point: [
      { wave: 'sine', freq: 1568, duration: 0.12, gain: 0.14, envelope: { release: 0.5 } },
      {
        wave: 'sine',
        freq: 2093,
        duration: 0.12,
        gain: 0.1,
        delay: 0.1,
        envelope: { release: 0.6 },
      },
    ],
    trap: [
      {
        wave: 'sine',
        freq: [1046, 523],
        duration: 0.5,
        gain: 0.1,
        vibrato: { cents: 20, rate: 7 },
      },
      { wave: 'noise', freq: 4000, duration: 0.2, gain: 0.06, delay: 0.1, lowpass: 8000 },
    ],
    win: [
      { wave: 'sine', freq: 1046, duration: 0.14, gain: 0.14, envelope: { release: 0.4 } },
      {
        wave: 'sine',
        freq: 1318,
        duration: 0.14,
        gain: 0.14,
        delay: 0.12,
        envelope: { release: 0.4 },
      },
      {
        wave: 'sine',
        freq: 1568,
        duration: 0.14,
        gain: 0.14,
        delay: 0.24,
        envelope: { release: 0.4 },
      },
      {
        wave: 'sine',
        freq: 2093,
        duration: 0.4,
        gain: 0.16,
        delay: 0.36,
        envelope: { release: 0.8 },
      },
    ],
    count: { wave: 'sine', freq: 1760, duration: 0.05, gain: 0.1, envelope: { release: 0.2 } },
    go: { wave: 'sine', freq: 2349, duration: 0.2, gain: 0.12, envelope: { release: 0.5 } },
  },
};

export const LOOK_SOUNDS: Readonly<Record<LookId, LookSound>> = {
  neon: NEON,
  trains: TRAINS,
  mummy: MUMMY,
  ice: ICE,
};
