---
id: kit-progression
kind: engine
fence:
  - packages/kit/src/events.ts
  - packages/kit/src/channels.ts
  - packages/kit/src/patches.ts
  - packages/kit/src/micro.ts
  - packages/kit/tests/events.test.ts
  - packages/kit/tests/channels.test.ts
  - packages/kit/tests/patches.test.ts
  - packages/kit/tests/micro.test.ts
  - packages/kit/tests/helpers/fake-repo.ts
acceptance:
  - pnpm exec vitest run packages/kit/tests/events.test.ts packages/kit/tests/channels.test.ts packages/kit/tests/patches.test.ts packages/kit/tests/micro.test.ts
  - pnpm exec tsc -p packages/kit/tsconfig.json
  - pnpm exec eslint packages/kit/src/events.ts packages/kit/src/channels.ts packages/kit/src/patches.ts packages/kit/src/micro.ts packages/kit/tests/events.test.ts packages/kit/tests/channels.test.ts packages/kit/tests/patches.test.ts packages/kit/tests/micro.test.ts packages/kit/tests/helpers/fake-repo.ts
  - pnpm exec prettier --check packages/kit/src/events.ts packages/kit/src/channels.ts packages/kit/src/patches.ts packages/kit/src/micro.ts packages/kit/tests
reads:
  - packages/kit/src/events.ts
  - packages/kit/src/channels.ts
  - packages/kit/src/patches.ts
  - packages/kit/src/micro.ts
  - packages/kit/src/emitter.ts
  - packages/kit/src/store/repos.ts
  - packages/kit/src/store/types.ts
  - packages/kit/src/types.ts
---

## Goal

Implement the kit's progression hooks: the game event bus, channels, patches and
micro-challenges. Prompt 01 builds the whole "Den Life" layer on these, so they must be exact,
deterministic and well tested.

## Context

- Each file holds types plus `export declare function ...` declarations with doc comments. Replace
  each `declare` with an implementation. Keep every exported name, signature, type and doc comment
  exactly; add private helpers as needed.
- Repositories come from `store/repos.ts` (being implemented in parallel by another order). Do not
  import its implementation. For tests, write `tests/helpers/fake-repo.ts` exporting
  `fakeRepo<T>(initial: T): Repository<T>`: an in-memory `Repository` (get/set/update/reset/onChange
  with `structuredClone` copies in update) so your tests do not depend on the store.
- Strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) and strict
  type-checked ESLint: no `any`, no `!`. Vitest with happy-dom; import sources with `.ts`.
- Ids are kebab-case: `/^[a-z0-9]+(-[a-z0-9]+)*$/`.

## Interface to implement

The declarations in `events.ts`, `channels.ts`, `patches.ts` and `micro.ts`.

## Behaviour and edge cases

Events:

1. `beginSession` ends an open session first (as `endSession` would), records `startedAt`, then
   emits `session-start`. `endSession` emits `session-end` with `durationMs`, builds the
   `SessionSummary` (counts per type including kit events; `maxima` per `type.field` for numeric
   fields), appends it to the event log repository (keeping the newest `EVENT_LOG_LIMIT`), clears
   the session and returns the summary.
2. `emit` without a session warns once per call with `console.warn` and drops the event. Stamps:
   `game`, `mode`, `channel` from the session, `at` = `now().toISOString()`, `seq` from 1.
3. Delivery goes through `schedule` (default `queueMicrotask`), one task per event, preserving
   order; each listener is called in a try/catch and a throwing listener is reported with
   `console.error` and does not stop other listeners.
4. `validateEvent`: unknown type; a `KIT_EVENTS` type emitted by a game; fields not in the schema;
   wrong value types. `validateEventSchemas`: duplicate types, reserved (kit) types, non-kebab
   types, empty descriptions.

Channels: 5. `list` follows manifest order with `index`; unlocked when the rule returns true or progress has
`channels[channelId]`. Default rule `EVERY_CHANNEL_OPEN`. Unknown game → `[]`; unknown channel
→ `get` null and `isUnlocked` false. `defaultChannel` throws `Error("<game> has no channels")`
when empty. 6. `unlock` writes `{ unlockedAt }` into progress (creating the game's progress entry with empty
maps and `firstPlayedAt: null` if missing) and returns true only the first time. 7. `validateChannels`: 1 to `MAX_CHANNELS` channels, kebab-case unique ids, title 1–24 characters,
description 1–90 characters.

Patches: 8. `handle` ignores events for games it does not know. For each patch whose goal matches the event
(metric event type, optional channel and mode filters), update the stored value: `count` adds 1;
`max` takes the larger of the stored value and the event's numeric field; `sum` adds the field.
Missing or non-numeric fields leave max/sum unchanged. 9. When value reaches target and the patch was not earned: set `earnedAt`, `gold = isPro(game)`, and
report it. When already earned without gold and the target is reached again while `isPro` is
true: set `gold`, report with `upgradedToGold: true`. "Reached again" means the value is at or
above target after this event and this event changed the metric. 10. `status` returns every patch in definition order; `progress` clamped to [0, 1];
`visibleDescription` is the hint for an unearned secret patch, otherwise the description. 11. `onEarned` listeners fire for every reported patch; `connect(bus)` subscribes `handle` and
returns the unsubscribe function. 12. `validatePatches`: as its doc comment says; titles 1–28 characters.

Micro: 13. `briefFor` fills `seconds` with `MICRO_DEFAULT_SECONDS` when omitted. `startMicro` records the
start time from `now` (milliseconds, default `performance.now`). 14. `handle` counts only events whose `game` matches and whose `channel` equals the challenge's
channel, using the same metric rules as patches. After a pass or fail, further events are
ignored. 15. `check`: if running and value ≥ target → 'passed'; else if elapsed ≥ seconds → 'failed'.
`remainingSeconds` never goes below 0. `finish` calls `check`, turns a still-running run into
'failed', and returns the result with `seconds` = elapsed (capped at the challenge length when
failed by timeout). 16. `validateMicroChallenges`: kebab unique ids, channel in `channelIds`, seconds 15–90 when given,
target positive and finite, title 1–32 characters, goal non-empty.

## Tests required

One test file per module, written first, covering every numbered behaviour above, plus: event
order is preserved across several emits with a synchronous `schedule`; a listener added during
delivery does not receive the current event; a sum patch earns exactly when crossing the target;
max patches with channel and mode filters; a secret patch's visible description before and after
earning; micro pass before timeout, fail at timeout, abandon via finish, events from another
channel ignored. Use fixed clocks; no real timers.

## Out of scope

The store implementation, UI, toasts, unlock rules beyond the default, anything outside the fence.
