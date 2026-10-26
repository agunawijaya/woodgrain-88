---
id: den-store-v3
kind: data
model: gemini-3.8-flash-high
fence:
  - packages/kit/src/store/schema.ts
  - packages/kit/tests/store-schema.test.ts
  - packages/kit/tests/store-transfer.test.ts
  - packages/kit/tests/store-repos.test.ts
acceptance:
  - pnpm exec vitest run --project kit packages/kit/tests/store-schema.test.ts packages/kit/tests/store-transfer.test.ts packages/kit/tests/store-repos.test.ts
  - pnpm exec eslint packages/kit/src/store/schema.ts packages/kit/tests/store-schema.test.ts packages/kit/tests/store-transfer.test.ts packages/kit/tests/store-repos.test.ts
  - pnpm exec prettier --check packages/kit/src/store/schema.ts packages/kit/tests/store-schema.test.ts packages/kit/tests/store-transfer.test.ts packages/kit/tests/store-repos.test.ts
reads:
  - packages/kit/src/store/types.ts
  - packages/kit/src/store/schema.ts
  - packages/kit/src/store/transfer.ts
  - packages/kit/src/store/repos.ts
  - packages/kit/src/kids.ts
  - packages/kit/src/types.ts
  - packages/kit/src/daily.ts
  - packages/kit/tests/store-schema.test.ts
  - packages/kit/tests/store-transfer.test.ts
  - docs/adr/0006-store.md
---

## Goal

Den Life (prompt 01) needs new stored data. The lead has already written the new types in
`packages/kit/src/store/types.ts`. Make the schema read, sanitise and migrate them:

- settings go to version 2;
- progress goes to version 3, with a new `den` block;
- an export of everything comes back unchanged through import.

## Context

`schema.ts` keeps one version per repository (`SCHEMA_VERSIONS`), a migration chain per repository
(`MIGRATIONS[name][i]` turns version i+1 into i+2), and a `sanitize` per repository that rebuilds the
exact shape: it fills defaults for missing or wrong fields, drops unknown keys and clamps numbers.
`upgrade` runs the chain and then sanitises. Follow the style of the existing sanitisers
(`isPlainObject`, `trimmedString`, `floorZero`, `booleanOr` and the like). Never throw on bad data.

New in `types.ts`:

- `SettingsData` adds `difficulty` (`{ left: 'A' | 'B'; right: 'A' | 'B' }`), `showGrowth`,
  `shareWithName`, `versusBestOf` (`3 | 5`) and `runSound` (`'quiet' | 'normal' | 'loud'`).
- `ProgressData` adds `den: DenLifeData`, made of:
  - `streak`, `daily`, `kids`, `jacket`, `versus` and `runs`;
  - `growthSeen` and `counterCompletedAt`;
  - their nested types (`StreakData`, `DailyRunData`, `KidRecordData`, `PatchPlacement`,
    `JacketData`, `VersusSeriesRecord`, `RivalryData`, `VersusData`, `RunRoundData`,
    `RunResultData`, `RunsData`).
- Constants `VERSUS_RECENT_LIMIT` (20) and `RECORDS_PER_BOARD` (10). `KID_IDS` lives in `kids.ts`.

## Interface to implement

```ts
// packages/kit/src/store/schema.ts — new exports
/** Den Life before anything has happened. */
export function emptyDenLife(): DenLifeData;
// SCHEMA_VERSIONS.settings becomes 2 and SCHEMA_VERSIONS.progress becomes 3.
// MIGRATIONS.settings gains its first step (v1 → v2); MIGRATIONS.progress gains a second step (v2 → v3).
```

## Behaviour and edge cases

1. Settings defaults:
   - `difficulty` is `{ left: 'B', right: 'B' }`;
   - `showGrowth` is true;
   - `shareWithName` is false;
   - `versusBestOf` is 3;
   - `runSound` is `'normal'`.

   The v1 → v2 migration adds exactly these and keeps everything else.

2. Progress v2 → v3 adds `den: emptyDenLife()` and keeps `games` untouched.
3. `emptyDenLife()` returns:
   - `streak` as `{ days: {}, best: 0 }`;
   - `daily` as `{}`;
   - `kids` as `{}`;
   - `jacket` as `{ placements: [], lookedAt: null }`;
   - `versus` as `{ seriesPlayed: 0, recent: [], rivalries: {} }`;
   - `runs` as `{ free: [], daily: {} }`;
   - `growthSeen` as `{}`;
   - `counterCompletedAt` as null.

   It returns a fresh object each call.

4. Sanitising `den` rules (each bad entry is dropped or clamped, never the whole block):
   - Day keys (in `streak.days`, `daily`, `runs.daily`): only valid `YYYY-MM-DD` dates. Day kinds:
     only `'played'` or `'snow'`. `best` is a whole number ≥ 0.
   - Times (`at`, `lookedAt`, `firstBeatenAt` and so on) are non-empty strings, or null where the
     type allows null.
   - `daily[day][game]`:
     - `score` is a finite number;
     - `scoreLabel` is a string of at most 40 characters;
     - `emoji` is a string or null;
     - `channel` is a kebab-case id;
     - `at` is a time.
   - `kids`: only keys in `KID_IDS`. Counts are whole numbers ≥ 0, and `winsOnA` is at most `wins`.
   - `jacket.placements`:
     - `side` is `'front'` or `'back'`;
     - `x` is clamped to 0–600 and `y` to 0–700;
     - `rotation` is normalised to a multiple of 15 in [0, 360);
     - `z` is a whole number;
     - `game` and `patch` are kebab-case ids.

     Drop duplicates of the same game+patch, keeping the first.

   - `versus.recent`:
     - at most `VERSUS_RECENT_LIMIT`, keeping the newest (the end of the list);
     - each record has two names of 1–20 characters, `kids` entries that are kid ids or null,
       `bestOf` 3 or 5, `games` with `winner` 1, 2 or null, and `winner` 1 or 2.

     `seriesPlayed` is a whole number ≥ 0.

   - `versus.rivalries`: `names` is two strings, sorted; `series` and `games` are pairs of whole
     numbers ≥ 0.
   - `runs.free`: sorted by `score`, highest first, at most `RECORDS_PER_BOARD`. Each round has a
     kebab `game` and `challenge`, a boolean `passed` and `seconds` ≥ 0.
   - `growthSeen`: string keys with time values.
5. Settings sanitising:
   - a `difficulty` side that is not `'A'` or `'B'` becomes `'B'`;
   - `versusBestOf` other than 5 becomes 3;
   - an unknown `runSound` becomes `'normal'`;
   - booleans fall back to their defaults.
6. `transfer.ts` needs no change. `previewImport` and `applyImport` go through
   `upgrade`/`sanitize`, so a v1/v2 export file imports into the new shape.

## Tests required

- Settings: a v1 envelope upgrades to v2 with the new defaults and the old values intact.
- Progress: a v2 envelope upgrades to v3 with an empty `den` and the old games intact.
- `emptyDenLife()`: has the exact shape, and two calls return distinct objects.
- One test per rule in 4 and 5, each with a bad value that gets dropped or clamped.
- An export → `previewImport` → `applyImport` round trip of a fully populated `den` (every field
  set) reproduces it exactly.
- A v2 progress export file still imports into the current shape.
- Update the existing store tests for the new versions: they currently expect settings v1 and
  progress v2.

## Out of scope

Any file outside the fence. Other kit tests that build `ProgressData` by hand will be updated by
the lead.
