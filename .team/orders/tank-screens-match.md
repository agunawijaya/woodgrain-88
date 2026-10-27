---
id: tank-screens-match
kind: plumbing
model: gemini-3.8-flash-high
fence:
  - games/tank-duel/src/screens/prematch.ts
  - games/tank-duel/src/screens/results.ts
  - games/tank-duel/src/copy/kid-lines.ts
  - games/tank-duel/tests/screens-match.test.ts
acceptance:
  - pnpm exec vitest run --project tank-duel games/tank-duel/tests/screens-match.test.ts
  - pnpm exec eslint games/tank-duel/src/screens/prematch.ts games/tank-duel/src/screens/results.ts games/tank-duel/src/copy/kid-lines.ts games/tank-duel/tests/screens-match.test.ts
  - pnpm exec prettier --check games/tank-duel/src/screens/prematch.ts games/tank-duel/src/screens/results.ts games/tank-duel/src/copy/kid-lines.ts games/tank-duel/tests/screens-match.test.ts
reads:
  - games/tank-duel/src/screens/style.ts
  - games/tank-duel/src/screens/menu.ts
  - games/tank-duel/src/app/controller.ts
  - games/tank-duel/src/ui/hud.ts
  - games/tank-duel/src/engine/types.ts
  - games/tank-duel/src/engine/channels.ts
  - packages/kit/src/kid-portrait.ts
  - packages/kit/src/kids.ts
  - packages/kit/src/patch-art.ts
  - packages/kit/src/patches.ts
  - packages/kit/src/contract.ts
  - packages/kit/src/input.ts
  - packages/kit/src/loop.ts
---

## Goal

Two screens Tank Duel shows around a match, plus the Kids' short lines for the results.

- **Pre-match:** both commanders' cards face each other over the live table. Each seat says
  "ready" by pressing fire.
- **Results:** the final score, who won, the Kid's reaction, the patches earned, and the buttons
  to go on. All of this sits beside the best hit, which replays on the table behind it.

The game's look is set: use the class names and components in `src/screens/style.ts` (enamel
`td-plate` with `td-rivets`, `td-display` type, `td-hand` handwriting, `td-button`, `td-panel`,
`td-label`, `td-photo`, `td-key`) and follow `src/screens/menu.ts` as the worked example. That means
markup from template strings with `escapeText`, a scoped `<style>` block for layout only, and
real `<button>`s. Do not invent new colours: use the `--td-*` tokens. Both appearances must work
(the root `.td-screens` carries `data-appearance="light" | "dark"`).

## Context

- `src/app/controller.ts` already calls both screens; match its calls exactly:
  - `createPrematchScreen({ host, channel, commanders, kids, challengeScore?, input, createLoop,
humans, onReady, onBack })`;
  - `createResultsScreen({ host, channel, final, seats, kids, versus, receipt, bestBank,
onPlayAgain, onGameMenu, onBackToHall })`.
- `commanders` and `seats` are `HudSeat` (`{ name, note }`, from `src/ui/hud.ts`). `kids[side]` is
  the `KidId` in that seat, or null for a person.
- Seat 1 is side 0 (orange team, `--td-team-0`) and seat 2 is side 1 (blue team, `--td-team-1`).
- `input` is the kit `InputController`: `poll()` returns `{ seats: { 1: SeatFrame, 2: SeatFrame } }`,
  and a seat pressed fire when `frame.seats[n].pressed.has('fire')`. `createLoop` is the kit loop
  factory. Call `poll` from the loop's `update`, never from a DOM handler.
- `kidPortraitSvg(kid, { expression: 'photo' | 'win' | 'lose', idPrefix })` draws a Kid's photo.
  `patchSvg(input, size)` in `patch-art.ts` draws an earned patch; read its `PatchArtInput`.

## Interface to implement

```ts
// games/tank-duel/src/screens/prematch.ts
import type { GameLoop, InputController, KidId, LoopOptions } from '@woodgrain-88/kit';
import type { ChannelRules } from '../engine/types.ts';
import type { HudSeat } from '../ui/hud.ts';

export interface PrematchOptions {
  readonly host: HTMLElement;
  readonly channel: ChannelRules;
  readonly commanders: readonly [HudSeat, HudSeat];
  readonly kids: readonly [KidId | null, KidId | null];
  /** A challenge link's score to beat, shown under the channel. */
  readonly challengeScore?: number;
  readonly input: InputController;
  readonly createLoop: (options: LoopOptions) => GameLoop;
  /** Which seats are people (they press fire); the rest are ready on their own. */
  readonly humans: readonly [boolean, boolean];
  readonly onReady: () => void;
  readonly onBack: () => void;
}

export interface PrematchScreen {
  dispose(): void;
}

export function createPrematchScreen(options: PrematchOptions): PrematchScreen;
```

```ts
// games/tank-duel/src/screens/results.ts
import type { KidId, ResultReceipt } from '@woodgrain-88/kit';
import type { ChannelRules, MatchState } from '../engine/types.ts';
import type { HudSeat } from '../ui/hud.ts';

export interface ResultsOptions {
  readonly host: HTMLElement;
  readonly channel: ChannelRules;
  readonly final: MatchState;
  readonly seats: readonly [HudSeat, HudSeat];
  readonly kids: readonly [KidId | null, KidId | null];
  /** Two people: a winner banner per seat, and "Rematch" instead of "Play again". */
  readonly versus: boolean;
  /** Null in practice, where nothing is recorded. */
  readonly receipt: ResultReceipt | null;
  readonly bestBank: number;
  readonly onPlayAgain: () => void;
  readonly onGameMenu: () => void;
  readonly onBackToHall: () => void;
}

export interface ResultsScreen {
  dispose(): void;
}

export function createResultsScreen(options: ResultsOptions): ResultsScreen;
```

```ts
// games/tank-duel/src/copy/kid-lines.ts
import type { KidId } from '@woodgrain-88/kit';

export type KidMood = 'won' | 'lost' | 'draw';

/** Three short lines per Kid per mood, said after a match. */
export const KID_LINES: Readonly<Record<KidId, Readonly<Record<KidMood, readonly string[]>>>>;

/** One line, picked by `seed` so a replayed result says the same thing. */
export function kidLine(kid: KidId, mood: KidMood, seed: number): string;
```

## Behaviour and design

### Pre-match

- **Layout (16:9).**
  - Top centre: the channel band (`CH 07 · <title>`) in mustard, as in the menu's title. Under it:
    "Game 7 of the 1977 cartridge" for original channels, or "Remix channel".
  - When `challengeScore` is set, add a line: "Challenge: beat 9 hits".
  - Two commander cards, left (seat 1) and right (seat 2), and a large stencil "VS" between them.
- **Each card** is a `td-plate td-rivets` with a 6 px top edge in its team colour. It holds:
  - for a Kid, the Kid's photo (`td-photo`-like frame, expression 'photo') with the name in
    handwriting under it, and the Kid's `style` line from the kit;
  - for a person, a code-drawn badge instead of a photo: an SVG dog tag with a small tank emblem in
    the team colour;
  - the name in `td-display`, and the note (`HudSeat.note`) in small print.
- **Readiness.**
  - A human card shows "Press fire when ready" with the key hint: seat 1 `Space`, seat 2 `Enter`,
    or "A / ✕" once a pad is in use (`SeatFrame.usingPad`).
  - When that seat presses fire, a "READY" rubber stamp lands on the card: rust colour, rotated
    about −8°, with a short scale-down animation and none under reduced motion.
  - Kid seats stamp themselves READY about 0.9 s after the screen opens.
  - When both are ready, wait 0.5 s so the second stamp is seen, then call `onReady` once.
- A small "Back" `td-link` at the bottom left calls `onBack`.
- `dispose` stops the loop and removes the markup.
- **Accessibility.** The cards are an `aria-live="polite"` region, so "Dee is ready" is announced.
  The Back link is keyboard reachable.

### Results

- **Layout.** A results panel on the left, about 40% of the width, so the replay stays visible on
  the right. A small "REPLAY · best hit" chip with a red dot sits at the top right; add
  "· bank ×N" when `bestBank > 0`.
- **The panel, top to bottom.**
  1. **Banner** (`td-plate`, `td-display`, large): "You win" when seat 1 won against a Kid,
     "<Kid> wins" when the Kid did, "Draw". In versus: "<Name> wins" and, on each seat's score
     plate, a small "WINNER" ribbon for the winning seat.
  2. **Two score plates** side by side in team colours: the name and the final score, large. Read
     `final.scores` and `final.winner`.
  3. **The Kid** (when there is one): their photo with the expression from _their_ side ('win'
     when the Kid won, 'lose' when the player won, 'photo' for a draw). Next to it, on a paper
     note in handwriting, one of their lines (`kidLine(kid, mood, seed)` with mood from the Kid's
     side; use `Math.round(final.time * 1000)` as the seed).
  4. **Facts** as short rows: "Best bank ×3" when banked; "New best on this channel" when
     `receipt.newBest`; "Rank N on this channel" when `receipt.rank` is set and not 1.
  5. **Patches earned:** each `receipt.patchesEarned` item as a small `patchSvg` (64 px) with its
     title, plus "Gold thread" when `gold`. Leave the row out when there are none.
  6. **Buttons**, in this order:
     - `Play again (R)` as the primary, or `Rematch (R)` when `versus`;
     - `Game menu`;
     - `Back to the Hall (H)`.

     Each shows its key with `td-key`.
- **Keys.** While the screen is open, `KeyR` calls `onPlayAgain` and `KeyH` calls `onBackToHall`.
  Ignore repeats and modifier combinations, and remove the listener on dispose. Initial focus goes
  to the primary button.
- Practice (`receipt === null`) shows the same panel without Facts or Patches.

### Kid lines

- Three per Kid per mood, 54 lines in all.
- Each line is 60 characters at most, friendly-cheeky, in the Kid's own voice, and our own words.
- No insults, no real people, brands or teams.
- The voices:
  - Dee rushes and brags;
  - Moss is calm and dry;
  - Pip is chaotic and giggly;
  - Grandpa Lou is a warm old hand who calls you "kiddo";
  - Rosa is sly and teasing;
  - Benny is a studious copycat who talks about your habits.

  Keep these voices consistent with the kit bios in `packages/kit/src/kids.ts`.

## Tests required (`games/tank-duel/tests/screens-match.test.ts`)

Start the file with `// @vitest-environment happy-dom`. Use a fake `InputController` whose `poll`
returns frames you set, and a fake `createLoop` whose `update` you call by hand.

- **Pre-match:**
  - a human seat becomes ready only on a fire press;
  - Kid seats become ready on their own after time passes;
  - `onReady` is called exactly once, after both are ready;
  - Back calls `onBack`;
  - dispose removes the markup and stops the loop.
- **Results:**
  - the banner text for win, loss, draw and versus;
  - the button order and labels, with Rematch in versus;
  - R and H call their handlers;
  - patches appear only when earned;
  - practice shows no facts;
  - dispose removes the key listener.
- **Kid lines:** 3 lines per Kid per mood, each 60 characters or fewer; `kidLine` is
  deterministic for a seed.

## Out of scope

The controller, the menu, the records and settings screens, the replay drawing. Do not edit other
files.

## Style

TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Intention-revealing
names, small functions, comments only where they explain why, in plain words. No `any`, no non-null
assertions, no commented-out code. Prettier: single quotes, width 100, trailing commas. Import with
`.ts` extensions; kit imports from `@woodgrain-88/kit`. Visible focus for keyboard users through
the shared `:focus-visible` styles. AA contrast in both appearances.
