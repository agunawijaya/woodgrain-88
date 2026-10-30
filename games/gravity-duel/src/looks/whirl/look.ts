/**
 * The Whirlpool: two small submarines circling a whirlpool, seen from above.
 * The current is the pull and the vortex's eye the deadly middle. By day
 * turquoise water under the sun's caustics; by night dark water, the subs'
 * lights and the bioluminescence the churn stirs up.
 */
import type { LookDefinition } from '../../look/look.ts';
import { createWhirlView } from './view.ts';

export const WHIRL_LOOK: LookDefinition = {
  id: 'whirl',
  name: 'Whirlpool',
  framing: { width: 34, depth: 20, tilt: 72, height: 1.2, margin: 0.01, topInset: 0.05 },
  mood: {
    day: {
      sun: '#fff4dd',
      sunIntensity: 3,
      sky: '#cfeaf2',
      ground: '#1b6f80',
      hemiIntensity: 0.8,
    },
    night: {
      lampIntensity: 0,
      moon: '#8fb6ff',
      moonIntensity: 0.4,
      sky: '#11263a',
      ground: '#020a10',
      hemiIntensity: 0.22,
      shadowsFrom: 'moon',
    },
  },
  finish: {
    tiltShift: false,
    grades: {
      light: {
        lift: [0, 0.004, 0.006],
        gain: [0.98, 1, 1.02],
        saturation: 1.1,
        vignette: 0.18,
        bloom: 0.15,
      },
      dark: {
        lift: [0, 0.006, 0.012],
        gain: [0.96, 1, 1.05],
        saturation: 1.1,
        vignette: 0.5,
        bloom: 0.65,
      },
    },
  },
  reflections: { light: 0.55, dark: 0.3 },
  exposure: { light: 1.0, dark: 1.0 },
  background(appearance) {
    return appearance === 'dark' ? '#01060a' : '#5b7f86';
  },
  createView: createWhirlView,
};
