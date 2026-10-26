---
id: den-channel-dial
kind: engine
model: gemini-3.8-flash-high
fence:
  - hall/src/channels/dial-model.ts
  - hall/tests/dial-model.test.ts
acceptance:
  - pnpm exec vitest run --project hall hall/tests/dial-model.test.ts
  - pnpm exec eslint hall/src/channels/dial-model.ts hall/tests/dial-model.test.ts
  - pnpm exec prettier --check hall/src/channels/dial-model.ts hall/tests/dial-model.test.ts
reads:
  - packages/kit/src/channels.ts
  - packages/kit/src/rng.ts
  - packages/kit/src/index.ts
---

## Goal

The pure model behind the channel picker, a 1988 TV dial: a chunky rotary knob and a channel strip
grouped by `group`. The player turns the dial, clicks a channel, uses the arrow keys, types a channel
number on the "remote" (1, 4, Enter), or asks for a surprise. No DOM; the lead draws the dial and
turns pointer and key events into `dialReduce` actions.

## Context

- A game's channels are `ChannelDef[]` (`packages/kit/src/channels.ts`), in manifest order. A
  channel's number on the dial is its position from 1. Originals are always open; a Remix channel
  can be locked. Up to 64 channels.
- Randomness only through the kit's `createRng(seed)` (`packages/kit/src/rng.ts`), never
  `Math.random`.

## Interface to implement

```ts
// hall/src/channels/dial-model.ts
import type { ChannelDef, ChannelKind } from '@woodgrain-88/kit';

export interface DialChannel {
  id: string;
  /** 1-based position in the manifest's order. */
  number: number;
  title: string;
  kind: ChannelKind;
  /** The strip heading: the channel's `group`, else "Remix" for a remix channel, else null. */
  group: string | null;
  locked: boolean;
}

export interface DialGroup {
  group: string | null;
  channels: DialChannel[];
}

export interface DialState {
  readonly channels: readonly DialChannel[];
  readonly selected: string;
  /** Digits typed on the remote so far, '' when none. */
  readonly typed: string;
  /** When the last digit was typed (ms, the caller's clock), null when none. */
  readonly typedAt: number | null;
  /** One short line for the player (a wrong number, a locked channel), null when none. */
  readonly message: string | null;
}

export type DialAction =
  | { type: 'key'; key: string; at: number }
  | { type: 'turn'; steps: number }
  | { type: 'pick'; id: string }
  | { type: 'surprise'; seed: number }
  | { type: 'tick'; at: number };

export interface DialOutcome {
  state: DialState;
  /** The channel to play now, or null when the action only moved the selection. */
  commit: string | null;
}

/** After this long without another digit, a half-typed number is dropped. */
export const TYPE_TIMEOUT_MS = 1500;
/** The knob sweeps from -150° to +150°; channel 1 at -150, the last at +150. */
export const DIAL_SWEEP_DEGREES = 300;

export function dialChannels(
  defs: readonly ChannelDef[],
  isUnlocked: (id: string) => boolean,
): DialChannel[];
/** Consecutive runs of the same group, in order (a group that comes back later is a new run). */
export function dialGroups(channels: readonly DialChannel[]): DialGroup[];
/** Starts on `selected` if it exists, else the first channel. Throws on an empty list. */
export function createDialState(channels: readonly DialChannel[], selected?: string): DialState;
export function dialReduce(state: DialState, action: DialAction): DialOutcome;
/** The knob's angle for a channel; a single channel sits at 0. */
export function dialAngle(channels: readonly DialChannel[], id: string): number;
/** The channel nearest to a knob angle (for dragging the knob), clamped to the sweep. */
export function channelAtAngle(channels: readonly DialChannel[], degrees: number): DialChannel;
```

## Behaviour and edge cases

1. Never mutate the input state; return a new one. Every action except `tick` and digit keys clears
   `message`.
2. **Moving:** `ArrowRight` and `ArrowDown` select the next channel, `ArrowLeft` and `ArrowUp` the
   previous one, wrapping at both ends. `Home` and `End` go to the first and last. `PageDown` and
   `PageUp` go to the first channel of the next or previous group run (no wrap; stay put at the
   ends). `turn` moves by `steps` (negative = back) with wrapping. Locked channels can be
   selected (so the player can read what opens them); they cannot be committed.
3. **Typing** (`key` '0'–'9'): append the digit to `typed` (a leading '0' is ignored) and set
   `typedAt`.
   - If the typed number is greater than the number of channels, set
     `message` to `No channel ${n}` and clear `typed`.
   - Otherwise select that channel. When no longer number could still be valid
     (`n * 10 > channels.length`), the number is complete: the selection moves and `typed` clears.
     With 30 channels, '4' is complete; '2' waits for another digit or Enter.
   - Typing never commits by itself.
4. **Enter** (`key` 'Enter'):
   - If `typed` is non-empty, it resolves to that number first.
   - Then commit the selected channel when it is unlocked. When it is locked, `commit` is null and
     `message` is `${title} is locked`.
5. **Surprise** (`surprise`, or `key` 's' or 'S' using `at` as the seed):
   - Select and commit a random unlocked channel other than the selected one, chosen with
     `createRng(seed)`.
   - When the selected channel is the only unlocked one, commit it.
6. **Pick** (`pick`): select that channel; commit it when unlocked, else set the locked message.
   Unknown ids change nothing.
7. **Tick** (`tick`): when `typed` is non-empty and `at - typedAt >= TYPE_TIMEOUT_MS`:
   - If the typed number is valid, select it.
   - Then clear `typed` and `typedAt`.
8. **`Backspace`** removes the last typed digit. Any other key changes nothing (commit null).
9. `dialAngle` spreads channels evenly across the sweep: `-150 + (index / (count - 1)) * 300`.
   `channelAtAngle` inverts it (nearest index).

## Tests (hall/tests/dial-model.test.ts)

Cover:

- numbering and grouping, including a remix group and a returning group;
- wrapping arrows, Home, End, PageUp and PageDown at the edges, and `turn` with large steps;
- typing '1', '4', Enter with 30 channels (commits 14);
- '4' complete at once with 30 channels; '2' then a timeout tick selects 2;
- '3', '5' with 30 channels gives "No channel 35";
- a leading zero and Backspace;
- Enter on a locked channel and pick on a locked channel;
- surprise determinism by seed, never the current channel, the only-one-unlocked case;
- `dialAngle` and `channelAtAngle` round trips, including a single channel;
- immutability of the input state.

## Style

TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Intention-revealing
names, small functions, comments only where they explain why. No `any`, no non-null assertions, no
commented-out code. Prettier: single quotes, width 140.
