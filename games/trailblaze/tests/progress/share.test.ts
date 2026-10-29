/**
 * Tests for Trailblaze point summary symbols and share line formatting:
 * player/rival/shared crash emoji, truncation with horizontal ellipsis for
 * long matches, player-first score ordering, and kit emojiSummary validation.
 */
import { emojiSummary } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import type { PointTaker } from '../../src/session/match-session.ts';
import { pointSymbols, shareLine } from '../../src/progress/share.ts';

describe('share', () => {
  it('formats point symbols from seat 1 perspective: 🟦 player, 🟥 rival, ⬜ both', () => {
    // Player is seat 1: seat 1 is player (🟦), seat 0 is rival (🟥)
    const points: PointTaker[] = [1, 1, 0, 'both', 1];
    const symbols = pointSymbols(points, 1);
    expect(symbols).toBe('🟦🟦🟥⬜🟦');

    // Readable by kit's emojiSummary validator
    const parsed = emojiSummary(symbols);
    expect(parsed).toEqual(['🟦', '🟦', '🟥', '⬜', '🟦']);
  });

  it('formats point symbols from seat 0 perspective', () => {
    // Player is seat 0: seat 0 is player (🟦), seat 1 is rival (🟥)
    const points: PointTaker[] = [0, 1, 'both'];
    const symbols = pointSymbols(points, 0);
    expect(symbols).toBe('🟦🟥⬜');
    expect(emojiSummary(symbols)).toEqual(['🟦', '🟥', '⬜']);
  });

  it('truncates matches beyond MAX_SUMMARY_EMOJI with leading ellipsis and keeps last 12 points', () => {
    // 16 points in total: 10 player (seat 1), 6 rival (seat 0)
    const points: PointTaker[] = [
      0,
      0,
      0,
      0, // first 4: will be truncated
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0, // last 12
    ];
    expect(points).toHaveLength(16);

    const symbols = pointSymbols(points, 1);
    expect(symbols.startsWith('…')).toBe(true);

    // The tail after '…' contains exactly 12 emoji symbols
    const tail = symbols.slice(1);
    const parsedTail = emojiSummary(tail);
    expect(parsedTail).toHaveLength(12);
    expect(tail).toBe('🟦🟦🟦🟦🟦🟦🟦🟦🟦🟦🟥🟥');
  });

  it('generates a share line for a 10–6 match with player score first', () => {
    const points: PointTaker[] = [
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1, // 10 player points
      0,
      0,
      0,
      0,
      0,
      0, // 6 rival points
    ];
    const line = shareLine(points, 1);
    expect(line).toContain('Trailblaze · ');
    expect(line).toContain(' · 10–6');
    expect(line.startsWith('Trailblaze · …')).toBe(true);
  });

  it('generates a share line for a short match without ellipsis', () => {
    const points: PointTaker[] = [1, 1, 0, 'both', 1];
    const line = shareLine(points, 1);
    expect(line).toBe('Trailblaze · 🟦🟦🟥⬜🟦 · 4–2');
  });
});
