/**
 * Paper Sky: a child's drawing on graph paper, come to life. By day white
 * paper and bright crayons under even light; by night the drawing lit by a
 * desk torch, the glow-in-the-dark crayon shining where the torch falls off.
 */
import type { LookDefinition } from '../../look/look.ts';
import { createPaperView } from './view.ts';

export const PAPER_LOOK: LookDefinition = {
  id: 'paper',
  name: 'Paper Sky',
  framing: { width: 32.4, depth: 18.4, tilt: 74, height: 1, margin: 0.01, topInset: 0.05 },
  mood: {
    day: {
      sun: '#ffffff',
      sunIntensity: 2.4,
      sky: '#ffffff',
      ground: '#e9e4d6',
      hemiIntensity: 1.1,
    },
    night: {
      lampIntensity: 0,
      moon: '#6f86c8',
      moonIntensity: 0.12,
      sky: '#26314f',
      ground: '#0b0d14',
      hemiIntensity: 0.1,
      shadowsFrom: 'moon',
    },
  },
  finish: {
    tiltShift: false,
    grades: {
      light: { lift: [0, 0, 0], gain: [1, 1, 1], saturation: 1.05, vignette: 0.1, bloom: 0.05 },
      dark: {
        lift: [0, 0, 0.012],
        gain: [1, 1, 1.02],
        saturation: 1.05,
        vignette: 0.55,
        bloom: 0.4,
      },
    },
  },
  reflections: { light: 0.15, dark: 0.05 },
  exposure: { light: 1.1, dark: 1.0 },
  background(appearance) {
    return appearance === 'dark' ? '#090b12' : '#efece3';
  },
  createView: createPaperView,
};
