/**
 * The title's joke made visible: a distance clue is hot when the flag is near
 * and cold when it is far. Every look colours its numerals along the same
 * thermal-camera ramp, white-hot at 1 through orange, red and violet to icy
 * blue at 8, so the colour agrees with the number in all three. The number is
 * always printed too; colour only ever helps.
 */
const THERMAL = [
  '#fff1a6',
  '#ffc23d',
  '#ff8a24',
  '#ff4d3a',
  '#ec3d8f',
  '#a957ff',
  '#5b74ff',
  '#7fd8ff',
] as const;

/** A colour-blind-safe ramp: one hue family from warm yellow to deep blue, with lightness doing the work. */
const COLOUR_BLIND = [
  '#ffe8a3',
  '#ffd166',
  '#f4a259',
  '#d98b6c',
  '#a8a3c7',
  '#7f9fd1',
  '#4f86c6',
  '#2f5fa8',
] as const;

/**
 * The same warm-to-cool order as inks dark enough for a light ground (painted tiles, a daylight
 * display): crimson at 1 through orange and plum to teal at 8.
 */
const INKS = [
  '#c8102e',
  '#e4572e',
  '#e98a00',
  '#a86b00',
  '#8e3b8e',
  '#5a48b5',
  '#2f6fb5',
  '#13808f',
] as const;

/** The colour-blind-safe ramp as inks: dark amber through slate to deep blue, lightness falling as it cools. */
const COLOUR_BLIND_INKS = [
  '#9a4a00',
  '#ad5f00',
  '#a8741c',
  '#86704f',
  '#646b86',
  '#4a679f',
  '#2d5797',
  '#1b3f7a',
] as const;

export type HeatPalette = 'thermal' | 'colour-blind';

export const MAX_DISTANCE = 8;

export function heatColour(distance: number, palette: HeatPalette = 'thermal'): string {
  const ramp = palette === 'thermal' ? THERMAL : COLOUR_BLIND;
  const index = Math.min(MAX_DISTANCE, Math.max(1, Math.round(distance))) - 1;
  return ramp[index] ?? ramp[0];
}

export function heatInk(distance: number, palette: HeatPalette = 'thermal'): string {
  const inks = palette === 'thermal' ? INKS : COLOUR_BLIND_INKS;
  return inks[Math.min(MAX_DISTANCE, Math.max(1, Math.round(distance))) - 1] ?? inks[0];
}

/** 1 for a distance of 1 (red hot), 0 for 8 (ice cold). */
export function heat(distance: number): number {
  return (MAX_DISTANCE - Math.min(MAX_DISTANCE, Math.max(1, distance))) / (MAX_DISTANCE - 1);
}
