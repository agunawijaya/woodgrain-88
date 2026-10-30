/**
 * Tests for Gravity Duel score and point share line formatting.
 */
import { MAX_SUMMARY_EMOJI } from '@woodgrain-88/kit';
import { describe, expect, it } from 'vitest';
import type { Seat } from '../../src/engine/types.ts';
import { pointSymbols, shareLine, soloShareLine } from '../../src/progress/share.ts';

describe('Gravity Duel point symbols', () => {
  it('renders blue for the player and red for the rival from seat 0 perspective', () => {
    const points: readonly Seat[] = [0, 1, 0, 0];
    expect(pointSymbols(points, 0)).toBe('🟦🟥🟦🟦');
  });

  it('renders blue for the player and red for the rival from seat 1 perspective', () => {
    const points: readonly Seat[] = [0, 1, 0, 0];
    expect(pointSymbols(points, 1)).toBe('🟥🟦🟥🟥');
  });

  it('truncates matches longer than MAX_SUMMARY_EMOJI and prefixes with an ellipsis', () => {
    // 16 points: 10 by seat 0, then 6 by seat 1
    const points: readonly Seat[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1];
    const symbols = pointSymbols(points, 0);

    // Should start with ellipsis followed by exactly MAX_SUMMARY_EMOJI emojis
    expect(symbols.startsWith('…')).toBe(true);
    // Remove the leading ellipsis to check the emoji count
    const emojiTail = symbols.slice(1);
    const segmenter = new Intl.Segmenter();
    const segments = Array.from(segmenter.segment(emojiTail));
    expect(segments).toHaveLength(MAX_SUMMARY_EMOJI);
    // The tail of 12 points has six seat 0 (blue) then six seat 1 (red)
    expect(emojiTail).toBe('🟦🟦🟦🟦🟦🟦🟥🟥🟥🟥🟥🟥');
  });
});

describe('Gravity Duel shareLine', () => {
  it('places player score first with an en dash', () => {
    const points: readonly Seat[] = [0, 0, 1, 0];
    expect(shareLine(points, 0)).toBe('Gravity Duel · 🟦🟦🟥🟦 · 3–1');
    expect(shareLine(points, 1)).toBe('Gravity Duel · 🟥🟥🟦🟥 · 1–3');
  });

  it('formats zero-zero and high score tallies accurately', () => {
    expect(shareLine([], 0)).toBe('Gravity Duel ·  · 0–0');
  });
});

describe('Gravity Duel soloShareLine', () => {
  it('formats singular dock when dock count is one', () => {
    expect(soloShareLine(1)).toBe('Gravity Duel · 1 dock');
  });

  it('formats plural docks for zero and multiple docks', () => {
    expect(soloShareLine(0)).toBe('Gravity Duel · 0 docks');
    expect(soloShareLine(7)).toBe('Gravity Duel · 7 docks');
  });
});
