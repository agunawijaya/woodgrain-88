/**
 * The 14 cartridge variations of Trailblaze, mapping each variation number
 * (1–14) to its rule switches: opponent type, continuous vs free-draw motion,
 * progressive speed-up, bordered vs wraparound edges, 4- vs 8-way steering,
 * and fire-button gap or erase behaviour.
 */
import type { VariationRules } from './types.ts';

export const VARIATIONS: readonly VariationRules[] = [
  {
    number: 1,
    opponent: 'person',
    motion: 'continuous',
    speedUp: false,
    edges: 'bordered',
    steering: 4,
    fire: 'none',
  },
  {
    number: 2,
    opponent: 'computer',
    motion: 'continuous',
    speedUp: false,
    edges: 'bordered',
    steering: 4,
    fire: 'none',
  },
  {
    number: 3,
    opponent: 'person',
    motion: 'continuous',
    speedUp: true,
    edges: 'bordered',
    steering: 4,
    fire: 'none',
  },
  {
    number: 4,
    opponent: 'computer',
    motion: 'continuous',
    speedUp: true,
    edges: 'bordered',
    steering: 4,
    fire: 'none',
  },
  {
    number: 5,
    opponent: 'person',
    motion: 'continuous',
    speedUp: false,
    edges: 'bordered',
    steering: 8,
    fire: 'none',
  },
  {
    number: 6,
    opponent: 'person',
    motion: 'continuous',
    speedUp: true,
    edges: 'bordered',
    steering: 8,
    fire: 'none',
  },
  {
    number: 7,
    opponent: 'person',
    motion: 'continuous',
    speedUp: true,
    edges: 'bordered',
    steering: 8,
    fire: 'gaps',
  },
  {
    number: 8,
    opponent: 'person',
    motion: 'continuous',
    speedUp: false,
    edges: 'wraparound',
    steering: 4,
    fire: 'none',
  },
  {
    number: 9,
    opponent: 'person',
    motion: 'continuous',
    speedUp: true,
    edges: 'wraparound',
    steering: 4,
    fire: 'none',
  },
  {
    number: 10,
    opponent: 'person',
    motion: 'continuous',
    speedUp: false,
    edges: 'wraparound',
    steering: 8,
    fire: 'none',
  },
  {
    number: 11,
    opponent: 'person',
    motion: 'continuous',
    speedUp: true,
    edges: 'wraparound',
    steering: 8,
    fire: 'none',
  },
  {
    number: 12,
    opponent: 'person',
    motion: 'continuous',
    speedUp: true,
    edges: 'wraparound',
    steering: 8,
    fire: 'gaps',
  },
  {
    number: 13,
    opponent: 'person',
    motion: 'free-draw',
    speedUp: false,
    edges: 'wraparound',
    steering: 4,
    fire: 'erase',
  },
  {
    number: 14,
    opponent: 'person',
    motion: 'free-draw',
    speedUp: false,
    edges: 'wraparound',
    steering: 8,
    fire: 'erase',
  },
];

export function variationRules(number: number): VariationRules {
  if (!Number.isInteger(number) || number < 1 || number > VARIATIONS.length) {
    throw new RangeError(`Variation number must be an integer between 1 and 14, got ${number}`);
  }
  const rules = VARIATIONS[number - 1];
  if (!rules) {
    throw new RangeError(`Variation number must be an integer between 1 and 14, got ${number}`);
  }
  return rules;
}
