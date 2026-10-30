import { describe, expect, it } from 'vitest';
import { SHARP_KIDS_MARK, SHARP_KIDS_NOTE, withKidsMark } from '../src/kids/mode.ts';

describe('withKidsMark', () => {
  it('leaves the line unchanged for human Kids', () => {
    expect(withKidsMark('Won 3–1', 'human')).toBe('Won 3–1');
  });

  it('appends the Sharp Kids mark', () => {
    expect(withKidsMark('Won 3–1', 'sharp')).toBe('Won 3–1 · Sharp Kids');
  });

  it('leaves the line unchanged when no Kids played', () => {
    expect(withKidsMark('Won 3–1', undefined)).toBe('Won 3–1');
  });
});

describe('SHARP_KIDS_MARK and SHARP_KIDS_NOTE', () => {
  it('have the exact text the Den shows', () => {
    expect(SHARP_KIDS_MARK).toBe('Sharp Kids');
    expect(SHARP_KIDS_NOTE).toBe(
      'Sharp Kids remember everything, never fumble and react twice as fast.',
    );
  });
});
