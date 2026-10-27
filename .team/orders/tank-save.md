---
id: tank-save
kind: data
model: gemini-3.8-flash-high
fence:
  - games/tank-duel/src/app/settings.ts
  - games/tank-duel/src/app/save.ts
  - games/tank-duel/tests/settings.test.ts
  - games/tank-duel/tests/save.test.ts
acceptance:
  - pnpm exec vitest run --project tank-duel games/tank-duel/tests/settings.test.ts games/tank-duel/tests/save.test.ts
  - pnpm exec eslint games/tank-duel/src/app games/tank-duel/tests/settings.test.ts games/tank-duel/tests/save.test.ts
  - pnpm exec prettier --check games/tank-duel/src/app games/tank-duel/tests/settings.test.ts games/tank-duel/tests/save.test.ts
  - pnpm exec tsc -p games/tank-duel/tsconfig.json
reads:
  - packages/kit/src/contract.ts
  - packages/kit/src/settings.ts
  - packages/kit/src/kids.ts
  - packages/kit/src/emitter.ts
  - games/tank-duel/src/engine/types.ts
---

## Goal

Two small typed stores for Tank Duel, built on what the kit hands every game:

- the game's own settings, on top of the kit's `GameSettingsStore`;
- its save slot, holding head-to-head records against each Neighbourhood Kid, the best bank shot
  ever, matches played per channel, and whether the tutorial was finished.

Games never touch `localStorage`: they only use these kit interfaces. There is no DOM.

## Context

- `GameSettingsStore` (`packages/kit/src/settings.ts`) is a key–value store: `get(key, fallback)`
  and `set(key, value)`. Stored values may be anything, including junk from an older build, so
  every read must be validated.
- `SaveSlot` (`packages/kit/src/contract.ts`):
  - `load(version)` returns the stored state if it was stored with that version, else null;
  - `store(version, state)` saves it;
  - `clear()` empties it.

  A loaded value is `unknown`; validate it before use.

- `KID_IDS` and `KidId` come from the kit's `kids.ts`. `ScoringRule` is in
  `games/tank-duel/src/engine/types.ts`.

## Interface to implement

```ts
// games/tank-duel/src/app/settings.ts
import type { GameSettingsStore, Unsubscribe } from '@woodgrain-88/kit';
import type { ScoringRule } from '../engine/types.ts';

export interface TankSettings {
  /** Timed round (the original) or first to 10. Default 'timed'. */
  readonly scoring: ScoringRule;
  /** The 32-in-1 cartridge's biplane wiring (up and down turn). Default false. */
  readonly wiring: boolean;
  /** Practice only: a faint line showing where a shell would bank. Default false. */
  readonly aimLine: boolean;
  /** Explosion size and smoke. Default 'full'. */
  readonly explosions: 'full' | 'reduced';
  /** Team colours: the standard orange and blue, or a colour-blind-safe pair. Default 'standard'. */
  readonly teamColours: 'standard' | 'colour-blind';
  /** Engine and propeller hum, 0–1. Default 0.5. */
  readonly engineVolume: number;
  /** Shots, pings and explosions, 0–1. Default 0.8. */
  readonly effectsVolume: number;
}

export const DEFAULT_TANK_SETTINGS: TankSettings;

export interface TankSettingsStore {
  get(): TankSettings;
  /** Applies the change, stores the changed keys, tells listeners; returns the new settings. */
  update(change: Partial<TankSettings>): TankSettings;
  onChange(listener: (settings: TankSettings) => void): Unsubscribe;
}

export function createTankSettings(store: GameSettingsStore): TankSettingsStore;
```

```ts
// games/tank-duel/src/app/save.ts
import type { KidId, SaveSlot } from '@woodgrain-88/kit';

export interface KidRecord {
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
}

export interface BestBank {
  readonly bounces: number;
  readonly channel: string;
  /** ISO date-time of the match. */
  readonly at: string;
}

export interface TankSave {
  readonly kids: Readonly<Record<KidId, KidRecord>>;
  readonly bestBank: BestBank | null;
  /** Finished matches per channel id. */
  readonly played: Readonly<Record<string, number>>;
  readonly tutorialDone: boolean;
}

export const SAVE_VERSION = 1;

export function emptySave(): TankSave;

/** The stored save, or an empty one when there is none or it does not validate. */
export function readSave(slot: SaveSlot): TankSave;

export function writeSave(slot: SaveSlot, save: TankSave): void;

export interface FinishedMatch {
  readonly channel: string;
  /** The Kid in seat 2, or null for a person. */
  readonly kid: KidId | null;
  /** From seat 1's side. */
  readonly outcome: 'win' | 'loss' | 'draw';
  /** Most bounces on one of seat 1's scoring hits (0 when none banked). */
  readonly bestBank: number;
  readonly at: string;
}

/** The save after one more finished match. Pure; returns a new object. */
export function recordMatch(save: TankSave, match: FinishedMatch): TankSave;

export function finishTutorial(save: TankSave): TankSave;
```

## Behaviour and edge cases

1. **Settings.**
   - Each field is stored under its own key, `tank.<field>`.
   - On read, a value of the wrong type or out of range falls back to that field's default, field by
     field. Volumes are clamped to 0–1 if they are numbers, and use the default if not.
   - `update` stores only the keys that changed and notifies listeners once per update that changed
     something; it is a no-op for no real change.
   - `onChange` returns an unsubscribe.
2. **Save.**
   - `readSave` accepts only a well-formed object.
   - Unknown Kid ids in `kids` are dropped, and missing ones get zero records.
   - Negative or non-integer counts make that Kid's record zero.
   - `bestBank` must have a positive integer `bounces`, a string `channel` and a string `at`, or it
     is null.
   - `played` keeps only non-negative integer counts.
   - `tutorialDone` defaults to false.
3. **`recordMatch`.**
   - Adds one to the Kid's wins, losses or draws (nothing for a person in seat 2).
   - Adds one to `played[channel]`.
   - Replaces `bestBank` only when the new `bestBank` is strictly more bounces.
4. Nothing mutates its inputs.

## Tests required

`tests/settings.test.ts`, with a small in-memory `GameSettingsStore`:

- defaults on an empty store;
- the per-field fall-back for junk values;
- `update` stores the changed keys only and notifies once;
- a no-op update does not notify;
- unsubscribing works;
- volumes are clamped.

`tests/save.test.ts`, with an in-memory `SaveSlot` that honours the version:

- an empty slot gives `emptySave()`;
- a round trip of `writeSave` and `readSave`;
- junk of every kind gives a safe save;
- a wrong version gives an empty save;
- `recordMatch`: win, loss and draw against a Kid; a person opponent changes no Kid record; played
  counts; `bestBank` replaced only by more bounces;
- `finishTutorial`.

## Out of scope

The settings screen, the records screen, anything outside the fence.

## Style

TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Intention-revealing
names, small functions, comments only where they explain why, in plain words. No `any`, no non-null
assertions, no commented-out code. Prettier: single quotes, width 100, trailing commas. Import with
`.ts` extensions; kit imports from `@woodgrain-88/kit`.
