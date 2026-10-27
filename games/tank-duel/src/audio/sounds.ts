/**
 * Tank Duel's sound palette, synthesised by the kit: one table to tune by
 * ear. Two hooks from 1977 live here: the ricochet ping is played higher for
 * every bounce the shell has made, and each side's explosion rumbles at a
 * slightly different pitch, so you can tell whose tank went up with your eyes
 * shut. Everything sits low in the mix: the table is a quiet place until
 * something blows up.
 */
import type { HeldVoice, SoundBank } from '@woodgrain-88/kit';

export const TANK_SOUNDS: SoundBank = {
  /** A tank's gun: a short square thump with a puff of noise. */
  'tank-fire': [
    { wave: 'square', freq: [190, 55], duration: 0.09, gain: 0.32, lowpass: 900 },
    { wave: 'noise', freq: [1400, 300], duration: 0.07, gain: 0.22 },
  ],
  /** Aircraft guns crack higher and shorter. */
  'air-fire': [
    { wave: 'square', freq: [420, 160], duration: 0.06, gain: 0.22, lowpass: 1800 },
    { wave: 'noise', freq: [2600, 900], duration: 0.04, gain: 0.16 },
  ],
  /** One machine-gun round: a dry tick. */
  'machine-gun': { wave: 'noise', freq: [3200, 1800], duration: 0.025, gain: 0.18 },
  /** A bounce; the match plays it a little higher for every bounce so far. */
  ricochet: [
    {
      wave: 'triangle',
      freq: [1500, 1150],
      duration: 0.11,
      gain: 0.2,
      envelope: { release: 0.12 },
    },
    { wave: 'sine', freq: [3000, 2300], duration: 0.06, gain: 0.07 },
  ],
  /** The kill: a rolling rumble under a bright crack. Side 1 plays it a shade lower. */
  explosion: [
    { wave: 'noise', freq: [2200, 500], duration: 0.08, gain: 0.32 },
    {
      wave: 'noise',
      freq: [260, 45],
      duration: 1.1,
      gain: 0.42,
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.6 },
    },
    { wave: 'square', freq: [72, 30], duration: 0.55, gain: 0.2, lowpass: 220 },
  ],
  /** Something solid met something solid: a dull knock. */
  bump: { wave: 'noise', freq: [420, 140], duration: 0.06, gain: 0.14 },
  /** One step of the sixteen-step turn: a soft mechanical click that gives turning its rhythm. */
  'turn-step': { wave: 'square', freq: 540, duration: 0.012, gain: 0.05, lowpass: 2400 },
  /** The struck vehicle's spin: a falling whirr. */
  spin: {
    wave: 'sawtooth',
    freq: [260, 90],
    duration: 2.2,
    gain: 0.08,
    lowpass: 900,
    vibrato: { cents: 60, rate: 9 },
    envelope: { attack: 0.05, decay: 0.4, sustain: 0.6, release: 0.3 },
  },
  /** Once a second in the last twenty: the fuse fizzing faster. */
  'fuse-tick': { wave: 'noise', freq: 5200, duration: 0.03, gain: 0.08 },
  /** Blackout's radar sweep. */
  radar: {
    wave: 'sine',
    freq: [520, 1250],
    duration: 0.4,
    gain: 0.12,
    vibrato: { cents: 25, rate: 18 },
  },
  /** The winner's fanfare: four bright notes. */
  fanfare: [
    { wave: 'square', freq: 523, duration: 0.11, gain: 0.16, lowpass: 3000 },
    { wave: 'square', freq: 659, duration: 0.11, gain: 0.16, lowpass: 3000, delay: 0.13 },
    { wave: 'square', freq: 784, duration: 0.11, gain: 0.16, lowpass: 3000, delay: 0.26 },
    {
      wave: 'triangle',
      freq: 1047,
      duration: 0.5,
      gain: 0.2,
      delay: 0.39,
      vibrato: { cents: 15, rate: 6 },
    },
  ],
};

/** How much higher each earlier bounce makes the next ping (1 = no change). */
export const PING_RISE_PER_BOUNCE = 1.06;
/** Side 1's explosion pitch against side 0's. */
export const SIDE_EXPLOSION_PITCH = [1, 0.9] as const;

/** A tank's engine: a low sawtooth growl with a square rattle, pitched by speed. */
export const TANK_ENGINE: readonly HeldVoice[] = [
  { wave: 'sawtooth', freq: 46, gain: 0.5, lowpass: 260 },
  { wave: 'square', freq: 92, gain: 0.18, lowpass: 320, vibrato: { cents: 18, rate: 11 } },
];

/** A biplane's propeller drone. */
export const PROPELLER: readonly HeldVoice[] = [
  { wave: 'square', freq: 84, gain: 0.26, lowpass: 600, vibrato: { cents: 30, rate: 17 } },
  { wave: 'noise', freq: 700, gain: 0.12 },
];

/** A jet's roar: mostly noise, with a low tone under it. */
export const JET_ROAR: readonly HeldVoice[] = [
  { wave: 'noise', freq: 950, gain: 0.32 },
  { wave: 'sawtooth', freq: 66, gain: 0.12, lowpass: 400 },
];
