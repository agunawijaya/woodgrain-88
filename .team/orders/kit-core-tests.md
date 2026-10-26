---
id: kit-core-tests
kind: tests
fence:
  - packages/kit/tests/emitter.test.ts
  - packages/kit/tests/rng.test.ts
  - packages/kit/tests/loop.test.ts
  - packages/kit/tests/input.test.ts
acceptance:
  - pnpm exec vitest run packages/kit/tests/emitter.test.ts packages/kit/tests/rng.test.ts packages/kit/tests/loop.test.ts packages/kit/tests/input.test.ts
  - pnpm exec tsc -p packages/kit/tsconfig.json
  - pnpm exec eslint packages/kit/tests/emitter.test.ts packages/kit/tests/rng.test.ts packages/kit/tests/loop.test.ts packages/kit/tests/input.test.ts
  - pnpm exec prettier --check packages/kit/tests
reads:
  - packages/kit/src/emitter.ts
  - packages/kit/src/rng.ts
  - packages/kit/src/loop.ts
  - packages/kit/src/input.ts
  - packages/kit/vitest.config.ts
---

## Goal

Write unit tests for four kit modules the lead implemented: `emitter.ts`, `rng.ts`, `loop.ts` and
`input.ts`. Tests only; do not change the source files. If a test you are sure is right fails,
leave it failing and explain the bug in your report: that is a finding, not a mistake.

## Context

- Vitest with happy-dom (`packages/kit/vitest.config.ts`). Import from `../src/<module>.ts`.
- `loop.ts` takes an injectable `LoopEnvironment` (`now`, `requestFrame`, `cancelFrame`, `page`,
  `window`). Build a fake one: a manual clock, a queue of frame callbacks you flush by hand, and
  `EventTarget`-based page/window objects with a writable `visibilityState`.
- `input.ts` takes `keyTarget`, `pointerTarget` and `gamepads` options. Dispatch `KeyboardEvent`s
  with `code` and `repeat` on an `EventTarget`; fake gamepads as plain objects with `connected`,
  `buttons: { pressed: boolean }[]` and `axes: number[]`, cast through `unknown` to `Gamepad`.
- Deterministic only: no real timers, no `Math.random`.

## Behaviour and edge cases

Emitter: listeners receive values; unsubscribe works; a listener that unsubscribes during emit does
not break the others; `clear` and `size`.

Rng:

1. Same seed (number or string) gives the same sequence; different seeds differ; `seed` is stable.
2. Two generators made from `"woodgrain"` produce the same first 1 000 values, all in [0, 1);
   `createRng(42).int(1, 6)` stays within 1–6 over 10 000 draws and every face appears. (The lead
   will add golden literal values later; do not invent them.)
3. `int` rejects non-integers and max < min; `pick` rejects empty arrays; `shuffle` returns a
   permutation and leaves the input untouched; `chance(0)` is always false and `chance(1)` always
   true; `fork(label)` is deterministic, independent of how many numbers the parent has drawn, and
   differs between labels.
4. Rough uniformity: 60 000 `int(0, 5)` draws land within 10% of 10 000 per bucket.

Loop: 5. With 60 Hz and frames 1/60 s apart, each frame runs exactly one update and one render. 6. A 50 ms frame at 60 Hz runs three updates and renders with alpha in [0, 1). 7. A 2-second frame is capped (at most 15 updates at 60 Hz) and `stalls` increments. 8. `pause` stops updates; `resume` discards paused time (no burst on the next frame). 9. `step(5)` runs five updates synchronously and one render with alpha 0, without frames. 10. Turn mode: no updates on frames; `invalidate()` schedules exactly one render; `invalidate`
while paused does nothing. 11. Auto-pause: page `visibilitychange` with `visibilityState = 'hidden'` pauses and calls
`onAutoPause`; window `blur` does too; `autoPause: false` ignores both; `stop` removes the
listeners. 12. `hz: 30` gives `dt` of 1/30 and `tick` counting from 0.

Input: 13. Split layout: KeyW → seat 1 `up`; ArrowUp → seat 2 `up`; Space → seat 1 `fire`; Enter → seat 2
`fire`. 14. Solo layout: both KeyW and ArrowUp drive seat 1; holding both then releasing one keeps `up`
held. 15. A keydown and keyup between two polls appear as both `pressed` and `released` on the next
poll, and not on the one after. 16. `repeat: true` keydowns are ignored for `pressed`. 17. Escape never maps to an action and calls `onPause` listeners once per press (not on repeat). 18. The `axis` follows digital keys (left → x −1) and a gamepad stick beyond the dead zone. 19. Gamepad buttons produce pressed/held/released edges per poll; button 9 triggers `onPause` once
per press; pads map to seats by `padSeats`, and to seat 1 in solo. 20. `validateBindings` flags Escape and a key bound to both seats in split layout but not in solo;
`rebind` moves a key from one seat's action to another and refuses Escape. 21. Window `blur` releases every held key (released edges on next poll). 22. `reset` clears held state; `dispose` stops reacting to events.

## Tests required

One file per module as listed in the fence, each behaviour above as its own named test.

## Out of scope

Any change to `packages/kit/src`. Anything outside the fence.
