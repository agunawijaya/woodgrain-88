/**
 * The Den's sounds, all synthesised: the power lever's clunk, the static hiss
 * of a set warming up, the Counter's flip ticks, the channel-change blip and
 * the little rasp of the RESET lever and the snick of a difficulty switch;
 * and Den Life's: a needle stitching a patch, chalk on the slate, a thumbtack
 * going into cork, and the Counter's mechanical bell. Quiet, physical, never
 * shrill.
 */
import type { SoundBank } from '@woodgrain-88/kit';

export const DEN_SOUNDS: SoundBank = {
  'power-clunk': [
    {
      wave: 'sine',
      freq: [140, 48],
      duration: 0.09,
      gain: 0.7,
      envelope: { attack: 0.002, decay: 0.06, sustain: 0.2, release: 0.08 },
    },
    {
      wave: 'noise',
      freq: [2200, 600],
      duration: 0.03,
      gain: 0.35,
      envelope: { attack: 0.001, decay: 0.02, sustain: 0.1, release: 0.03 },
    },
    { wave: 'square', freq: [90, 60], duration: 0.04, gain: 0.12, lowpass: 600, delay: 0.01 },
  ],
  'tube-off': {
    wave: 'sine',
    freq: [3800, 9000],
    duration: 0.18,
    gain: 0.05,
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.05 },
  },
  'static-hiss': {
    wave: 'noise',
    freq: [5200, 2600],
    duration: 0.32,
    gain: 0.32,
    envelope: { attack: 0.01, decay: 0.12, sustain: 0.6, release: 0.18 },
  },
  degauss: {
    wave: 'sawtooth',
    freq: [60, 52],
    duration: 0.4,
    gain: 0.08,
    lowpass: 400,
    vibrato: { cents: 40, rate: 18 },
  },
  'flip-tick': [
    {
      wave: 'noise',
      freq: 3600,
      duration: 0.012,
      gain: 0.3,
      envelope: { attack: 0.001, decay: 0.01, sustain: 0.1, release: 0.01 },
    },
    { wave: 'triangle', freq: 1800, duration: 0.012, gain: 0.08, delay: 0.002 },
    {
      wave: 'noise',
      freq: 2400,
      duration: 0.012,
      gain: 0.22,
      delay: 0.06,
      envelope: { attack: 0.001, decay: 0.01, sustain: 0.1, release: 0.01 },
    },
  ],
  'channel-blip': [
    { wave: 'noise', freq: [4000, 1500], duration: 0.09, gain: 0.18 },
    { wave: 'square', freq: 880, duration: 0.03, gain: 0.05, tia: true, delay: 0.08 },
  ],
  'reset-rasp': [
    { wave: 'noise', freq: [900, 1800], duration: 0.07, gain: 0.2 },
    { wave: 'sine', freq: [220, 110], duration: 0.06, gain: 0.3, delay: 0.05 },
  ],
  // A slide switch: a dry snick, a touch brighter going to A than to B.
  'switch-snick': [
    {
      wave: 'noise',
      freq: [5200, 3000],
      duration: 0.018,
      gain: 0.26,
      envelope: { attack: 0.001, decay: 0.012, sustain: 0.1, release: 0.01 },
    },
    { wave: 'triangle', freq: [1300, 900], duration: 0.02, gain: 0.07, delay: 0.004 },
  ],
  // A sewing machine's needle, six quick passes.
  'needle-stitch': [
    {
      wave: 'noise',
      freq: [3200, 1800],
      duration: 0.016,
      gain: 0.16,
      delay: 0.0,
      envelope: { attack: 0.001, decay: 0.012, sustain: 0.1, release: 0.01 },
    },
    { wave: 'triangle', freq: [520, 380], duration: 0.03, gain: 0.05, delay: 0.01 },
    {
      wave: 'noise',
      freq: [3200, 1800],
      duration: 0.016,
      gain: 0.16,
      delay: 0.075,
      envelope: { attack: 0.001, decay: 0.012, sustain: 0.1, release: 0.01 },
    },
    { wave: 'triangle', freq: [520, 380], duration: 0.03, gain: 0.05, delay: 0.085 },
    {
      wave: 'noise',
      freq: [3200, 1800],
      duration: 0.016,
      gain: 0.16,
      delay: 0.15,
      envelope: { attack: 0.001, decay: 0.012, sustain: 0.1, release: 0.01 },
    },
    { wave: 'triangle', freq: [520, 380], duration: 0.03, gain: 0.05, delay: 0.16 },
    {
      wave: 'noise',
      freq: [3200, 1800],
      duration: 0.016,
      gain: 0.16,
      delay: 0.225,
      envelope: { attack: 0.001, decay: 0.012, sustain: 0.1, release: 0.01 },
    },
    { wave: 'triangle', freq: [520, 380], duration: 0.03, gain: 0.05, delay: 0.235 },
    {
      wave: 'noise',
      freq: [3200, 1800],
      duration: 0.016,
      gain: 0.16,
      delay: 0.3,
      envelope: { attack: 0.001, decay: 0.012, sustain: 0.1, release: 0.01 },
    },
    { wave: 'triangle', freq: [520, 380], duration: 0.03, gain: 0.05, delay: 0.31 },
    {
      wave: 'noise',
      freq: [3200, 1800],
      duration: 0.016,
      gain: 0.16,
      delay: 0.375,
      envelope: { attack: 0.001, decay: 0.012, sustain: 0.1, release: 0.01 },
    },
    { wave: 'triangle', freq: [520, 380], duration: 0.03, gain: 0.05, delay: 0.385 },
  ],
  // Chalk dragged across slate: a short, slightly wavering squeak over grit.
  'chalk-squeak': [
    {
      wave: 'sine',
      freq: [2300, 2700],
      duration: 0.11,
      gain: 0.05,
      vibrato: { cents: 60, rate: 34 },
    },
    {
      wave: 'noise',
      freq: [6000, 4000],
      duration: 0.1,
      gain: 0.08,
      envelope: { attack: 0.005, decay: 0.06, sustain: 0.4, release: 0.04 },
    },
  ],
  // A thumbtack pushed into cork: a dull tick.
  'tack-click': [
    {
      wave: 'noise',
      freq: [1400, 700],
      duration: 0.025,
      gain: 0.22,
      envelope: { attack: 0.001, decay: 0.02, sustain: 0.1, release: 0.01 },
    },
    { wave: 'sine', freq: [260, 180], duration: 0.04, gain: 0.12, delay: 0.004 },
  ],
  // The Counter's mechanical bell: a hammer strike and two bright partials ringing out.
  'counter-bell': [
    { wave: 'noise', freq: [5000, 2500], duration: 0.02, gain: 0.2 },
    {
      wave: 'sine',
      freq: 1568,
      duration: 1.4,
      gain: 0.16,
      envelope: { attack: 0.002, decay: 1.2, sustain: 0, release: 0.2 },
    },
    {
      wave: 'sine',
      freq: 3920,
      duration: 0.9,
      gain: 0.06,
      envelope: { attack: 0.002, decay: 0.8, sustain: 0, release: 0.1 },
    },
  ],
  'soft-tap': { wave: 'triangle', freq: [660, 520], duration: 0.04, gain: 0.12, tia: true },
};
