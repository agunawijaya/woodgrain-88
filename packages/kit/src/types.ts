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

/** Each seat's console difficulty switch, reborn as Amateur / Pro (prompt 01 gives it rules). */
export type ProSwitchPosition = 'amateur' | 'pro';

/** An ISO 8601 timestamp, e.g. "2026-10-25T18:30:00.000Z". */
export type IsoTime = string;
