/**
 * Colour helpers for day and night palettes: parsing, mixing and WCAG
 * contrast. Tests assert every palette pair meets AA with these functions,
 * and The Den uses `ensureContrast` to keep text readable while the TV tints
 * the room at night.
 */

export interface Rgb {
  /** 0–255 each. */
  r: number;
  g: number;
  b: number;
}

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC_RE = /^(rgba?|hsla?)\((.+)\)$/i;
const NUMBER_RE = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
const PERCENT_RE = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))%$/;

type CssArgTuple = [string, string, string] | [string, string, string, string];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function splitCssArgs(inner: string): CssArgTuple | null {
  const body = inner.trim();
  if (body.length === 0) return null;

  if (body.includes(',')) {
    const parts = body.split(',').map((part) => part.trim());
    if (parts.some((part) => part.length === 0 || /[\s/]/.test(part))) return null;
    if (parts.length === 3) {
      const [a, b, c] = parts;
      if (a !== undefined && b !== undefined && c !== undefined) return [a, b, c];
    }
    if (parts.length === 4) {
      const [a, b, c, d] = parts;
      if (a !== undefined && b !== undefined && c !== undefined && d !== undefined) {
        return [a, b, c, d];
      }
    }
    return null;
  }

  const slashParts = body.split('/');
  if (slashParts.length > 2) return null;
  if (slashParts.length === 2) {
    const [left, right] = slashParts;
    if (left === undefined || right === undefined) return null;
    const channels = left.trim().split(/\s+/);
    const alpha = right.trim();
    if (channels.length !== 3 || alpha.length === 0 || /\s/.test(alpha)) return null;
    const [a, b, c] = channels;
    if (a !== undefined && b !== undefined && c !== undefined) return [a, b, c, alpha];
    return null;
  }

  const tokens = body.split(/\s+/);
  if (tokens.length === 3) {
    const [a, b, c] = tokens;
    if (a !== undefined && b !== undefined && c !== undefined) return [a, b, c];
  }
  if (tokens.length === 4) {
    const [a, b, c, d] = tokens;
    if (a !== undefined && b !== undefined && c !== undefined && d !== undefined) {
      return [a, b, c, d];
    }
  }
  return null;
}

function isValidAlphaToken(token: string): boolean {
  return NUMBER_RE.test(token) || PERCENT_RE.test(token);
}

function parseRgbChannel(token: string): number | null {
  const pct = PERCENT_RE.exec(token);
  if (pct?.[1] !== undefined) {
    return Math.round((clamp(Number(pct[1]), 0, 100) * 255) / 100);
  }
  if (NUMBER_RE.test(token)) {
    return Math.round(clamp(Number(token), 0, 255));
  }
  return null;
}

function parseHueToken(token: string): number | null {
  const raw = token.toLowerCase().endsWith('deg') ? token.slice(0, -3) : token;
  if (!NUMBER_RE.test(raw)) return null;
  return ((Number(raw) % 360) + 360) % 360;
}

function parsePercentUnit(token: string): number | null {
  const pct = PERCENT_RE.exec(token);
  if (pct?.[1] === undefined) return null;
  return clamp(Number(pct[1]), 0, 100) / 100;
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (h < 60) {
    rPrime = c;
    gPrime = x;
  } else if (h < 120) {
    rPrime = x;
    gPrime = c;
  } else if (h < 180) {
    gPrime = c;
    bPrime = x;
  } else if (h < 240) {
    gPrime = x;
    bPrime = c;
  } else if (h < 300) {
    rPrime = x;
    bPrime = c;
  } else {
    rPrime = c;
    bPrime = x;
  }

  return {
    r: Math.round((rPrime + m) * 255),
    g: Math.round((gPrime + m) * 255),
    b: Math.round((bPrime + m) * 255),
  };
}

function rgbToHsl(rgb: Rgb): { h: number; s: number; l: number } {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) {
    return { h: 0, s: 0, l };
  }

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) {
    h = ((g - b) / delta) % 6;
  } else if (max === g) {
    h = (b - r) / delta + 2;
  } else {
    h = (r - g) / delta + 4;
  }
  return { h: (h * 60 + 360) % 360, s, l };
}

/** Accepts #rgb, #rrggbb, #rrggbbaa (alpha ignored), rgb()/rgba() and hsl()/hsla(). Throws on anything else. */
export function parseColor(css: string): Rgb {
  const trimmed = css.trim();
  const hexMatch = HEX_RE.exec(trimmed);
  if (hexMatch?.[1] !== undefined) {
    const hex = hexMatch[1];
    if (hex.length === 3) {
      const rHex = hex.slice(0, 1);
      const gHex = hex.slice(1, 2);
      const bHex = hex.slice(2, 3);
      return {
        r: Number.parseInt(rHex + rHex, 16),
        g: Number.parseInt(gHex + gHex, 16),
        b: Number.parseInt(bHex + bHex, 16),
      };
    }
    return {
      r: Number.parseInt(hex.slice(0, 2), 16),
      g: Number.parseInt(hex.slice(2, 4), 16),
      b: Number.parseInt(hex.slice(4, 6), 16),
    };
  }

  const funcMatch = FUNC_RE.exec(trimmed);
  if (funcMatch?.[1] !== undefined && funcMatch[2] !== undefined) {
    const fn = funcMatch[1].toLowerCase();
    const args = splitCssArgs(funcMatch[2]);
    if (args !== null) {
      if (args.length === 4 && !isValidAlphaToken(args[3])) {
        throw new Error(`Cannot read colour: ${css}`);
      }
      if (fn === 'rgb' || fn === 'rgba') {
        const r = parseRgbChannel(args[0]);
        const g = parseRgbChannel(args[1]);
        const b = parseRgbChannel(args[2]);
        if (r !== null && g !== null && b !== null) {
          return { r, g, b };
        }
      } else {
        const h = parseHueToken(args[0]);
        const s = parsePercentUnit(args[1]);
        const l = parsePercentUnit(args[2]);
        if (h !== null && s !== null && l !== null) {
          return hslToRgb(h, s, l);
        }
      }
    }
  }

  throw new Error(`Cannot read colour: ${css}`);
}

function channelHex(value: number): string {
  const clamped = Math.round(clamp(value, 0, 255));
  return clamped.toString(16).padStart(2, '0');
}

/** Lowercase #rrggbb. */
export function toHex(color: Rgb): string {
  return `#${channelHex(color.r)}${channelHex(color.g)}${channelHex(color.b)}`;
}

function linearizeChannel(channel: number): number {
  const s = clamp(channel, 0, 255) / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(color: string | Rgb): number {
  const rgb = typeof color === 'string' ? parseColor(color) : color;
  const r = linearizeChannel(rgb.r);
  const g = linearizeChannel(rgb.g);
  const b = linearizeChannel(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. */
export function contrastRatio(a: string | Rgb, b: string | Rgb): number {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** AA: 4.5 for body text, 3 for large text and UI shapes. */
export function meetsAA(
  foreground: string,
  background: string,
  options?: { large?: boolean },
): boolean {
  const threshold = options?.large === true ? 3 : 4.5;
  return contrastRatio(foreground, background) >= threshold;
}

/** Linear blend in sRGB; t = 0 gives a, t = 1 gives b. Returns #rrggbb. */
export function mix(a: string, b: string, t: number): string {
  const colorA = parseColor(a);
  const colorB = parseColor(b);
  const ratio = clamp(t, 0, 1);
  return toHex({
    r: Math.round(colorA.r + (colorB.r - colorA.r) * ratio),
    g: Math.round(colorA.g + (colorB.g - colorA.g) * ratio),
    b: Math.round(colorA.b + (colorB.b - colorA.b) * ratio),
  });
}

/** rgba(r, g, b, alpha) from any parseable colour. */
export function withAlpha(color: string, alpha: number): string {
  const rgb = parseColor(color);
  const clampedAlpha = clamp(alpha, 0, 1);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${clampedAlpha})`;
}

/**
 * The nearest colour to `color` (moving towards white or black, whichever
 * can reach the target) whose contrast against `against` is at least
 * `minRatio`. Returns `color` unchanged when it already passes.
 */
export function ensureContrast(color: string, against: string, minRatio: number): string {
  const fg = parseColor(color);
  const bg = parseColor(against);
  if (contrastRatio(fg, bg) >= minRatio) {
    return color;
  }

  const { h, s, l } = rgbToHsl(fg);
  const darkBackground = relativeLuminance(bg) < 0.5;
  const targetL = darkBackground ? 1 : 0;
  const steps = 255;

  for (let step = 1; step <= steps; step++) {
    const nextL = l + ((targetL - l) * step) / steps;
    const candidate = hslToRgb(h, s, nextL);
    if (contrastRatio(candidate, bg) >= minRatio) {
      return toHex(candidate);
    }
  }

  return darkBackground ? '#ffffff' : '#000000';
}
