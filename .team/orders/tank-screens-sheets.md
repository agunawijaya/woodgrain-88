---
id: tank-screens-sheets
kind: plumbing
model: gemini-3.8-flash-high
fence:
  - games/tank-duel/src/screens/records.ts
  - games/tank-duel/src/screens/settings-sheet.ts
  - games/tank-duel/src/screens/sheet.ts
  - games/tank-duel/tests/screens-sheets.test.ts
acceptance:
  - pnpm exec vitest run --project tank-duel games/tank-duel/tests/screens-sheets.test.ts
  - pnpm exec eslint games/tank-duel/src/screens/records.ts games/tank-duel/src/screens/settings-sheet.ts games/tank-duel/src/screens/sheet.ts games/tank-duel/tests/screens-sheets.test.ts
  - pnpm exec prettier --check games/tank-duel/src/screens/records.ts games/tank-duel/src/screens/settings-sheet.ts games/tank-duel/src/screens/sheet.ts games/tank-duel/tests/screens-sheets.test.ts
reads:
  - games/tank-duel/src/screens/style.ts
  - games/tank-duel/src/screens/menu.ts
  - games/tank-duel/src/app/controller.ts
  - games/tank-duel/src/app/settings.ts
  - games/tank-duel/src/app/save.ts
  - games/tank-duel/src/engine/channels.ts
  - games/tank-duel/src/engine/types.ts
  - packages/kit/src/kid-portrait.ts
  - packages/kit/src/kids.ts
  - packages/kit/src/store/types.ts
---

## Goal

Two sheets that open over Tank Duel's game menu:

- **Records:** how the player stands against each Kid, their best bank shot, and their best score
  and matches played on every channel.
- **Settings:** the game's own settings.

Both are built on one small modal sheet helper. The game's look is set: use the class names in
`src/screens/style.ts` (`td-panel`, `td-plate`, `td-display`, `td-label`, `td-button`, `td-link`,
`td-toggle`, `td-photo`, `td-hand`, `td-key`) and follow `src/screens/menu.ts` as the worked
example:

- markup from template strings with `escapeText`;
- a scoped `<style>` for layout only;
- real `<button>` and `<input>` elements;
- `--td-*` tokens only;
- both appearances through `.td-screens[data-appearance]`.

## Context

- `src/app/controller.ts` already calls both sheets; match its calls exactly:
  - `createSettingsSheet({ host, settings, onAllSettings, onClose })`;
  - `createRecordsScreen({ host, save, best, onClose })`.

  Each returns `{ dispose(): void }`.

- `settings` is the `TankSettingsStore` (`src/app/settings.ts`). `save` is a `TankSave`
  (`src/app/save.ts`). `best(channelId)` returns the kit `RunRecord | null`, whose `score` is the
  player's hits in that match.
- Channels are `CHANNELS` from `src/engine/channels.ts` (`number`, `title`, `group`,
  `originalGame`).

## Interface to implement

```ts
// games/tank-duel/src/screens/sheet.ts
export interface SheetOptions {
  readonly host: HTMLElement;
  /** The sheet's heading, also its accessible name. */
  readonly title: string;
  readonly onClose: () => void;
}

export interface Sheet {
  /** Where the sheet's own content goes. */
  readonly body: HTMLElement;
  dispose(): void;
}

/** A modal panel over the menu: focus is held inside, Escape and the close button call onClose. */
export function createSheet(options: SheetOptions): Sheet;
```

```ts
// games/tank-duel/src/screens/settings-sheet.ts
import type { TankSettingsStore } from '../app/settings.ts';

export interface SettingsSheetOptions {
  readonly host: HTMLElement;
  readonly settings: TankSettingsStore;
  /** The Hall's own settings (appearance, camera shake, controls). */
  readonly onAllSettings: () => void;
  readonly onClose: () => void;
}

export function createSettingsSheet(options: SettingsSheetOptions): { dispose(): void };
```

```ts
// games/tank-duel/src/screens/records.ts
import type { RunRecord } from '@woodgrain-88/kit';
import type { TankSave } from '../app/save.ts';

export interface RecordsOptions {
  readonly host: HTMLElement;
  readonly save: TankSave;
  readonly best: (channelId: string) => RunRecord | null;
  readonly onClose: () => void;
}

export function createRecordsScreen(options: RecordsOptions): { dispose(): void };
```

## Behaviour and design

### Sheet

- A dimmed backdrop over the whole host, with a centred `td-panel` at most 720 px wide and 86vh
  tall; the body scrolls inside it.
- A header holds the title in `td-display` and a round close button labelled "Close" with the
  `Esc` key hint.
- `role="dialog"`, `aria-modal="true"` and `aria-labelledby` pointing at the title.
- When it opens, focus moves to the first focusable element in the body, or else the close button.
  Tab and Shift+Tab cycle inside the sheet.
- Escape calls `onClose` and stops the event from bubbling, so the Hall does not also act on it.
  Clicking the backdrop calls `onClose`.
- `dispose` removes the markup and every listener it added. Focus is given back to whatever had it
  before the sheet opened.

### Settings sheet

The title is "Settings". Use one row per setting: a label, a one-line explanation in small print,
and the control.

1. **Scoring:** a `td-toggle` radio group, "Timed round · 2:44" / "First to 10".
2. **Cartridge wiring:** a switch (a `button` with `role="switch"` and `aria-checked`). The
   explanation reads: "The 32-in-1 cartridge swapped the biplane's turn and throttle. Turn on to
   fly it that way."
3. **Aim line in practice:** a switch. Explanation: "A faint line shows where a shell would bank.
   Practice only."
4. **Explosions:** a toggle, "Full" / "Reduced".
5. **Team colours:** a toggle, "Orange and blue" / "Colour-blind safe".
6. **Engine sound** and **Effects** volume: `<input type="range">` from 0 to 100, step 5, showing
   the value as a percentage.
7. A `td-link` "Camera shake, appearance and controls" that calls `onAllSettings`.

Every change calls `settings.update` with just that field, and the controls reflect
`settings.get()` when the sheet opens. Arrow keys move the choice inside a toggle, as in the menu.

### Records

The title is "Records".

1. **Against the Kids:** the six Kids in a row, each a small `td-photo` (not a button: a `figure`)
   with the name in handwriting. Under each, their record "3–1–0" (wins, losses, draws) with a
   visually hidden full text ("3 wins, 1 loss, no draws").
2. **Best bank shot:** "×4 on CH 09 · <title>, 12 Oct 2026" (en-GB date), or "No bank shot yet.
   Bounce one in on a bouncing channel." when there is none.
3. **Channels:** a table with a header row. Columns: CH (two digits), Channel, Best (hits, or an en
   dash), Played. One row per channel in dial order, grouped by `group` with a group header row.
   Use a real `<table>` with `<th scope>`.

## Tests required (`games/tank-duel/tests/screens-sheets.test.ts`)

Start with `// @vitest-environment happy-dom`. Use an in-memory `GameSettingsStore` with
`createTankSettings`.

- **Sheet:**
  - Escape and the close button call `onClose`;
  - Escape does not bubble;
  - focus moves inside on open, cycles with Tab, and returns on dispose;
  - dispose removes the markup.
- **Settings:**
  - each control reflects the current settings;
  - toggling the wiring switch, choosing Reduced explosions and moving a volume slider each call
    `update` with just that field;
  - the all-settings link calls `onAllSettings`.
- **Records:**
  - Kid records show the right numbers;
  - the best bank line appears, or the empty-state line;
  - the table has 31 channel rows with the best score or an en dash, and the played counts.

## Out of scope

The controller, the menu, the pre-match and results screens. Do not edit other files.

## Style

TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Intention-revealing
names, small functions, comments only where they explain why, in plain words. No `any`, no non-null
assertions, no commented-out code. Prettier: single quotes, width 100, trailing commas. Import with
`.ts` extensions; kit imports from `@woodgrain-88/kit`. Visible focus for keyboard users; AA
contrast in both appearances.
