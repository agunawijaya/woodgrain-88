/**
 * Keeps an eye on frame time. If a machine cannot hold 60 fps with the full
 * finish, the game steps its quality down once rather than stuttering
 * through a match; it never steps back up mid-match, so the look does not
 * flicker between tiers.
 */
import type { Quality } from './post.ts';

export interface FrameBudget {
  /** Records one frame's duration in milliseconds; returns a lower quality when it is time to drop. */
  record(frameMs: number): Quality | null;
  readonly quality: Quality;
  /** Median and 95th percentile of the recent window, for reports and tests. */
  stats(): { median: number; p95: number; frames: number };
}

export interface BudgetOptions {
  readonly start: Quality;
  /** Frames per evaluation window. */
  readonly window: number;
  /** Drop a tier when the window's 95th percentile exceeds this many milliseconds. */
  readonly limitMs: number;
}

const LOWER: Record<Quality, Quality | null> = { high: 'medium', medium: 'low', low: null };

export function createFrameBudget(options: BudgetOptions): FrameBudget {
  let quality = options.start;
  const samples: number[] = [];
  let skipped = 0;

  function percentile(sorted: readonly number[], fraction: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
    return sorted[index] ?? 0;
  }

  return {
    get quality() {
      return quality;
    },
    record(frameMs) {
      // The first frames include shader compilation and texture uploads; they say nothing about the machine.
      if (skipped < 30) {
        skipped++;
        return null;
      }
      samples.push(frameMs);
      if (samples.length < options.window) return null;
      const sorted = [...samples].sort((a, b) => a - b);
      samples.length = 0;
      const lower = LOWER[quality];
      if (lower && percentile(sorted, 0.95) > options.limitMs) {
        quality = lower;
        return lower;
      }
      return null;
    },
    stats() {
      const sorted = [...samples].sort((a, b) => a - b);
      return {
        median: percentile(sorted, 0.5),
        p95: percentile(sorted, 0.95),
        frames: sorted.length,
      };
    },
  };
}
