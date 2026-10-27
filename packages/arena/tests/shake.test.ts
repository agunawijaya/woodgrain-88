/**
 * Tests for camera shake trauma model: zero offset at rest, trauma capping and drain,
 * quadratic amplitude scaling, disable clearing, and deterministic offsets.
 */
import { describe, expect, it } from 'vitest';
import { createCameraShake, type ShakeOptions } from '../src/shake.ts';

describe('createCameraShake', () => {
  it('produces zero offset without trauma, caps trauma at 1, and drains trauma by recovery rate', () => {
    const shake = createCameraShake({
      maxOffset: 2.5,
      maxRoll: 0.08,
      recovery: 0.5,
      enabled: true,
    });

    expect(shake.trauma).toBe(0);
    expect(shake.update(0.1)).toEqual({ x: 0, y: 0, roll: 0 });

    shake.addTrauma(0.4);
    expect(shake.trauma).toBe(0.4);

    shake.addTrauma(0.9);
    expect(shake.trauma).toBe(1);

    shake.update(0.6);
    expect(shake.trauma).toBeCloseTo(0.7, 6);

    shake.update(1.5);
    expect(shake.trauma).toBe(0);
    expect(shake.update(0.1)).toEqual({ x: 0, y: 0, roll: 0 });
  });

  it('bounds offsets within max limits and scales shake magnitude quadratically with trauma', () => {
    const options: ShakeOptions = {
      maxOffset: 3.0,
      maxRoll: 0.12,
      recovery: 0,
      enabled: true,
    };

    const shakeHalf = createCameraShake(options);
    shakeHalf.addTrauma(0.5);

    const shakeFull = createCameraShake(options);
    shakeFull.addTrauma(1.0);

    let maxOffsetHalf = 0;
    let maxOffsetFull = 0;

    for (let step = 0; step < 200; step++) {
      const dt = 0.01;
      const offsetHalf = shakeHalf.update(dt);
      const offsetFull = shakeFull.update(dt);

      expect(Math.abs(offsetFull.x)).toBeLessThanOrEqual(options.maxOffset + 1e-9);
      expect(Math.abs(offsetFull.y)).toBeLessThanOrEqual(options.maxOffset + 1e-9);
      expect(Math.abs(offsetFull.roll)).toBeLessThanOrEqual(options.maxRoll + 1e-9);

      const magHalf = Math.hypot(offsetHalf.x, offsetHalf.y);
      const magFull = Math.hypot(offsetFull.x, offsetFull.y);

      if (magHalf > maxOffsetHalf) maxOffsetHalf = magHalf;
      if (magFull > maxOffsetFull) maxOffsetFull = magFull;
    }

    expect(maxOffsetFull).toBeGreaterThan(0.5);
    expect(maxOffsetHalf / maxOffsetFull).toBeCloseTo(0.25, 4);
  });

  it('ignores trauma when disabled and clears existing trauma on setEnabled(false)', () => {
    const shakeDisabled = createCameraShake({
      maxOffset: 2.0,
      maxRoll: 0.05,
      recovery: 0.5,
      enabled: false,
    });

    shakeDisabled.addTrauma(0.8);
    expect(shakeDisabled.trauma).toBe(0);
    expect(shakeDisabled.update(0.016)).toEqual({ x: 0, y: 0, roll: 0 });

    const shakeActive = createCameraShake({
      maxOffset: 2.0,
      maxRoll: 0.05,
      recovery: 0.5,
      enabled: true,
    });

    shakeActive.addTrauma(0.75);
    expect(shakeActive.trauma).toBe(0.75);
    shakeActive.setEnabled(false);
    expect(shakeActive.trauma).toBe(0);
    expect(shakeActive.update(0.016)).toEqual({ x: 0, y: 0, roll: 0 });
  });

  it('produces identical offsets given the same sequence of calls and delta times', () => {
    const options: ShakeOptions = {
      maxOffset: 2.0,
      maxRoll: 0.06,
      recovery: 0.3,
      enabled: true,
    };

    const shake1 = createCameraShake(options);
    const shake2 = createCameraShake(options);

    shake1.addTrauma(0.8);
    shake2.addTrauma(0.8);

    for (let i = 0; i < 50; i++) {
      const dt = 0.02;
      const o1 = shake1.update(dt);
      const o2 = shake2.update(dt);

      expect(o1.x).toBe(o2.x);
      expect(o1.y).toBe(o2.y);
      expect(o1.roll).toBe(o2.roll);
    }
  });
});
