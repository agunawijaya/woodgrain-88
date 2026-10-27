/**
 * Aircraft battle skies: open wrapping airspace with point-symmetric cloud banks
 * for dogfights in Tank Duel.
 */
import type { SkyDef } from './format.ts';

export const CLOUD_BANKS: SkyDef = {
  id: 'cloud-banks',
  name: 'Cloud Banks',
  clouds: [
    { x: 13, y: 9, radiusX: 7, radiusY: 3.2 },
    { x: 51, y: 31, radiusX: 7, radiusY: 3.2 },
    { x: 40, y: 11, radiusX: 5, radiusY: 2.4 },
    { x: 24, y: 29, radiusX: 5, radiusY: 2.4 },
    { x: 55, y: 4, radiusX: 4, radiusY: 2 },
    { x: 9, y: 36, radiusX: 4, radiusY: 2 },
  ],
  spawns: [
    { position: { x: 8, y: 20 }, heading: 0 },
    { position: { x: 56, y: 20 }, heading: 8 },
  ],
};

export const CLEAR_SKY: SkyDef = {
  id: 'clear-sky',
  name: 'Clear Sky',
  clouds: [],
  spawns: [
    { position: { x: 8, y: 20 }, heading: 0 },
    { position: { x: 56, y: 20 }, heading: 8 },
  ],
};

/** Every sky by id, in standard selection order. */
export const SKIES: readonly SkyDef[] = [CLOUD_BANKS, CLEAR_SKY];
