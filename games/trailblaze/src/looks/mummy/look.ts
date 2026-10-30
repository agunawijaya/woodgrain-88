/**
 * Mummy's Wrap: two small mummies shuffling through a tomb, each unrolling a
 * bandage that never runs out. By day a shaft of sun falls into a sand-gold
 * chamber; by night torches burn round the walls and the carvings glow.
 */
import type { LookDefinition } from '../../look/look.ts';
import { createMummyView } from './view.ts';

export const MUMMY_LOOK: LookDefinition = {
  id: 'mummy',
  name: "Mummy's Wrap",
  riders: ['Wick', 'Bun'],
  ridesAs: 'Shuffles as',
  framing: { width: 41.5, depth: 21.5, tilt: 56, height: 5.2, margin: 0.03, topInset: 0.04 },
  mood: {
    day: {
      sun: '#ffe0a8',
      sunIntensity: 3.1,
      sky: '#f2d6a6',
      ground: '#a87a44',
      hemiIntensity: 0.62,
    },
    night: {
      lampIntensity: 0,
      moon: '#7d86c9',
      moonIntensity: 0.14,
      sky: '#2a1c22',
      ground: '#0d0806',
      hemiIntensity: 0.22,
      shadowsFrom: 'moon',
    },
  },
  finish: {
    tiltShift: false,
    grades: {
      light: {
        lift: [0.01, 0.005, 0],
        gain: [1.03, 1, 0.94],
        saturation: 1.06,
        vignette: 0.32,
        bloom: 0.22,
      },
      dark: {
        lift: [0.01, 0.004, 0],
        gain: [1.04, 0.98, 0.92],
        saturation: 1.05,
        vignette: 0.62,
        bloom: 0.6,
      },
    },
  },
  reflections: { light: 0.15, dark: 0.08 },
  exposure: { light: 1.0, dark: 1.15 },
  background(appearance) {
    return appearance === 'dark' ? '#0e0907' : '#cfae7a';
  },
  createView: createMummyView,
};
