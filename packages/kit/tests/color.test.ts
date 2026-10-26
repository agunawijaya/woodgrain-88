/**
 * Tests for colour parsing, hex conversion, WCAG 2.x luminance and contrast,
 * sRGB mixing, alpha formatting and contrast adjustment.
 */
import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  ensureContrast,
  meetsAA,
  mix,
  parseColor,
  relativeLuminance,
  toHex,
  withAlpha,
} from '../src/color.ts';

describe('parseColor', () => {
  it('parses 3-digit, 6-digit and 8-digit hex colours case-insensitively with whitespace', () => {
    expect(parseColor('#09f')).toEqual({ r: 0, g: 153, b: 255 });
    expect(parseColor('  #1A2b3C  ')).toEqual({ r: 26, g: 43, b: 60 });
    expect(parseColor('#ff800080')).toEqual({ r: 255, g: 128, b: 0 });
  });

  it('parses comma-separated and space-separated rgb() and rgba() values including percentages', () => {
    expect(parseColor('rgb(12, 34, 56)')).toEqual({ r: 12, g: 34, b: 56 });
    expect(parseColor('RGBA(255, 0, 128, 0.5)')).toEqual({ r: 255, g: 0, b: 128 });
    expect(parseColor('rgb(100% 50% 0%)')).toEqual({ r: 255, g: 128, b: 0 });
    expect(parseColor('rgba(20% 40% 60% / 80%)')).toEqual({ r: 51, g: 102, b: 153 });
  });

  it('parses hsl() and hsla() values across the hue wheel', () => {
    expect(parseColor('hsl(0, 100%, 50%)')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseColor('HSL(120, 100%, 50%)')).toEqual({ r: 0, g: 255, b: 0 });
    expect(parseColor('hsla(240, 100%, 50%, 0.25)')).toEqual({ r: 0, g: 0, b: 255 });
    expect(parseColor('hsl(300 50% 40% / 1)')).toEqual({ r: 153, g: 51, b: 153 });
  });

  it('throws the expected error message on invalid colour inputs', () => {
    expect(() => parseColor('not-a-color')).toThrow('Cannot read colour: not-a-color');
    expect(() => parseColor('#12345')).toThrow('Cannot read colour: #12345');
    expect(() => parseColor('rgb(10, 20)')).toThrow('Cannot read colour: rgb(10, 20)');
    expect(() => parseColor('hsl(120, 50, 50)')).toThrow('Cannot read colour: hsl(120, 50, 50)');
    expect(() => parseColor('')).toThrow('Cannot read colour: ');
  });
});

describe('toHex, mix and withAlpha', () => {
  it('formats Rgb values as lowercase #rrggbb', () => {
    expect(toHex({ r: 255, g: 10, b: 0 })).toBe('#ff0a00');
  });

  it('mixes two colours linearly in sRGB and clamps t to [0, 1]', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#102030', '#406080', -2)).toBe('#102030');
    expect(mix('#102030', '#406080', 5)).toBe('#406080');
  });

  it('formats rgba() with alpha clamped to [0, 1]', () => {
    expect(withAlpha('#336699', 0.4)).toBe('rgba(51, 102, 153, 0.4)');
    expect(withAlpha('#336699', -1)).toBe('rgba(51, 102, 153, 0)');
    expect(withAlpha('#336699', 2)).toBe('rgba(51, 102, 153, 1)');
  });
});

describe('WCAG luminance, contrastRatio, meetsAA and ensureContrast', () => {
  it('computes WCAG 2.x reference luminance and contrast ratios', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBe(1);
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(contrastRatio('#3b6ea5', '#3b6ea5')).toBe(1);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('checks AA thresholds for normal (4.5) and large (3.0) text', () => {
    expect(meetsAA('#777777', '#ffffff')).toBe(false);
    expect(meetsAA('#767676', '#ffffff')).toBe(true);
    expect(meetsAA('#777777', '#ffffff', { large: true })).toBe(true);
    expect(meetsAA('#959595', '#ffffff', { large: true })).toBe(false);
  });

  it('returns the original colour when it already meets the target contrast', () => {
    expect(ensureContrast('#111111', '#ffffff', 4.5)).toBe('#111111');
  });

  it('nudges lightness to reach 4.5 against both dark and light backgrounds', () => {
    const onDark = ensureContrast('#445566', '#14161f', 4.5);
    expect(contrastRatio(onDark, '#14161f')).toBeGreaterThanOrEqual(4.5);

    const onLight = ensureContrast('#8899aa', '#f7f1e3', 4.5);
    expect(contrastRatio(onLight, '#f7f1e3')).toBeGreaterThanOrEqual(4.5);
  });

  it('falls back to white or black when the target ratio cannot be exceeded', () => {
    expect(ensureContrast('#555555', '#222222', 21)).toBe('#ffffff');
    expect(ensureContrast('#aaaaaa', '#dddddd', 21)).toBe('#000000');
  });
});
