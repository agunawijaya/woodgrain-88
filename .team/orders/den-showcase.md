---
id: den-showcase
kind: data
model: gemini-3.8-flash-high
fence:
  - hall/src/dev/showcase.ts
  - hall/tests/showcase.test.ts
acceptance:
  - pnpm exec vitest run --project hall hall/tests/showcase.test.ts
  - pnpm exec eslint hall/src/dev/showcase.ts hall/tests/showcase.test.ts
  - pnpm exec prettier --check hall/src/dev/showcase.ts hall/tests/showcase.test.ts
reads:
  - packages/kit/src/store/types.ts
  - packages/kit/src/store/schema.ts
  - packages/kit/src/patches.ts
  - packages/kit/src/kids.ts
  - packages/kit/src/streak.ts
  - packages/kit/src/versus.ts
  - packages/kit/src/contract.ts
  - packages/kit/src/daily.ts
  - packages/kit/src/rng.ts
  - hall/src/data/registry.ts
  - hall/src/data/cycle.ts
  - hall/src/den/growth.ts
---

## Goal

A dev-only **showcase profile generator**. `pnpm dev` with `?showcase=full|mid|new` fills the Den
from it, so every Den Life screen and growth item can be seen, judged and photographed before any
real game exists. This order covers the pure generator and its tests. The lead wires it into the
Hall (in-memory stores, dev builds only).

## Context

- Coming-soon games have no game module, so no patch definitions. The generator therefore also
  invents **synthetic patch definitions** for every game. Use the kit's tiers (club, pro, legend,
  secret) and our own titles: short, warm, never a trademark, at most 28 characters. Draw them
  from per-family title pools so the jacket reads varied.
- Growth rules are in `hall/src/den/growth.ts`:
  - a Legend patch earns a trophy;
  - a Club patch in every playable game of a family earns its poster. For the showcase, treat
    every game as playable when deciding posters: the lead's wiring passes the showcase's own
    "playable" set;
  - streak best 7, 30 and 100 earn the chain, the lights and the ON AIR sign;
  - Block champion earns the ribbon;
  - 10 Versus series earn the second beanbag;
  - all 32 lamps earn the plaque.
- Counter lamps (`hall/src/data/cycle.ts`, `counterPlaces`):
  - lamps 1–30 light when the game has a first patch earned;
  - lamps 31–32 light from `versionsFinished` for Lane Hopper's `rabbit` and Pier Derby's `hack`.
- Stored shapes are in `packages/kit/src/store/types.ts`. Use `emptyDenLife()` from `schema.ts`
  as the base. The result must survive `sanitize` unchanged: valid keys, ids, times and limits.
- Everything is deterministic from `level` and `now`: no `Math.random`, no real clock.

## Interface to implement

```ts
// hall/src/dev/showcase.ts
import type {
  GameManifest,
  PatchDef,
  ProgressData,
  RecordsData,
  StatsData,
} from '@woodgrain-88/kit';

export type ShowcaseLevel = 'full' | 'mid' | 'new';

export interface ShowcaseProfile {
  displayName: string;
  progress: ProgressData;
  stats: StatsData;
  records: RecordsData;
  /** Synthetic patches for every game, four per game: club, pro, legend, secret (with a hint). */
  patches: Record<string, PatchDef[]>;
}

export function showcaseProfile(
  level: ShowcaseLevel,
  manifests: readonly GameManifest[],
  now: Date,
): ShowcaseProfile;
export function parseShowcaseLevel(search: string): ShowcaseLevel | null; // reads "?showcase=…"
```

## Behaviour and edge cases

1. **'full'** has every growth item earned:
   - every game's club patch earned;
   - pro earned in at least 20 games;
   - legend in exactly 12 games, spread across all four families (12 trophies);
   - secret in 6 games;
   - at least 10 earned patches gold;
   - best streak 104 and a current streak of 34 ending on `now`'s UTC day, with exactly one snow
     day in each of two different weeks;
   - Block Ladder at the top: all six kids beaten, at least two of them on A;
   - versus `seriesPlayed` 12, with 12 `recent` series and 3 rivalries ("Robin", "Sam", "Alex",
     plus kid names);
   - `versionsFinished` for lane-hopper/rabbit and pier-derby/hack, so all 32 lamps are lit;
   - a jacket with every earned front-side patch placed by a simple grid layout on the front
     (600×700 units, at least 30 placements, no two within 60 units of each other) and 8 on the
     back;
   - free run records (3) and today's daily run;
   - stats with plays for every game.
2. **'mid'** is a profile mid-way, matching the prompt's numbers:
   - patches in 27 games, so 27 lamps (no alternate versions);
   - clubs complete in two families only (two posters);
   - 5 legends;
   - streak current and best 34 (chain and lights, no ON AIR);
   - ladder rung 4 (Pip, Benny, Dee, Rosa beaten);
   - versus 12 series (second beanbag);
   - 20 placements on the front.
3. **'new'** is empty: `emptyDenLife()`, no patches earned, but the synthetic `patches` are still
   provided (so the jacket shows locked outlines). The display name is "Player".
4. Display names: 'full' → "Robin", 'mid' → "Sam".
5. `parseShowcaseLevel`:
   - `'?showcase=full'` gives 'full';
   - `'?a=1&showcase=mid'` gives 'mid';
   - an unknown value, or no parameter, gives null.
6. Patch ids are `${tier}-${index}` kebab, unique per game. Titles are at most 28 characters and
   secret hints at most 90.

## Tests required (`hall/tests/showcase.test.ts`)

- For each level, the profile survives `sanitize('progress', …)` unchanged.
- 'full' satisfies every number in 1, checked through the real rules: `earnedGrowth(growthFacts(…))`
  includes every growth kind, and `counterPlaces` plus `placeFinished` light all 32 lamps.
- 'mid' satisfies every number in 2, through the same rules.
- 'new' earns no growth and lights no lamps.
- Determinism: the same level and `now` give deep-equal profiles.
- `parseShowcaseLevel` covers the cases in 5.

## Out of scope

Wiring into the Hall, rendering, any other file.
