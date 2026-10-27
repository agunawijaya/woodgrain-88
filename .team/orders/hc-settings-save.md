---
id: hc-settings-save
kind: plumbing
model: gemini-3.8-flash-high
fence:
  - games/hot-and-cold/src/app/settings.ts
  - games/hot-and-cold/src/app/save.ts
  - games/hot-and-cold/tests/settings.test.ts
  - games/hot-and-cold/tests/save.test.ts
acceptance:
  - pnpm exec vitest run --project hot-and-cold games/hot-and-cold/tests/settings.test.ts games/hot-and-cold/tests/save.test.ts
  - pnpm exec eslint games/hot-and-cold/src/app games/hot-and-cold/tests/settings.test.ts games/hot-and-cold/tests/save.test.ts
  - pnpm exec prettier --check games/hot-and-cold/src/app games/hot-and-cold/tests/settings.test.ts games/hot-and-cold/tests/save.test.ts
  - pnpm exec tsc -p games/hot-and-cold/tsconfig.json
reads:
  - games/tank-duel/src/app/settings.ts
  - games/tank-duel/src/app/save.ts
  - games/tank-duel/tests/settings.test.ts
  - games/tank-duel/tests/save.test.ts
  - packages/kit/src/settings.ts
  - packages/kit/src/contract.ts
  - packages/kit/src/kids.ts
---

## Goal

Write Hot & Cold's own settings store and save slot, following Tank Duel's `app/settings.ts` and
`app/save.ts` closely (same structure, same defensive parsing, same style), with the fields below.
Include tests for both.

## Context

Hot & Cold (`games/hot-and-cold/`) is a hidden-flag hunt with three visual looks. Its settings live
in the game's namespace of the kit settings (`GameSettingsStore`). Its save lives in the game's
`SaveSlot`, versioned. Copy Tank Duel's approach:

- every stored field is parsed with a fallback to its own default, so junk from an older build costs
  only that field;
- `update` stores only the changed keys and tells listeners.

Storage keys are `hc.<field>`.

## Interface to implement

`games/hot-and-cold/src/app/settings.ts`:

```ts
import type { GameSettingsStore, Unsubscribe } from '@woodgrain-88/kit';

export type LookChoice = 'polar' | 'tabletop' | 'radar';

export interface HotColdSettings {
  /** The look: Polar Expedition (default), Tabletop Board or Radar Room. Changes only the picture. */
  readonly look: LookChoice;
  /** Notebook: clues stay on the field (default). Classic Memory: a clue shows only while reveal is held. */
  readonly clues: 'notebook' | 'classic';
  /** Possibility fog: squares that can no longer hold the flag dim. Default false. */
  readonly fog: boolean;
  /** Cartridge (15 or 75, as in 1978; the default) or Short (first to 5). */
  readonly matchLength: 'cartridge' | 'short';
  /** The numerals' warm-to-cool colours, or a colour-blind-safe ramp. Default 'standard'. */
  readonly clueColours: 'standard' | 'colour-blind';
  /** The two seats' colours: orange and sky blue, or amber and periwinkle. Default 'standard'. */
  readonly seatColours: 'standard' | 'colour-blind';
  /** Blasts, confetti and flares in full, or quietened. Default 'full'. */
  readonly effects: 'full' | 'reduced';
  /** Steps, pings and fanfares, 0–1. Default 0.8. */
  readonly effectsVolume: number;
}

export const DEFAULT_HOT_COLD_SETTINGS: HotColdSettings;

export interface HotColdSettingsStore {
  get(): HotColdSettings;
  update(change: Partial<HotColdSettings>): HotColdSettings;
  onChange(listener: (settings: HotColdSettings) => void): Unsubscribe;
}

export function createHotColdSettings(store: GameSettingsStore): HotColdSettingsStore;
```

`games/hot-and-cold/src/app/save.ts`:

```ts
import type { KidId, SaveSlot } from '@woodgrain-88/kit';

export interface KidRecord {
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
}

/** A best result on one board: a channel, played one way. */
export interface BestRun {
  /** The result's score (higher is better). */
  readonly score: number;
  /** How it reads, e.g. "12 flags" or "4 checks". */
  readonly label: string;
  /** ISO date-time. */
  readonly at: string;
}

export interface HotColdSave {
  readonly kids: Readonly<Record<KidId, KidRecord>>;
  /** Finished matches per channel id. */
  readonly played: Readonly<Record<string, number>>;
  /** Best per board; the key is `${channel}|${mode}|${clues}|${memory}` (see `boardKey`). */
  readonly bests: Readonly<Record<string, BestRun>>;
  /** Flags found in a row without setting off a bomb, carried from match to match. */
  readonly cleanStreak: number;
  readonly tutorialDone: boolean;
}

export const SAVE_VERSION = 1;
export function emptySave(): HotColdSave;
export function boardKey(
  channel: string,
  mode: string,
  clues: 'notebook' | 'classic',
  memory: 'human' | 'sharp',
): string;
export function readSave(slot: SaveSlot): HotColdSave;
export function writeSave(slot: SaveSlot, save: HotColdSave): void;

export interface FinishedMatch {
  readonly channel: string;
  /** The Kid in seat 2, or null when seat 2 was a person or nobody. */
  readonly kid: KidId | null;
  /** Seat 1's outcome; null for solo play (no win or loss against anyone). */
  readonly outcome: 'win' | 'loss' | 'draw' | null;
  readonly board: string;
  readonly score: number;
  readonly label: string;
  readonly at: string;
}

/** Counts the match, adds the Kid's record, and keeps the best per board (a tie keeps the older). */
export function recordMatch(save: HotColdSave, match: FinishedMatch): HotColdSave;
/** A flag found without a bomb on its field adds one to the streak; a bomb sets it back to 0. */
export function recordFlag(save: HotColdSave, clean: boolean): HotColdSave;
export function recordBomb(save: HotColdSave): HotColdSave;
export function finishTutorial(save: HotColdSave): HotColdSave;
```

## Behaviour and edge cases

1. `createHotColdSettings`:
   - unset or junk values read as the defaults, field by field;
   - `effectsVolume` is clamped to 0–1;
   - `update` with an unchanged value stores nothing and does not notify;
   - a changed value is stored under `hc.<field>`, and listeners get the new settings.
2. `readSave`:
   - returns `emptySave()` for a missing save, a wrong version or a non-object;
   - a damaged Kid record or an unknown Kid is dropped and starts from zero;
   - `played` keeps only non-negative integer counts;
   - `bests` keeps only entries whose score is a finite number and whose label and `at` are
     non-empty strings;
   - `cleanStreak` must be a non-negative integer, else 0;
   - `tutorialDone` must be a boolean, else false.
3. `writeSave` stores with `SAVE_VERSION`.
4. `recordMatch`:
   - adds 1 to `played[channel]`;
   - with a Kid and an outcome, adds that outcome to the Kid's record;
   - keeps the board's best when the new score is strictly higher, or when there is none yet.
5. `recordFlag(save, true)` adds 1 to `cleanStreak`; `recordFlag(save, false)` sets it to 0, and
   so does `recordBomb`.
6. All functions are pure: they return a new save and never change their input.

## Tests required

- `tests/settings.test.ts`: defaults, junk values fall back, clamping, an unchanged update stores
  nothing, a change is stored under its key and notifies.
- `tests/save.test.ts`: the empty save for missing and wrong-version data; each damaged field falls
  back alone; `recordMatch` counts, records Kid outcomes and keeps the best (higher wins, a tie keeps
  the older); the streak rules; purity; a round trip through a fake `SaveSlot`.

## Out of scope

Any other file. No UI.
