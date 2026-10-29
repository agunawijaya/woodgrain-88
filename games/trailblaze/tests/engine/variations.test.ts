/**
 * Tests that all 14 cartridge variations match the dossier specification table
 * on every field and that out-of-range variation numbers throw.
 */
import { describe, expect, it } from 'vitest';
import type { VariationRules } from '../../src/engine/types.ts';
import { VARIATIONS, variationRules } from '../../src/engine/variations.ts';

const EXPECTED_VARIATIONS: readonly VariationRules[] = [
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

describe('variations', () => {
  it('matches the dossier §5 table for all 14 variations on every field', () => {
    expect(VARIATIONS).toEqual(EXPECTED_VARIATIONS);
    for (let number = 1; number <= 14; number++) {
      expect(variationRules(number)).toEqual(EXPECTED_VARIATIONS[number - 1]);
    }
  });

  it('throws when asked for a variation number outside 1–14', () => {
    expect(() => variationRules(0)).toThrow(RangeError);
    expect(() => variationRules(15)).toThrow(RangeError);
    expect(() => variationRules(-1)).toThrow(RangeError);
    expect(() => variationRules(2.5)).toThrow(RangeError);
  });
});
