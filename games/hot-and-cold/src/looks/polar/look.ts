/**
 * Polar Expedition, the default look: the hunt as a survey on a snowfield.
 * By day the light is a crisp low sun with blue shadows on dazzling snow; by
 * night the moon casts the shadows, the aurora hangs over the ridges and the
 * explorers carry lanterns.
 */
import type { LookDefinition } from '../../look/look.ts';
import { createPolarView } from './view.ts';

export const POLAR_LOOK: LookDefinition = {
  id: 'polar',
  name: 'Polar Expedition',
  framing: { width: 50, depth: 31, tilt: 46, height: 10, margin: 0.01 },
  mood: {
    day: {
      sun: '#fff1dc',
      sunIntensity: 2.6,
      sky: '#5d8df5',
      ground: '#dde6f5',
      hemiIntensity: 0.4,
    },
    night: {
      lampIntensity: 0,
      moon: '#9fb6ff',
      moonIntensity: 0.4,
      sky: '#0f3d40',
      ground: '#060a14',
      hemiIntensity: 0.34,
      shadowsFrom: 'moon',
    },
  },
  finish: {
    tiltShift: false,
    grades: {
      light: {
        lift: [0, 0.004, 0.012],
        gain: [0.97, 1, 1.03],
        saturation: 1.08,
        vignette: 0.16,
        bloom: 0.22,
      },
      dark: {
        lift: [0, 0.004, 0.012],
        gain: [0.95, 1, 1.06],
        saturation: 1,
        vignette: 0.5,
        bloom: 0.4,
      },
    },
  },
  reflections: { light: 0.35, dark: 0.06 },
  // Sunlit snow is lit low, under the bloom, and exposed up to dazzle.
  exposure: { light: 1.6, dark: 1.0 },
  fieldHeight: 0.4,
  background(appearance) {
    return appearance === 'dark' ? '#02060c' : '#dfeaf7';
  },
  createView: createPolarView,
};
