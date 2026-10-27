---
id: tank-harness
kind: plumbing
model: gemini-3.8-flash-high
fence:
  - games/tank-duel/game.html
  - games/tank-duel/src/dev/game.ts
  - games/tank-duel/src/dev/fake-context.ts
  - games/tank-duel/src/dev/fake-chrome.ts
  - games/tank-duel/tests/fake-context.test.ts
acceptance:
  - pnpm exec vitest run --project tank-duel games/tank-duel/tests/fake-context.test.ts
  - pnpm exec eslint games/tank-duel/src/dev/game.ts games/tank-duel/src/dev/fake-context.ts games/tank-duel/src/dev/fake-chrome.ts games/tank-duel/tests/fake-context.test.ts
  - pnpm exec prettier --check games/tank-duel/game.html games/tank-duel/src/dev/game.ts games/tank-duel/src/dev/fake-context.ts games/tank-duel/src/dev/fake-chrome.ts games/tank-duel/tests/fake-context.test.ts
reads:
  - packages/kit/src/contract.ts
  - packages/kit/src/input.ts
  - packages/kit/src/loop.ts
  - packages/kit/src/audio.ts
  - packages/kit/src/settings.ts
  - packages/kit/src/rng.ts
  - packages/kit/src/types.ts
  - packages/kit/src/micro.ts
  - packages/kit/src/share.ts
  - games/tank-duel/src/module.ts
  - games/tank-duel/src/manifest.ts
  - games/tank-duel/play.html
  - games/tank-duel/src/dev/play.ts
  - games/tank-duel/vite.config.ts
  - hall/src/play/session.ts
  - hall/src/styles/pages.css
---

## Goal

A dev-only harness page on Tank Duel's own dev server (`games/tank-duel/game.html`, port 4520,
and 5520 for Playwright). It mounts the real game module, `tankDuel` from `src/module.ts`, with a
fake but faithful `GameContext` built from the kit's real pieces, plus a thin copy of the Hall's
chrome. That lets the lead see and test the whole game before it is wired into the Hall. It is
never part of a build and never imported by game code.

## Context

- **The contract.** `GameModule.mount(host, context)` returns a `GameInstance` (see
  `packages/kit/src/contract.ts`; every field of `GameContext` is documented there). The Hall's
  real implementation is `hall/src/play/session.ts`. Read it for behaviour, but do not import from
  `hall/`.
- **Kit pieces to use:**
  - `createInput({ pointerTarget, layout: 'split' })`;
  - `createLoop(options)`;
  - `createRng(seed)`;
  - `createAudioEngine()`;
  - `DEFAULT_BINDINGS` if needed.

  Kit imports come from `@woodgrain-88/kit`.

- **Fonts**, as the Hall loads them. They are dev dependencies of this package:
  - `@fontsource-variable/atkinson-hyperlegible-next/wght.css`;
  - `@fontsource-variable/big-shoulders-display/wght.css`;
  - `@fontsource/patrick-hand/400.css`.

  Import them in `src/dev/game.ts`.

- **No `localStorage`, ever**: settings, the save slot and records live in memory for the page's
  life.

## Interface to implement

```ts
// games/tank-duel/src/dev/fake-context.ts
import type {
  DifficultySwitches,
  GameContext,
  GameEvent,
  GameManifest,
  GameResult,
  GameView,
  PauseItem,
  RunInfo,
} from '@woodgrain-88/kit';

export interface HarnessLog {
  readonly events: GameEvent[];
  readonly results: GameResult[];
  view: GameView;
  pauseItems: readonly PauseItem[];
}

export interface FakeContextOptions {
  readonly manifest: GameManifest;
  readonly host: HTMLElement;
  readonly run: RunInfo;
  /** Seat 2's Kid, or null for a second person. */
  readonly kid: string | null;
  readonly appearance: 'light' | 'dark';
  readonly reducedMotion: boolean;
  readonly switches: DifficultySwitches;
  /** Called when the game asks for the pause menu, settings, How to play or the Hall. */
  readonly chrome: {
    openPause(): void;
    openSettings(): void;
    openHowToPlay(): void;
    backToHall(): void;
    viewChanged(view: GameView): void;
  };
}

export interface FakeContext {
  readonly context: GameContext;
  readonly log: HarnessLog;
  /** Pauses or resumes every loop the game made, as the Hall's pause menu does. */
  setPaused(paused: boolean): void;
  setAppearance(appearance: 'light' | 'dark'): void;
  setSwitches(switches: DifficultySwitches): void;
  dispose(): void;
}

export function createFakeContext(options: FakeContextOptions): FakeContext;
```

```ts
// games/tank-duel/src/dev/fake-chrome.ts
// The Hall's play chrome in miniature: "← Back to the Hall" top left (menu view), a pause button
// with an Esc hint top right (play view), and a pause menu in the standard order:
// Resume · the game's pause items · How to play · Settings · Game menu · Back to the Hall.
export interface FakeChrome {
  showView(view: GameView): void;
  openPause(): void;
  dispose(): void;
}
export function createFakeChrome(options: {
  host: HTMLElement;
  pauseItems: () => readonly PauseItem[];
  onResume(): void;
  onGameMenu(): void;
  onBackToHall(): void;
  onHowToPlay(): void;
  onSettings(): void;
}): FakeChrome;
```

## Behaviour

1. **The URL drives the run**, read in `src/dev/game.ts`:
   - `?mode=normal|daily|challenge|micro|versus-night` (default normal; `micro` becomes
     `power-cycle-run` with `run.micro` taken from the module's micro-challenge `?micro=<id>`,
     whose channel becomes `run.channel`);
   - `?channel=game-7`;
   - `?seed=123`;
   - `?kid=lou|person`;
   - `?appearance=light|dark` (default from `prefers-color-scheme`);
   - `?reduced=1`;
   - `?left=A|B&right=A|B`;
   - `?challenge=9` (sets `run.challenge` with that score);
   - `?daily=12` (sets `dailyNumber`).
2. **The fake context.**
   - `seats`: seat 1 is a person named "Player 1". Seat 2 is a bot with `kid`, named from the
     kit's `kidById`, or a person "Player 2".
   - `settings.game` is an in-memory `GameSettingsStore` (a `Map`).
   - `save` is an in-memory `SaveSlot` that honours versions.
   - `records.best/top` read an in-memory list that `reportResult` fills: rank and newBest are
     computed by score, higher is better.
   - `patches.status()` returns `[]`.
   - `emit` pushes to `log.events` and `console.debug`s it.
   - `reportResult` pushes to `log.results` and returns a receipt with no patches.
   - `createLoop` wraps the kit `createLoop` and remembers each loop, so `setPaused` can pause and
     resume them all.
   - `difficulty.get/onChange` follow `setSwitches`.
   - `settings.appearance/onAppearance` follow `setAppearance`. `reducedMotion` is from the
     options; `screenShake()` is true; `crtEnabled()` is false; `colorBlindHints()` is false.
   - `share.challengeLink(score)` returns `#challenge-<score>`; `card` returns an empty `<svg>`;
     `copy` resolves true.
   - `setView` stores the view and tells the chrome. `setPauseItems` stores the items.
   - `requestPause` and `openSettings`, `openHowToPlay`, `backToHall` go to the chrome.
     `forgetGameData` clears the in-memory stores.
   - `input.onPause` (Escape) opens the pause menu in the play view; in the menu view it calls the
     chrome's back-to-Hall.
3. **The page** (`game.html`).
   - Full window with a black background, and a `#host` that fills the window
     (`position: fixed; inset: 0`) for the game. The chrome is layered above it.
   - Mount `tankDuel.mount(host, context)`.
   - Expose `window.__tank = { log, instance, fake }` for Playwright.
   - Keyboard shortcuts for the lead, on top of the game: `F2` flips the appearance, `F3` flips the
     left switch, `F4` flips the right switch. Show a tiny line of these shortcuts at the bottom
     left in the menu view only.
4. **The chrome** matches the Hall's placement (`hall/src/styles/pages.css`): the back button at
   16 px from the top left, the pause button 44 px tall at 16 px from the top right. The pause menu
   is a centred dialog with real buttons in the standard order; Resume and Escape close it. Use
   plain, neutral styling. It is a dev tool; nothing here needs the game's look.

## Tests required (`games/tank-duel/tests/fake-context.test.ts`)

Start with `// @vitest-environment happy-dom`. Test the fake context only, without mounting the
game:

- seats from `kid` and from `person`;
- the settings store round trip;
- the save slot honours versions;
- `reportResult` ranks a better score first and sets `newBest`;
- `setPaused` pauses the loops it made;
- `setAppearance` notifies;
- `setSwitches` notifies;
- `emit` records events.

## Out of scope

Game code, the Hall, the vite config (`game.html` is picked up by Vite's dev server as is). Do not
edit other files.

## Style

TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Intention-revealing
names, small functions, comments only where they explain why, in plain words. No `any`, no non-null
assertions, no commented-out code. Prettier: single quotes, width 100, trailing commas. Import with
`.ts` extensions.
