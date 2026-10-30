import { describe, expect, it } from 'vitest';
import {
  bestShot,
  closestApproach,
  coastPath,
  coastTo,
  headingDifference,
  headingToward,
  missilePath,
  ticksToCentre,
  wrapAngle,
  type Motion,
} from '../../src/ai/forecast.ts';
import {
  CENTRE_RADIUS,
  CENTRE_X,
  CENTRE_Y,
  SHIP_RADIUS,
  SUBPIXELS,
} from '../../src/engine/types.ts';
import { variation } from '../../src/engine/variations.ts';

const at = (x: number, y: number, vx = 0, vy = 0): Motion => ({
  x: x * SUBPIXELS,
  y: y * SUBPIXELS,
  vx: vx * 256,
  vy: vy * 256,
});

describe('headings', () => {
  it('points the 16 headings the engine way: 0 right, 4 up, 8 left, 12 down', () => {
    expect(headingToward(1, 0)).toBe(0);
    expect(headingToward(0, -1)).toBe(4);
    expect(headingToward(-1, 0)).toBe(8);
    expect(headingToward(0, 1)).toBe(12);
    expect(headingToward(1, -1)).toBe(2);
  });

  it('measures the short way round between headings', () => {
    expect(headingDifference(0, 3)).toBe(3);
    expect(headingDifference(0, 13)).toBe(-3);
    expect(headingDifference(15, 1)).toBe(2);
    expect(headingDifference(0, 8)).toBe(8);
  });

  it('wraps angles into (−π, π]', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(0.5)).toBe(0.5);
  });
});

describe('coasting', () => {
  it('drifts in a straight line without gravity', () => {
    const later = coastTo(at(20, 20, 16, 0), 10, variation(1), SHIP_RADIUS);
    expect(later.x).toBe(30 * SUBPIXELS);
    expect(later.y).toBe(20 * SUBPIXELS);
  });

  it('falls toward the star on the star variations, and not elsewhere', () => {
    const resting = at(50, 45);
    expect(ticksToCentre(resting, 3000, variation(4), SHIP_RADIUS, 9)).not.toBeNull();
    expect(ticksToCentre(resting, 3000, variation(1), SHIP_RADIUS, 9)).toBeNull();
  });

  it('samples the guide path every few ticks', () => {
    const path = coastPath(at(20, 20, 16, 0), 30, variation(1), SHIP_RADIUS, 6);
    expect(path).toHaveLength(5);
    expect(path[0]).toEqual({ x: 26 * SUBPIXELS, y: 20 * SUBPIXELS });
  });
});

describe('missiles', () => {
  it('stops a forecast flight where the star swallows it', () => {
    // From the left of the star, fired straight at it.
    const path = missilePath(at(40, 45), 0, variation(4), 1);
    const last = path.at(-1);
    expect(last).toBeDefined();
    const distance = Math.hypot(
      ((last?.x ?? 0) - CENTRE_X) / SUBPIXELS,
      ((last?.y ?? 0) - CENTRE_Y) / SUBPIXELS,
    );
    expect(distance).toBeGreaterThan(CENTRE_RADIUS);
    expect(path.length).toBeLessThan(128);
  });

  it('finds the closest pass on a target moving in a straight line', () => {
    // A body drifting right at one step a tick passes a still target 5 steps below its path.
    const pass = closestApproach(at(20, 20, 16, 0), at(40, 25), 1, 60, variation(1), 1);
    expect(pass.miss).toBeCloseTo(5, 0);
    expect(pass.at).toBe(20);
  });

  it('lines up a straight shot at a still target in open space', () => {
    const shot = bestShot(at(30, 45), at(70, 45), variation(1), [14, 15, 0, 1, 2], {
      lead: 1,
      pull: 1,
      tolerance: 3,
      bendBonus: 0,
    });
    expect(shot?.heading).toBe(0);
    expect(shot?.miss).toBeLessThan(1);
  });

  it('prefers a bent shot when told to, round the star', () => {
    const all = [...Array(16).keys()];
    const sense = { lead: 1, pull: 1, tolerance: 6, bendBonus: 0 };
    const straight = bestShot(at(30, 20), at(130, 70), variation(4), all, sense);
    const bent = bestShot(at(30, 20), at(130, 70), variation(4), all, { ...sense, bendBonus: 3 });
    expect(straight).not.toBeNull();
    expect(Math.abs(bent?.bend ?? 0)).toBeGreaterThanOrEqual(Math.abs(straight?.bend ?? 0));
  });
});
