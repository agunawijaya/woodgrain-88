/**
 * The Brass Orrery: an antique orrery on a dark walnut desk, clockwork craft
 * and a filament bulb for a star. By day sunlight falls through a study
 * window; by night a desk lamp throws a warm pool and the brass glows.
 */
import type { LookDefinition } from '../../look/look.ts';
import { createBrassView } from './view.ts';

export const BRASS_LOOK: LookDefinition = {
  id: 'brass',
  name: 'Brass Orrery',
  framing: { width: 33, depth: 19, tilt: 70, height: 1.4, margin: 0.01, topInset: 0.05 },
  mood: {
    day: {
      sun: '#ffe2b5',
      sunIntensity: 3.2,
      sky: '#d8dfe8',
      ground: '#5a3c22',
      hemiIntensity: 0.55,
    },
    night: {
      lampIntensity: 0,
      moon: '#8a9ad0',
      moonIntensity: 0.12,
      sky: '#2a2433',
      ground: '#120b07',
      hemiIntensity: 0.14,
      shadowsFrom: 'moon',
    },
  },
  finish: {
    tiltShift: false,
    grades: {
      light: {
        lift: [0.004, 0.002, 0],
        gain: [1.03, 1, 0.96],
        saturation: 1.08,
        vignette: 0.22,
        bloom: 0.2,
      },
      dark: {
        lift: [0.01, 0.005, 0],
        gain: [1.05, 1, 0.92],
        saturation: 1.05,
        vignette: 0.5,
        bloom: 0.6,
      },
    },
  },
  reflections: { light: 0.6, dark: 0.35 },
  exposure: { light: 1.0, dark: 1.05 },
  background(appearance) {
    return appearance === 'dark' ? '#0a0604' : '#2a1a0f';
  },
  createView: createBrassView,
};
