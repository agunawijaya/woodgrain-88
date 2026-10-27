---
id: tank-replay
kind: data
model: gemini-3.8-flash-high
fence:
  - games/tank-duel/src/session/replay.ts
  - games/tank-duel/tests/replay.test.ts
acceptance:
  - pnpm exec vitest run --project tank-duel games/tank-duel/tests/replay.test.ts
  - pnpm exec eslint games/tank-duel/src/session/replay.ts games/tank-duel/tests/replay.test.ts
  - pnpm exec prettier --check games/tank-duel/src/session/replay.ts games/tank-duel/tests/replay.test.ts
  - pnpm exec tsc -p games/tank-duel/tsconfig.json
reads:
  - games/tank-duel/src/engine/types.ts
  - games/tank-duel/src/engine/match.ts
  - games/tank-duel/src/engine/channels.ts
  - games/tank-duel/tests/match.test.ts
---

## Goal

The results screen replays the match's best hit for 3 to 5 seconds, with the bank path traced. This
order builds the pure part: a recorder that keeps the last few seconds of a match and turns the best
hit into a clip, and a cursor that plays a clip back at any time. No DOM, no rendering.

## Context

- The engine is pure and fixed-step: each step returns `{ state, events }` (`MatchStep`). States
  are immutable, so keeping references to them is cheap and safe.
- A scoring hit is the `hit` event (fields: `shooter`, `victim`, `bounces`, `points`, `path`, `at`).
  After a hit the match freezes for about 2.5 s while the victim spins. The clip should show the lead-up
  and the explosion.
- Seat 1 is side 0.

## Interface to implement

```ts
// games/tank-duel/src/session/replay.ts
import type { MatchEvent, MatchState, Side } from '../engine/types.ts';

export interface ReplayFrame {
  readonly state: MatchState;
  /** The events of the step that produced `state`. */
  readonly events: readonly MatchEvent[];
}

export type HitEvent = Extract<MatchEvent, { kind: 'hit' }>;

export interface ReplayClip {
  readonly frames: readonly ReplayFrame[];
  readonly hit: HitEvent;
  /** Index into `frames` of the frame whose events contain `hit`. */
  readonly hitIndex: number;
  /** Seconds from the first frame to the last. */
  readonly duration: number;
}

export interface ReplayOptions {
  /** Seconds kept before a hit. Default 3. */
  readonly before?: number;
  /** Seconds recorded after a hit before its clip is closed. Default 1.6. */
  readonly after?: number;
  /** Whose hits count as the best: one side's (Kid matches, seat 1 = 0), or either (two humans). */
  readonly favour: Side | 'either';
}

export interface ReplayRecorder {
  /** Call after every engine step, in order. */
  record(frame: ReplayFrame): void;
  /** The best clip so far, or null. A clip still collecting its `after` frames is returned as it stands. */
  best(): ReplayClip | null;
}

export function createReplayRecorder(options: ReplayOptions): ReplayRecorder;

/** Which hit is better: positive when `a` beats `b`. */
export function compareHits(a: HitEvent, b: HitEvent, favour: Side | 'either'): number;

export interface ReplayMoment {
  readonly previous: MatchState;
  readonly current: MatchState;
  /** 0–1 between `previous` and `current`, for smooth drawing. */
  readonly alpha: number;
  /** Events of every frame passed since the last call (for sparks and explosions), in order. */
  readonly events: readonly MatchEvent[];
}

export interface ReplayCursor {
  /** Moves the playhead to `seconds` from the clip's start (clamped) and says what to draw. */
  seek(seconds: number): ReplayMoment;
  readonly duration: number;
}

/** Plays a clip; seeking backwards (a loop restarting) reports the events from the start again. */
export function createReplayCursor(clip: ReplayClip): ReplayCursor;
```

## Behaviour and edge cases

1. **Recording.** Keep frames in a ring covering at least `before` seconds of match time (use
   `state.time`, not frame counts; steps can differ in length). Do not grow without bound: a
   ten-minute match must not keep ten minutes of frames.
2. **A new hit.**
   - When a frame's events contain a `hit` that counts (see `favour`), and it is better than the
     current best (or there is none), start a candidate clip: the kept frames from `before` seconds
     earlier up to this frame, then the next `after` seconds of frames as they arrive.
   - When `favour` is a side, hits by the other side count only while no hit by the favoured side
     has been seen. They are a fall-back, so a loss can still show the winning blow; any favoured
     hit beats any fall-back hit.
   - While a candidate is collecting its `after` frames, a further hit inside that window starts a
     new candidate only if it is better.
3. **Better** (`compareHits`): more `bounces`; then more `points`; then a longer `path` (sum of
   segment lengths). A tie keeps the earlier hit.
4. **The cursor.**
   - `seek(t)` finds the frame pair around `frames[0].state.time + t` and the alpha between them.
   - It reports every frame's events between the previous seek and this one, exactly once each,
     in order.
   - Seeking to a time earlier than the last seek (the clip looping) starts the event reporting
     from the clip's start again.
   - `seek` past the end holds the last frame with alpha 1.
5. A clip whose match ended during its `after` window simply ends with the last recorded frame.
6. Pure: never mutate frames, states or events.

## Tests required (`games/tank-duel/tests/replay.test.ts`)

Build real frames by running the engine (`createWorld`, `createMatch`, `stepMatch`) with scripted
sticks, or by placing a shell next to a tank as `tests/match.test.ts` does.

- A hit produces a clip that starts about `before` seconds earlier (or at the match start) and runs
  `after` seconds past the hit. `hitIndex` points at the frame whose events contain it.
- With `favour: 0`, a later hit with fewer bounces does not replace the best. A later hit with more
  bounces does, and a side-1 hit is used only while side 0 has none.
- The ring stays bounded: after 60 seconds of steps with no hits, at most about `before` seconds of
  frames are held. Check through `best()` after a hit, by its first frame's time.
- Cursor: alpha and frame pairs at a few times; events are reported once; seeking back restarts
  them; seeking past the end holds the last frame.
- `compareHits` ordering, including the tie.

## Out of scope

Drawing the replay, the results screen, anything outside the fence.

## Style

TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Intention-revealing
names, small functions, comments only where they explain why, in plain words. No `any`, no non-null
assertions, no commented-out code. Prettier: single quotes, width 100, trailing commas. Import with
`.ts` extensions.
