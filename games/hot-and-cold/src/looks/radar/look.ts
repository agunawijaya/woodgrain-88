/**
 * Radar Room: the hunt plotted on a flat sweep display set in a steel
 * console. By day it is a light-panel console in pale greens and greys, lit
 * by a bright room; by night the room is dark and the phosphor glows. Seen
 * almost straight down, with no tilt-shift: it is a screen, not a miniature.
 */
import type { LookDefinition } from '../../look/look.ts';
import { createRadarView } from './view.ts';

export const RADAR_LOOK: LookDefinition = {
  id: 'radar',
  name: 'Radar Room',
  framing: { width: 66, depth: 42, tilt: 74, height: 1.2, margin: 0.005 },
  mood: {
    day: {
      sun: '#fffaf0',
      sunIntensity: 2.0,
      sky: '#e3ebe6',
      ground: '#c9d1c8',
      hemiIntensity: 0.95,
    },
    night: {
      lampIntensity: 0,
      moon: '#7f9cff',
      moonIntensity: 0.14,
      sky: '#0c1a14',
      ground: '#050807',
      hemiIntensity: 0.08,
      shadowsFrom: 'moon',
    },
  },
  finish: {
    tiltShift: false,
    grades: {
      light: { vignette: 0.18, bloom: 0.08, saturation: 1 },
      dark: { vignette: 0.55, bloom: 0.95, saturation: 1.05 },
    },
  },
  reflections: { light: 0.55, dark: 0.05 },
  fieldHeight: 0.06,
  background(appearance) {
    return appearance === 'dark' ? '#030504' : '#b9c3b6';
  },
  createView: createRadarView,
};
