/**
 * The Den's sounds, all synthesised: the power lever's clunk, the static hiss
 * of a set warming up, the Counter's flip ticks, the channel-change blip and
 * the little rasp of the RESET lever. Quiet, physical, never shrill.
 */
import type { SoundBank } from '@woodgrain-88/kit';

export const DEN_SOUNDS: SoundBank = {
  'power-clunk': [
    { wave: 'sine', freq: [140, 48], duration: 0.09, gain: 0.7, envelope: { attack: 0.002, decay: 0.06, sustain: 0.2, release: 0.08 } },
    { wave: 'noise', freq: [2200, 600], duration: 0.03, gain: 0.35, envelope: { attack: 0.001, decay: 0.02, sustain: 0.1, release: 0.03 } },
    { wave: 'square', freq: [90, 60], duration: 0.04, gain: 0.12, lowpass: 600, delay: 0.01 },
  ],
  'tube-off': { wave: 'sine', freq: [3800, 9000], duration: 0.18, gain: 0.05, envelope: { attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.05 } },
  'static-hiss': { wave: 'noise', freq: [5200, 2600], duration: 0.32, gain: 0.32, envelope: { attack: 0.01, decay: 0.12, sustain: 0.6, release: 0.18 } },
  degauss: { wave: 'sawtooth', freq: [60, 52], duration: 0.4, gain: 0.08, lowpass: 400, vibrato: { cents: 40, rate: 18 } },
  'flip-tick': [
    { wave: 'noise', freq: 3600, duration: 0.012, gain: 0.3, envelope: { attack: 0.001, decay: 0.01, sustain: 0.1, release: 0.01 } },
    { wave: 'triangle', freq: 1800, duration: 0.012, gain: 0.08, delay: 0.002 },
    { wave: 'noise', freq: 2400, duration: 0.012, gain: 0.22, delay: 0.06, envelope: { attack: 0.001, decay: 0.01, sustain: 0.1, release: 0.01 } },
  ],
  'channel-blip': [
    { wave: 'noise', freq: [4000, 1500], duration: 0.09, gain: 0.18 },
    { wave: 'square', freq: 880, duration: 0.03, gain: 0.05, tia: true, delay: 0.08 },
  ],
  'reset-rasp': [
    { wave: 'noise', freq: [900, 1800], duration: 0.07, gain: 0.2 },
    { wave: 'sine', freq: [220, 110], duration: 0.06, gain: 0.3, delay: 0.05 },
  ],
  'soft-tap': { wave: 'triangle', freq: [660, 520], duration: 0.04, gain: 0.12, tia: true },
};
