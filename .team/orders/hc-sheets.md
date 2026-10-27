---
id: hc-sheets
kind: plumbing
model: gemini-3.8-flash-high
fence:
  - games/hot-and-cold/src/screens/settings-sheet.ts
  - games/hot-and-cold/src/screens/records.ts
  - games/hot-and-cold/tests/screens-sheets.test.ts
acceptance:
  - pnpm exec vitest run --project hot-and-cold games/hot-and-cold/tests/screens-sheets.test.ts
  - pnpm exec eslint games/hot-and-cold/src/screens games/hot-and-cold/tests/screens-sheets.test.ts
  - pnpm exec prettier --check games/hot-and-cold/src/screens games/hot-and-cold/tests/screens-sheets.test.ts
  - pnpm exec tsc -p games/hot-and-cold/tsconfig.json
reads:
  - games/tank-duel/src/screens/settings-sheet.ts
  - games/tank-duel/src/screens/records.ts
  - games/tank-duel/tests/screens-sheets.test.ts
  - games/hot-and-cold/src/screens/style.ts
  - games/hot-and-cold/src/screens/sheet.ts
  - games/hot-and-cold/src/app/settings.ts
  - games/hot-and-cold/src/app/save.ts
  - games/hot-and-cold/src/channels.ts
  - games/hot-and-cold/src/engine/rules.ts
  - packages/kit/src/kids.ts
  - packages/kit/src/kid-portrait.ts
---

## Goal

Write Hot & Cold's settings sheet and records screen, following Tank Duel's
`screens/settings-sheet.ts` and `screens/records.ts` closely (same structure: a `createSheet` from
`./sheet.ts`, markup built with template strings and `escapeText`, a small scoped stylesheet, live
updates), but using Hot & Cold's own class names from `games/hot-and-cold/src/screens/style.ts`
(`hc-` prefix: `hc-toggle`, `hc-label`, `hc-link`, `hc-photo`, `hc-hand`, `hc-display`,
`hc-button`, CSS variables `--hc-ink`, `--hc-ink-soft`, `--hc-paper-edge`, `--hc-well`). Include
tests in `tests/screens-sheets.test.ts` (jsdom, as Tank Duel's are).

## Interface to implement

`games/hot-and-cold/src/screens/settings-sheet.ts`:

```ts
import type { HotColdSettingsStore } from '../app/settings.ts';

export interface SettingsSheetOptions {
  readonly host: HTMLElement;
  readonly settings: HotColdSettingsStore;
  /** Why the possibility fog cannot be turned on for this run (daily, challenge link); null when it can. */
  readonly fogLocked: string | null;
  /** Opens the Den's own settings (appearance, Kid memory, controls). */
  readonly onAllSettings: () => void;
  readonly onClose: () => void;
}

export function createSettingsSheet(options: SettingsSheetOptions): { dispose(): void };
```

`games/hot-and-cold/src/screens/records.ts`:

```ts
import type { HotColdSave } from '../app/save.ts';

export interface RecordsOptions {
  readonly host: HTMLElement;
  readonly save: HotColdSave;
  readonly onClose: () => void;
}

export function createRecordsScreen(options: RecordsOptions): { dispose(): void };
```

## Settings sheet: rows, in this order

Sheet title "Hot & Cold settings". Each row: a label (`hc-label`), a choice switch (`hc-toggle`,
`role="radiogroup"` with `aria-labelledby` the label; each option a `<button role="radio"
aria-checked>`; arrow keys move between options as in Tank Duel), and one line of help text under it.
Clicking an option calls `settings.update({ field: value })`.

| Field         | Options (label → value)                                                       | Help text                                                                                                                                  |
| ------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `look`        | Polar Expedition → `polar`, Tabletop Board → `tabletop`, Radar Room → `radar` | Changes only the picture: the rules, timing and sounds' meanings stay the same.                                                            |
| `clues`       | Notebook → `notebook`, Classic Memory → `classic`                             | Notebook keeps every clue on the field. Classic Memory shows a clue only while reveal is held, as in 1978. The Kids play by the same rule. |
| `fog`         | Off → `false`, On → `true`                                                    | Squares that can no longer hide the flag go dim. Runs with the fog on do not count for records.                                            |
| `matchLength` | Cartridge → `cartridge`, Short → `short`                                      | Cartridge plays to 15 or 75, as in 1978. Short plays races and turns to 5, hunts to 25 and the clock to 30.                                |
| `clueColours` | Standard → `standard`, Colour-blind safe → `colour-blind`                     | The colours of the numbers, from cold to hot.                                                                                              |
| `seatColours` | Orange and blue → `standard`, Amber and periwinkle → `colour-blind`           | The two explorers' colours.                                                                                                                |
| `effects`     | Full → `full`, Reduced → `reduced`                                            | Blasts, confetti and flares. Reduced motion always quietens them.                                                                          |

Then an "Effects volume" row with `<input type="range" min="0" max="100" step="5">` labelled
"Effects volume", showing the value as a percentage beside it; input events call
`settings.update({ effectsVolume: value / 100 })`.

Last, an `hc-link` button "All settings…" that calls `onAllSettings`.

When `fogLocked` is a string, both fog options are `disabled`, and the fog row's help text is replaced
by `fogLocked` (so the player sees why). When null, the fog row works normally.

Every row follows `settings.onChange`: when the settings change (from this sheet or elsewhere), the
checked options and the volume update. Unsubscribe on dispose.

## Records screen

Sheet title "Records". Three sections, each with an `hc-label` heading:

1. **"Against the Kids"**: one figure per Kid (`KIDS` order, from `@woodgrain-88/kit`) with its
   `kidPortraitSvg(kid, { expression: 'photo', idPrefix: 'hc-records-<id>' })`, its name in
   `hc-hand`, and "W–L–D" from `save.kids[kid.id]` (e.g. "3–1–0"), as Tank Duel does.
2. **"Clean streak"**: one sentence: "You have found N flags in a row without setting off a bomb."
   (singular "1 flag").
3. **"Best runs"**: a table with columns Channel, Played, Clues, Kid memory, Mode, Best, When. One row
   per entry of `save.bests`, grouped in `CHANNELS` order (from `../channels.ts`; the channel's
   `def.title`, and `save.played[channel]` or 0). Split each best's key with `|` into
   `channel|mode|clues|memory` (see `boardKey` in `app/save.ts`): show clues as "Notebook" or
   "Classic Memory", memory as "Human" or "Sharp", mode as "Normal", "Daily", "Challenge", "Run"
   (`power-cycle-run`) or "Versus Night" (`versus-night`), Best as the stored `label`, When as the
   date part of `at` (`YYYY-MM-DD`). Keys whose channel is unknown are skipped. When there are no
   bests, show one line instead of the table: "No best runs yet. Find a flag and one appears here."

## Tests required (`tests/screens-sheets.test.ts`)

- Settings: every row is present with the right checked option from the store's current settings;
  clicking an option updates the store; the volume input updates `effectsVolume`; with `fogLocked`
  the fog options are disabled and the reason is shown; a change made through the store directly
  re-checks the right option; "All settings…" calls `onAllSettings`; dispose removes the sheet and
  stops listening.
- Records: Kid records show W–L–D; the streak sentence (singular and plural); best rows appear in
  channel order with readable clues, memory and mode; unknown channels are skipped; the empty-state
  line when there are no bests.

Use a small in-memory `GameSettingsStore` fake for `createHotColdSettings` in the tests (see
`games/hot-and-cold/tests/settings.test.ts`).

## Out of scope

Any other file. No changes to `style.ts`, `sheet.ts`, `settings.ts` or `save.ts`.
