/**
 * Toy Trains: two wind-up locomotives laying their own track across a play
 * mat. By day the sun falls warm across the planks; by night the room is
 * dark but for a night light and the engines' headlamps.
 */
import type { LookDefinition } from '../../look/look.ts';
import { createTrainsView } from './view.ts';

export const TRAINS_LOOK: LookDefinition = {
  id: 'trains',
  name: 'Toy Trains',
  riders: ['Ember', 'Bluebell'],
  ridesAs: 'Drives',
  framing: { width: 41.5, depth: 21.5, tilt: 54, height: 5, margin: 0.03, topInset: 0.04 },
  mood: {
    day: {
      sun: '#ffe2bd',
      sunIntensity: 3.0,
      sky: '#cfe0ff',
      ground: '#c49a6a',
      hemiIntensity: 0.75,
    },
    night: {
      lamp: '#ffcf8f',
      lampIntensity: 1100,
      lampAngle: 0.62,
      lampPenumbra: 1,
      moon: '#7f95d6',
      moonIntensity: 0.22,
      sky: '#24305a',
      ground: '#100c0a',
      hemiIntensity: 0.3,
      shadowsFrom: 'lamp',
    },
  },
  finish: {
    tiltShift: true,
    grades: {
      light: {
        lift: [0.004, 0.002, 0],
        gain: [1.02, 1, 0.97],
        saturation: 1.08,
        vignette: 0.2,
        bloom: 0.18,
      },
      dark: {
        lift: [0, 0.004, 0.014],
        gain: [1, 0.98, 1.02],
        saturation: 1.02,
        vignette: 0.55,
        bloom: 0.55,
      },
    },
  },
  reflections: { light: 0.3, dark: 0.12 },
  exposure: { light: 1.0, dark: 1.1 },
  background(appearance) {
    return appearance === 'dark' ? '#0b0d16' : '#e9dccb';
  },
  createView: createTrainsView,
};
