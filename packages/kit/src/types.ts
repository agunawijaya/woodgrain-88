/**
 * Small shared vocabulary used across the kit. Kept apart from contract.ts so
 * low-level modules (store, daily, records) can use it without importing the
 * whole game contract.
 */

export const FAMILIES = ['duels', 'brain', 'sports', 'arcade'] as const;
export type Family = (typeof FAMILIES)[number];

export const RUN_MODES = [
  'normal',
  'daily',
  'challenge',
  'power-cycle-run',
  'versus-night',
] as const;
export type RunMode = (typeof RUN_MODES)[number];

/** What the player chose. */
export type AppearancePreference = 'light' | 'dark' | 'system';
/** What is actually on screen: the Den by day or by night. */
export type Appearance = 'light' | 'dark';

/** Whether a bigger score is better (most games) or a smaller one (golf strokes, ski times). */
export type ScoreOrder = 'higher' | 'lower';

/**
 * A console difficulty switch, as on the original: A is hard, B is easy. The
 * left switch belongs to the left player (seat 1), the right one to the right
 * player (seat 2). Each game decides what A means, as its original did.
 */
export type SwitchPosition = 'A' | 'B';

export interface DifficultySwitches {
  left: SwitchPosition;
  right: SwitchPosition;
}

/** Both switches on B, as a console comes out of the box. */
export const EASY_SWITCHES: DifficultySwitches = { left: 'B', right: 'B' };

/** An ISO 8601 timestamp, e.g. "2026-10-25T18:30:00.000Z". */
export type IsoTime = string;
