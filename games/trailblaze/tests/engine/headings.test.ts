/**
 * Tests for compass headings, unit vectors, opposite directions, diagonal checks,
 * and stick-to-heading decoding under 4-way and 8-way steering.
 */
import { describe, expect, it } from 'vitest';
import {
  HEADINGS,
  headingFromStick,
  isDiagonal,
  opposite,
  vectorOf,
} from '../../src/engine/headings.ts';
import { IDLE, type Heading, type Stick } from '../../src/engine/types.ts';

function stick(east: -1 | 0 | 1, south: -1 | 0 | 1, fire = false): Stick {
  return { east, south, fire };
}

describe('headings', () => {
  it('lists all eight headings with inverting opposites and unit vectors', () => {
    expect(HEADINGS).toHaveLength(8);
    for (const heading of HEADINGS) {
      const vec = vectorOf(heading);
      const opp = opposite(heading);
      const oppVec = vectorOf(opp);
      expect(opposite(opp)).toBe(heading);
      expect(oppVec.east).toBe(vec.east === 0 ? 0 : -vec.east);
      expect(oppVec.south).toBe(vec.south === 0 ? 0 : -vec.south);
      expect(isDiagonal(heading)).toBe(vec.east !== 0 && vec.south !== 0);
    }
  });

  it('returns null when the stick is centred regardless of fire or steering mode', () => {
    expect(headingFromStick(IDLE, 4)).toBeNull();
    expect(headingFromStick(IDLE, 8)).toBeNull();
    expect(headingFromStick(stick(0, 0, true), 4)).toBeNull();
    expect(headingFromStick(stick(0, 0, true), 8)).toBeNull();
  });

  it('resolves all eight directions under 8-way steering', () => {
    const cases: readonly [Stick, Heading][] = [
      [stick(0, -1), 'up'],
      [stick(0, 1), 'down'],
      [stick(-1, 0), 'left'],
      [stick(1, 0), 'right'],
      [stick(-1, -1), 'up-left'],
      [stick(1, -1), 'up-right'],
      [stick(-1, 1), 'down-left'],
      [stick(1, 1), 'down-right'],
    ];
    for (const [input, expected] of cases) {
      expect(headingFromStick(input, 8)).toBe(expected);
    }
  });

  it('prioritises horizontal over vertical when both axes are pushed under 4-way steering', () => {
    expect(headingFromStick(stick(0, -1), 4)).toBe('up');
    expect(headingFromStick(stick(0, 1), 4)).toBe('down');
    expect(headingFromStick(stick(-1, 0), 4)).toBe('left');
    expect(headingFromStick(stick(1, 0), 4)).toBe('right');

    // The 1977 program checks right and left before down and up, and skips the
    // vertical check when 8-way steering is off.
    expect(headingFromStick(stick(1, -1), 4)).toBe('right');
    expect(headingFromStick(stick(1, 1), 4)).toBe('right');
    expect(headingFromStick(stick(-1, -1), 4)).toBe('left');
    expect(headingFromStick(stick(-1, 1), 4)).toBe('left');
  });
});
