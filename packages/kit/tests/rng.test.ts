/**
 * Tests for the seeded pseudo-random number generator (sfc32): determinism,
 * distributions, parameter validation, array shuffling, and independent forks.
 */
import { describe, expect, it } from 'vitest';
import { createRng, hashSeed } from '../src/rng.ts';

describe('rng', () => {
  it('produces the same sequence for the same seed, different for different seeds, with a stable seed', () => {
    const rngNum1 = createRng(12345);
    const rngNum2 = createRng(12345);
    const seqNum1 = Array.from({ length: 8 }, () => rngNum1.next());
    const seqNum2 = Array.from({ length: 8 }, () => rngNum2.next());
    expect(seqNum1).toEqual(seqNum2);

    const rngStr1 = createRng('woodgrain');
    const rngStr2 = createRng('woodgrain');
    const seqStr1 = Array.from({ length: 8 }, () => rngStr1.next());
    const seqStr2 = Array.from({ length: 8 }, () => rngStr2.next());
    expect(seqStr1).toEqual(seqStr2);

    const rngDiff = createRng('woodgrain-alternate');
    const seqDiff = Array.from({ length: 8 }, () => rngDiff.next());
    expect(seqDiff).not.toEqual(seqStr1);

    expect(rngNum1.seed).toBe(hashSeed(12345));
    expect(rngStr1.seed).toBe(hashSeed('woodgrain'));
  });

  it('matches over the first 1 000 values from woodgrain in [0, 1), and stays within 1–6 with all faces appearing', () => {
    const rngA = createRng('woodgrain');
    const rngB = createRng('woodgrain');
    for (let i = 0; i < 1000; i++) {
      const valA = rngA.next();
      const valB = rngB.next();
      expect(valA).toBe(valB);
      expect(valA).toBeGreaterThanOrEqual(0);
      expect(valA).toBeLessThan(1);
    }

    const dice = createRng(42);
    const seenFaces = new Set<number>();
    for (let i = 0; i < 10000; i++) {
      const roll = dice.int(1, 6);
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(6);
      expect(Number.isInteger(roll)).toBe(true);
      seenFaces.add(roll);
    }
    expect(seenFaces.size).toBe(6);
    for (let face = 1; face <= 6; face++) {
      expect(seenFaces.has(face)).toBe(true);
    }
  });

  it('rejects invalid int ranges, empty pick arrays, validates shuffle, chance bounds, and deterministic fork', () => {
    const rng = createRng(88);

    expect(() => rng.int(1.5, 6)).toThrow(RangeError);
    expect(() => rng.int(1, 5.5)).toThrow(RangeError);
    expect(() => rng.int(6, 5)).toThrow(RangeError);

    expect(() => rng.pick([])).toThrow(RangeError);
    const colors = ['teal', 'orange', 'olive'] as const;
    const choice = rng.pick(colors);
    expect(colors.includes(choice)).toBe(true);

    const original = [10, 20, 30, 40, 50, 60, 70];
    const shuffled = rng.shuffle(original);
    expect(shuffled).not.toBe(original);
    expect(original).toEqual([10, 20, 30, 40, 50, 60, 70]);
    expect(shuffled).toHaveLength(original.length);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(original);

    for (let i = 0; i < 100; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }

    const parentA = createRng(500);
    const parentB = createRng(500);
    const forkA = parentA.fork('ai');
    for (let i = 0; i < 100; i++) {
      parentB.next();
    }
    const forkB = parentB.fork('ai');
    const forkParticles = parentA.fork('particles');

    const seqA = Array.from({ length: 10 }, () => forkA.next());
    const seqB = Array.from({ length: 10 }, () => forkB.next());
    const seqParticles = Array.from({ length: 10 }, () => forkParticles.next());

    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqParticles);
  });

  it('achieves rough uniformity across 60 000 int(0, 5) draws within 10% of 10 000 per bucket', () => {
    const rng = createRng('woodgrain-uniformity');
    const counts = [0, 0, 0, 0, 0, 0];
    const totalDraws = 60000;

    for (let i = 0; i < totalDraws; i++) {
      const outcome = rng.int(0, 5);
      const prev = counts[outcome];
      if (prev !== undefined) {
        counts[outcome] = prev + 1;
      }
    }

    const expected = 10000;
    const tolerance = 1000; // 10% of 10 000
    for (let face = 0; face < 6; face++) {
      const count = counts[face] ?? 0;
      expect(count).toBeGreaterThanOrEqual(expected - tolerance);
      expect(count).toBeLessThanOrEqual(expected + tolerance);
    }
  });
});
