---
id: hall-data-tests
kind: tests
fence:
  - hall/tests/registry.test.ts
  - hall/tests/cycle.test.ts
  - hall/tests/contrast.test.ts
  - hall/tests/run-info.test.ts
  - hall/tests/router.test.ts
acceptance:
  - pnpm exec vitest run --project hall
  - pnpm exec tsc -p hall/tsconfig.json
  - pnpm exec eslint hall/tests/registry.test.ts hall/tests/cycle.test.ts hall/tests/contrast.test.ts hall/tests/run-info.test.ts hall/tests/router.test.ts
  - pnpm exec prettier --check hall/tests
reads:
  - hall/src/data/registry.ts
  - hall/src/data/cycle.ts
  - hall/src/data/coming-soon/lane-hopper.ts
  - hall/src/play/run-info.ts
  - hall/src/routes/router.ts
  - hall/src/styles/tokens.css
  - hall/tests/fixtures/fake-game.ts
  - hall/vitest.config.ts
  - packages/kit/src/contract.ts
  - packages/kit/src/daily.ts
  - packages/kit/src/share.ts
  - packages/kit/src/color.ts
---

## Goal

Write the unit tests for the Hall's data layer: the registry of 30 games, the power switch's
slot cycling, daily picks, colour contrast of every label and token pair, run set-up from a play
route, and hash routing. Tests only; do not change any source file. If a test you are sure is
right fails, leave it failing and explain it in your report.

## Context

- Vitest in happy-dom (`hall/vitest.config.ts`); import sources from `../src/...` with `.ts`.
- Kit functions come from `@woodgrain-88/kit` (`validateRegistry`, `powerCycleOfTheDay`,
  `contrastRatio`, `encodeChallenge`, `dailySeed`, `dailyNumber`).
- The fake game in `hall/tests/fixtures/fake-game.ts` exports `fakeManifest` (slot 20, playable,
  supports daily and challenge links, channels `classic` and `fast`).
- `tokens.css` can be read in a test with `import tokens from '../src/styles/tokens.css?raw';`.
  Day values are inside the block that starts with `:root,`; night values inside
  `[data-appearance='dark'] {`. Parse `--name: #hex;` pairs with a small regular expression.
- Fixed dates only (for example `new Date('2026-10-25T12:00:00Z')`). No real timers.

## Behaviour and edge cases

Registry (`registry.test.ts`):

1. `BASE_ENTRIES` has 30 entries with slots exactly 1–30 and unique kebab-case ids.
2. `createRegistry().manifests` is ordered by slot; `validateRegistry` returns no problems.
3. Every base game is `coming-soon` and has no module loader.
4. Exactly one secret uses counter slot 31 (lane-hopper) and exactly one uses 32 (pier-derby).
5. The fake game's id is not in `BASE_ENTRIES`; `createRegistry([{ manifest: fakeManifest }])`
   still has 30 entries and puts the fake game in slot 20.
6. `wallRows` gives four rows whose sizes are duels 6, brain 7, sports 9, arcade 8, each in slot
   order, and covers all 30 games once.

Cycle (`cycle.test.ts`): 7. `nextSlot` steps forward 30 → 31 → 32 → 1 and backward 1 → 32 → 31 → 30. 8. `cycleSlots(29, 1, 5)` is `[30, 31, 32, 1, 2]`; `cycleSlots(2, -1, 3)` is `[1, 32, 31]`. 9. `isSecretSlot` is true only for 31 and 32; `counterDigits(7)` is `'07'`, `counterDigits(32)` `'32'`. 10. Daily pick: `powerCycleOfTheDay(createRegistry().manifests, date)` is null (all coming soon);
with the fake game overridden in, it returns the fake game for any date.

Contrast (`contrast.test.ts`): 11. For every manifest, `label.bandText` on `label.band` is at least 4.5. 12. Every `accent.day` against the day `--panel` and every `accent.night` against the night
`--panel` is at least 3 (UI accents). 13. Day and night: `--ink`, `--ink-soft` and `--ink-faint` on `--panel` and on `--panel-2` are at
least 4.5; `--accent-ink` on `--accent` is at least 4.5.

Run set-up (`run-info.test.ts`): 14. `mode=daily` on the fake game gives mode `daily`, `seed === dailySeed(id, date)` and
`dailyNumber === dailyNumber(date)`; on a manifest whose `supports.daily` is false it falls
back to `normal`. 15. A hash built with `encodeChallenge` for the fake game gives mode `challenge` with that seed,
channel and score; changing the score in the hash gives `normal`. 16. An unknown `ch` value falls back to the first channel; a known one is kept.

Router (`router.test.ts`): 17. `parseRoute` reads `''`, `'#/'`, `'#/list'`, `'#/records'`, `'#/about'`, `'#/game/paint-tanks'`,
`'#/play/paint-tanks?mode=daily&ch=classic'` (params readable), and returns `not-found` for
`'#/game/Not_Valid'` and `'#/nowhere'`. 18. `routeHash(parseRoute(x))` returns `x` for each valid route above (with `''` becoming `'#/'`).

## Tests required

One file per area as listed in the fence; each numbered behaviour as its own named test.

## Out of scope

Any change outside the fence. DOM rendering tests of the Den (the lead covers those in e2e).
