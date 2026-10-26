---
id: den-hall-tests
kind: tests
model: gemini-3.8-flash-high
fence:
  - hall/tests/growth.test.ts
  - hall/tests/den-life.test.ts
  - hall/tests/den-patches.test.ts
  - hall/tests/router.test.ts
acceptance:
  - pnpm exec vitest run --project hall hall/tests/growth.test.ts hall/tests/den-life.test.ts hall/tests/den-patches.test.ts hall/tests/router.test.ts
  - pnpm exec eslint hall/tests/growth.test.ts hall/tests/den-life.test.ts hall/tests/den-patches.test.ts hall/tests/router.test.ts
  - pnpm exec prettier --check hall/tests/growth.test.ts hall/tests/den-life.test.ts hall/tests/den-patches.test.ts hall/tests/router.test.ts
reads:
  - hall/src/den/growth.ts
  - hall/src/app/den-life.ts
  - hall/src/app/services.ts
  - hall/src/jacket/den-patches.ts
  - hall/src/routes/router.ts
  - hall/src/data/cycle.ts
  - hall/src/data/registry.ts
  - hall/tests/showcase.test.ts
  - hall/tests/router.test.ts
  - hall/tests/fixtures/index.ts
  - hall/tests/fixtures/fake-game.ts
  - packages/kit/src/store/types.ts
  - packages/kit/src/store/schema.ts
  - packages/kit/src/store/local-store.ts
  - packages/kit/src/kids.ts
  - packages/kit/src/streak.ts
  - packages/kit/src/daily.ts
  - packages/kit/src/contract.ts
  - packages/kit/src/index.ts
---

## Goal

Unit tests (Vitest, jsdom is not needed) for the Hall's Den Life rules. Write tests only; do not
change any source file. If a test you believe is right fails against the source, keep the test,
mark it `it.fails(...)` with a one-line comment naming the behaviour, and list it in your report.

## Context

- `hall/src/den/growth.ts`: `growthFacts`, `earnedGrowth`, `newGrowth`, `STREAK_MILESTONES`,
  `VERSUS_SERIES_FOR_BEANBAG`.
- `hall/src/app/den-life.ts`: `createDenLife(services, options)`. Build real services with
  `createServices(entries, { backend: { backend: memoryBackend(), persistent: false } })` from
  `hall/src/app/services.ts` and the kit's `memoryBackend`. `FIXTURE_ENTRIES` from
  `hall/tests/fixtures/index.ts` give playable games (test-paddles in slot 11, test-grid in slot
  20, test-catch in slot 26).
- `hall/src/jacket/den-patches.ts`: `blockChampionStatus`, `denDrawer`.
- `hall/src/routes/router.ts`: `parseRoute`, `routeHash`, `DEN_LIFE_SCREENS`.

## Tests

### hall/tests/growth.test.ts

Build `ProgressData` from `emptyProgress`-style data (use the kit's sanitiser defaults: see
`schema.ts` for `emptyDenLife` and how `showcase.test.ts` builds a context).

1. **Nothing earned:** an empty progress gives `[]`.
2. **Trophies:** one item per game with a Legend patch earned, in the order of `manifests`, with
   ids `trophy:<game>`.
3. **Posters:** a family's poster needs a Club patch in every playable game of that family:
   - none when one game of the family lacks it;
   - none for a family with no playable games;
   - with `playable: () => true`, every game counts.
4. **Streak milestones:** the best streak at 6, 7, 29, 30, 99 and 100 gives the paper chain, the
   string lights and the ON AIR sign exactly at their thresholds.
5. **Ribbon:** only when the Block Ladder's champion is true.
6. **Second beanbag:** at 9 and 10 Versus series.
7. **Plaque and remote:** only when `allLampsLit`.
8. `newGrowth` returns items missing from `growthSeen`, in order.

### hall/tests/den-life.test.ts

1. `registerPatches` and `patchesFor`; `registerMicro` and `runCandidates`; `onChange` fires on
   register.
2. **Switches:** `setSwitch('left', 'A')` changes `switches()` and persists in settings.
3. **Seats:** `seatsFor(manifest)`:
   - for a `local+bot` game the second seat is a bot whose kid is the Block Ladder's next rung;
   - after `settings.game(id).set('opponent', 'moss')`, it is Moss.
4. **`recordFinishedRun`:**
   - it records a streak day;
   - in `daily` mode the first run counts (`dailyCounted` true) and a second one the same day does
     not;
   - a bot seat's kid gets a win when `winnerSeat` is 1 and a loss when it is 2;
   - `newLamps` lists the slot whose first patch was just earned (earn one by updating progress
     before the call).
5. **`announceGrowth`:** returns each item once per DenLife instance.
6. **`loadGameData`:** loads the fixtures' modules and registers their patches and micro-challenges
   (test-catch has micro-challenges). Calling it twice returns the same promise.

### hall/tests/den-patches.test.ts

1. **Not champion:**
   - `blockChampionStatus` gives `earned` false;
   - `denDrawer` is empty.
2. **Champion** (all six kids with at least one win):
   - `earned` is true;
   - `earnedAt` is the latest `firstBeatenAt`;
   - gold only when all six have `winsOnA > 0`.
3. `denDrawer` gives one entry `{ game: 'den', patch: 'block-champion', tier: 'legend' }` when
   champion.

### hall/tests/router.test.ts (add to the existing file; keep its tests)

1. `parseRoute('#/jacket')`, `'#/kids'`, `'#/versus'`, `'#/run'` give those route names, and
   `routeHash` gives them back.
2. `'#/jacket/extra'` is not-found.
3. A play route keeps `mode=power-cycle-run` and `micro=…`.

## Style

Each file starts with a one-paragraph comment on what it proves. TypeScript strict, no `any`, no
non-null assertions, ESLint and Prettier clean (single quotes, width 140).
