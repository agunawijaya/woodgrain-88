import { describe, expect, it } from 'vitest';
import { KID_IDS } from '../src/kids.ts';
import { aimProfile, heldFor, KID_AIM, leadShare, type AimProfile } from '../src/kids/aim.ts';
import { createRng } from '../src/rng.ts';

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: readonly number[]): number {
  const centre = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - centre) ** 2)));
}

describe('Kid aim profiles', () => {
  it('gives every Kid a profile, Lou leading best and Pip worst', () => {
    for (const kid of KID_IDS) expect(KID_AIM[kid]).toBeDefined();
    const biases = KID_IDS.map((kid) => KID_AIM[kid].leadBias);
    expect(KID_AIM.lou.leadBias).toBe(Math.max(...biases));
    expect(KID_AIM.pip.leadBias).toBe(Math.min(...biases));
  });

  it('leaves human profiles as they are', () => {
    expect(aimProfile('rosa', 'human')).toBe(KID_AIM.rosa);
  });

  it('makes sharp Kids lead exactly, never overshoot, and wobble half as much', () => {
    const sharp = aimProfile('pip', 'sharp');
    expect(sharp).toEqual({ leadBias: 1, leadSpread: KID_AIM.pip.leadSpread / 2, overshoot: 0 });
  });
});

describe('leadShare', () => {
  it('centres on the bias with the profile spread', () => {
    const profile: AimProfile = { leadBias: 0.7, leadSpread: 0.1, overshoot: 0 };
    const rng = createRng('lead');
    const shares = Array.from({ length: 4000 }, () => leadShare(profile, rng));
    expect(mean(shares)).toBeCloseTo(0.7, 1);
    expect(standardDeviation(shares)).toBeCloseTo(0.1, 1);
  });

  it('never aims behind the target', () => {
    const wild: AimProfile = { leadBias: 0.1, leadSpread: 1, overshoot: 0 };
    const rng = createRng('behind');
    for (let shot = 0; shot < 2000; shot++) expect(leadShare(wild, rng)).toBeGreaterThanOrEqual(0);
  });

  it('is exact with no spread', () => {
    const steady: AimProfile = { leadBias: 0.9, leadSpread: 0, overshoot: 0 };
    expect(leadShare(steady, createRng(1))).toBe(0.9);
  });

  it('repeats for the same seed', () => {
    const first = createRng('same');
    const second = createRng('same');
    for (let shot = 0; shot < 50; shot++) {
      expect(leadShare(KID_AIM.benny, first)).toBe(leadShare(KID_AIM.benny, second));
    }
  });
});

describe('heldFor', () => {
  it('always holds at least as long as needed, and longer on average by the overshoot', () => {
    const profile: AimProfile = { leadBias: 1, leadSpread: 0, overshoot: 0.5 };
    const rng = createRng('hold');
    const holds = Array.from({ length: 4000 }, () => heldFor(10, profile, rng));
    for (const hold of holds) expect(hold).toBeGreaterThanOrEqual(10);
    // The mean of a half-normal is sqrt(2/pi), about 0.8 of its scale.
    expect(mean(holds)).toBeCloseTo(10 * (1 + 0.5 * Math.sqrt(2 / Math.PI)), 0);
  });

  it('holds exactly what is needed with no overshoot', () => {
    expect(heldFor(12, { ...KID_AIM.lou, overshoot: 0 }, createRng(2))).toBe(12);
  });

  it('holds nothing when nothing is needed', () => {
    expect(heldFor(0, KID_AIM.dee, createRng(3))).toBe(0);
    expect(heldFor(-4, KID_AIM.dee, createRng(3))).toBe(0);
  });

  it('overshoots more for Dee than for Lou over many pushes', () => {
    const rng = createRng('touch');
    const lou = mean(Array.from({ length: 2000 }, () => heldFor(10, KID_AIM.lou, rng)));
    const dee = mean(Array.from({ length: 2000 }, () => heldFor(10, KID_AIM.dee, rng)));
    expect(dee).toBeGreaterThan(lou);
  });
});
