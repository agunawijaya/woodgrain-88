/**
 * Deep Space, the default look: two starfighters round a living star. By day
 * the inside of a bright planetarium dome, pale and crisp; by night black
 * space with a nebula, glowing engines and the star blazing.
 */
import type { LookDefinition } from '../../look/look.ts';
import { createDeepView } from './view.ts';

export const DEEP_LOOK: LookDefinition = {
  id: 'deep',
  name: 'Deep Space',
  framing: { width: 32.4, depth: 18.4, tilt: 74, height: 1.2, margin: 0.01, topInset: 0.05 },
  mood: {
    day: {
      sun: '#ffffff',
      sunIntensity: 2.2,
      sky: '#e8eefb',
      ground: '#b9c3d8',
      hemiIntensity: 0.9,
    },
    night: {
      lampIntensity: 0,
      moon: '#9fb2ff',
      moonIntensity: 0.35,
      sky: '#1b2140',
      ground: '#020309',
      hemiIntensity: 0.25,
      shadowsFrom: 'moon',
    },
  },
  finish: {
    tiltShift: false,
    grades: {
      light: {
        lift: [0, 0, 0.004],
        gain: [1, 1, 1.02],
        saturation: 1.1,
        vignette: 0.1,
        bloom: 0.1,
      },
      dark: {
        lift: [0, 0, 0.008],
        gain: [1, 1, 1.03],
        saturation: 1.12,
        vignette: 0.4,
        bloom: 0.75,
      },
    },
  },
  reflections: { light: 0.45, dark: 0.3 },
  exposure: { light: 0.95, dark: 1.0 },
  background(appearance) {
    return appearance === 'dark' ? '#010207' : '#cfd8ea';
  },
  createView: createDeepView,
};
