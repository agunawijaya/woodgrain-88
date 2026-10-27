/**
 * Tests for frame time budget: initial warmup frame skipping, quality tier degradation
 * on sustained slow frames, one-way quality drops, and partial window stats.
 */
import { describe, expect, it } from 'vitest';
import { createFrameBudget } from '../src/budget.ts';

describe('createFrameBudget', () => {
  it('ignores the first 30 frames regardless of duration', () => {
    const budget = createFrameBudget({
      start: 'high',
      window: 60,
      limitMs: 16.6,
    });

    // Feed 30 very slow frames (50ms); quality should not drop during warmup
    for (let frame = 0; frame < 30; frame++) {
      const drop = budget.record(50);
      expect(drop).toBeNull();
      expect(budget.quality).toBe('high');
    }

    // Samples array should remain empty because warmup frames are bypassed
    expect(budget.stats().frames).toBe(0);
  });

  it('steps quality down from high to medium then to low on slow windows and stops at low', () => {
    const budget = createFrameBudget({
      start: 'high',
      window: 40,
      limitMs: 16.0,
    });

    // Skip 30 warmup frames
    for (let i = 0; i < 30; i++) budget.record(10);

    // First window of 40 slow frames: drops high -> medium
    for (let i = 0; i < 39; i++) {
      expect(budget.record(25)).toBeNull();
    }
    const drop1 = budget.record(25);
    expect(drop1).toBe('medium');
    expect(budget.quality).toBe('medium');

    // Second window of 40 slow frames: drops medium -> low
    for (let i = 0; i < 39; i++) {
      expect(budget.record(25)).toBeNull();
    }
    const drop2 = budget.record(25);
    expect(drop2).toBe('low');
    expect(budget.quality).toBe('low');

    // Third window of 40 slow frames: low cannot drop further
    for (let i = 0; i < 39; i++) {
      expect(budget.record(25)).toBeNull();
    }
    const drop3 = budget.record(25);
    expect(drop3).toBeNull();
    expect(budget.quality).toBe('low');
  });

  it('never changes quality on fast frames and never recovers to a higher quality tier', () => {
    const budget = createFrameBudget({
      start: 'high',
      window: 40,
      limitMs: 16.0,
    });

    // Warmup 30 frames
    for (let i = 0; i < 30; i++) budget.record(8);

    // Full window of fast frames (8ms)
    for (let i = 0; i < 40; i++) {
      expect(budget.record(8)).toBeNull();
    }
    expect(budget.quality).toBe('high');

    // Force one drop to medium with a slow window
    for (let i = 0; i < 40; i++) {
      budget.record(30);
    }
    expect(budget.quality).toBe('medium');

    // Subsequent fast windows do not step back up to high
    for (let windowIdx = 0; windowIdx < 2; windowIdx++) {
      for (let i = 0; i < 40; i++) {
        expect(budget.record(4)).toBeNull();
      }
      expect(budget.quality).toBe('medium');
    }
  });

  it('reports median, 95th percentile, and frame count of the current partial window', () => {
    const budget = createFrameBudget({
      start: 'high',
      window: 100,
      limitMs: 16.0,
    });

    // Skip warmup 30 frames
    for (let i = 0; i < 30; i++) budget.record(5);

    expect(budget.stats()).toEqual({ median: 0, p95: 0, frames: 0 });

    // Record 20 frames with values 1..20
    for (let i = 1; i <= 20; i++) {
      budget.record(i);
    }

    const stats = budget.stats();
    expect(stats.frames).toBe(20);
    // index floor(20 * 0.5) = 10 -> value 11
    expect(stats.median).toBe(11);
    // index floor(20 * 0.95) = 19 -> value 20
    expect(stats.p95).toBe(20);
  });
});
