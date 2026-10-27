/**
 * Tabletop Board: the hunt as a family board game in an oak tray on felt.
 * By day warm afternoon light falls across the table; by night one lamp
 * pools over the board, the shadows are deep and the brass catches the
 * light. The camera is the arena's fair tabletop view, with its tilt-shift
 * finish selling the miniature.
 */
import type { LookDefinition } from '../../look/look.ts';
import { createTabletopView } from './view.ts';

export const TABLETOP_LOOK: LookDefinition = {
  id: 'tabletop',
  name: 'Tabletop Board',
  framing: { width: 58, depth: 38, tilt: 57, height: 3, margin: 0.005 },
  mood: {
    day: { sunIntensity: 3.2, hemiIntensity: 0.62 },
    night: {
      lampIntensity: 12500,
      lampAngle: 0.36,
      lampPenumbra: 0.55,
      moonIntensity: 0.18,
      hemiIntensity: 0.1,
    },
  },
  finish: {
    grades: {
      light: { vignette: 0.28, bloom: 0.25, saturation: 1.06 },
      dark: { vignette: 0.75, bloom: 0.55 },
    },
  },
  reflections: { light: 0.4, dark: 0.12 },
  fieldHeight: 1.42,
  background(appearance) {
    return appearance === 'dark' ? '#0d0907' : '#3b2a1e';
  },
  createView: createTabletopView,
};
