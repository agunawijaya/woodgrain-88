/**
 * Ice Trail: two skaters on a frozen lake, freezing the air into walls of
 * ice. By day pale sky and sparkling ice under cold blue shadows; by night
 * moonlight, and the ice walls lit from inside.
 */
import type { LookDefinition } from '../../look/look.ts';
import { createIceView } from './view.ts';

export const ICE_LOOK: LookDefinition = {
  id: 'ice',
  name: 'Ice Trail',
  framing: { width: 41.5, depth: 21.5, tilt: 57, height: 4.6, margin: 0.03, topInset: 0.04 },
  mood: {
    day: {
      sun: '#fff6ea',
      sunIntensity: 1.55,
      sky: '#9cc4f2',
      ground: '#c9d6e6',
      hemiIntensity: 0.5,
    },
    night: {
      lampIntensity: 0,
      moon: '#a9c2ff',
      moonIntensity: 0.75,
      sky: '#1c2b58',
      ground: '#05070f',
      hemiIntensity: 0.3,
      shadowsFrom: 'moon',
    },
  },
  finish: {
    tiltShift: false,
    grades: {
      light: {
        lift: [0, 0.004, 0.012],
        gain: [0.97, 1, 1.03],
        saturation: 1.05,
        vignette: 0.16,
        bloom: 0.24,
      },
      dark: {
        lift: [0, 0.006, 0.02],
        gain: [0.95, 1, 1.07],
        saturation: 1.05,
        vignette: 0.5,
        bloom: 0.7,
      },
    },
  },
  reflections: { light: 0.45, dark: 0.15 },
  // Snow and ice are lit below the bloom threshold and exposed up, so only glints and walls glow.
  exposure: { light: 1.45, dark: 1.1 },
  background(appearance) {
    return appearance === 'dark' ? '#03060f' : '#dbe8f6';
  },
  createView: createIceView,
};
