/**
 * Neon Grid, the default look: light-bikes on a glass grid. By day a white
 * acrylic arena under soft studio light, the walls saturated panes of colour;
 * by night black glass, the walls glowing and pooling light on the floor.
 */
import type { LookDefinition } from '../../look/look.ts';
import { createNeonView } from './view.ts';

export const NEON_LOOK: LookDefinition = {
  id: 'neon',
  name: 'Neon Grid',
  framing: { width: 41, depth: 21, tilt: 50, height: 5.4, margin: 0.03, topInset: 0.04 },
  mood: {
    day: {
      sun: '#ffffff',
      sunIntensity: 1.4,
      sky: '#eef2fb',
      ground: '#c9cfdc',
      hemiIntensity: 0.45,
    },
    night: {
      lampIntensity: 0,
      moon: '#8c9cff',
      moonIntensity: 0.18,
      sky: '#141a3a',
      ground: '#020309',
      hemiIntensity: 0.16,
      shadowsFrom: 'moon',
    },
  },
  finish: {
    tiltShift: false,
    grades: {
      light: {
        lift: [0, 0, 0.006],
        gain: [0.98, 1, 1.02],
        saturation: 1.12,
        vignette: 0.12,
        bloom: 0.28,
      },
      dark: {
        lift: [0, 0, 0.01],
        gain: [1, 1, 1.04],
        saturation: 1.15,
        vignette: 0.42,
        bloom: 0.6,
      },
    },
  },
  reflections: { light: 0.5, dark: 0.35 },
  // The white acrylic is lit below the bloom threshold and exposed up, so only the walls glow.
  exposure: { light: 1.5, dark: 1.0 },
  background(appearance) {
    return appearance === 'dark' ? '#010207' : '#e4e8f0';
  },
  createView: createNeonView,
};
