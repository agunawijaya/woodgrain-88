---
id: hc-kid-memory
kind: engine
model: gemini-3.8-flash-high
fence:
  - packages/kit/src/kids/memory.ts
acceptance:
  - pnpm exec vitest run --project kit packages/kit/tests/kids-memory.test.ts
  - pnpm exec eslint packages/kit/src/kids/memory.ts
  - pnpm exec prettier --check packages/kit/src/kids/memory.ts
  - pnpm exec tsc -p packages/kit/tsconfig.json
reads:
  - packages/kit/src/kids/memory.ts
  - packages/kit/tests/kids-memory.test.ts
  - packages/kit/src/rng.ts
  - packages/kit/src/kids.ts
---

## Goal

Implement `createKidMemory` in `packages/kit/src/kids/memory.ts` so every test in
`packages/kit/tests/kids-memory.test.ts` passes. This is the human-like memory the Neighbourhood
Kids use in every game: they forget, mix things up and miss what the other player did.

## Context

The lead has already written everything else in `memory.ts`: the types, the per-Kid profiles, the
sharp-memory profile, `memoryProfile`, `salienceOf` and the module comment. Only the body of
`createKidMemory` is a placeholder that throws; replace it with the real implementation (plus any
small private helpers it needs, below it in the same file). Do not change any exported type,
constant or signature. The tests are the specification and are not yours to change; if one looks
wrong, say so in your report.

## Interface to implement

```ts
export function createKidMemory<F>(profile: MemoryProfile, adapter: FactAdapter<F>): KidMemory<F>;
```

`KidMemory<F>`, `FactAdapter<F>`, `MemoryEvent<F>`, `MemorySummary<F>` and `FORGET_BELOW` are
defined above it in the file.

## Behaviour and edge cases

1. Each held fact remembers: its key (`adapter.key`), the current belief (the fact as the Kid now
   believes it), the original truth (as first learned), its salience, the time it was last
   refreshed, and the order in which it was first learned.
2. Strength at time `now` is `salience * 0.5 ** ((now - refreshedAt) / halfLife)`. With an
   infinite half-life it is just the salience.
3. `observe(fact, salience, now)`:
   - If a fact with the same key is held, replace its belief and its truth with `fact`, set its
     salience and refresh time to `now`. Keep its learned order, and log nothing.
   - Otherwise, if the memory already holds `capacity` facts, push out the weakest held fact
     (lowest strength at `now`; on a tie the one learned first) and log
     `{ kind: 'pushed-out', fact: <its belief>, at: now }`. The new fact is always kept, even when
     it is weaker than every held fact.
   - Then add the new fact and log `{ kind: 'learned', fact, at: now }`.
4. `witness(fact, salience, now, rng)`:
   - Attention of 1 or more notices without a draw. Otherwise it draws `rng.chance(attention)`
     exactly once.
   - Noticed: behave exactly like `observe` and return `true`.
   - Not noticed: log `{ kind: 'missed', fact, at: now }`, learn nothing and return `false`.
5. `recall(now, rng)` goes through the held facts in the order they were first learned. For each:
   1. If its strength is below `FORGET_BELOW`, remove it and log
      `{ kind: 'forgotten', fact: <its belief>, at: now }`. No draw.
   2. Otherwise it is retrieved: without a draw when its strength is 1 or more, else when
      `rng.chance(strength)` is true. A fact that is not retrieved stays held and is not returned.
      Nothing is logged.
   3. If retrieved and `0 < distortion < 1`, draw `rng.chance(distortion)`. If `distortion >= 1`,
      distort without a draw. To distort:
      - `const became = adapter.distort(belief, rng)`;
      - log `{ kind: 'misremembered', fact: <previous belief>, at: now, became }`;
      - the belief becomes `became`, and the truth stays as it was.
   4. If retrieved and `profile.rehearsal`, set its refresh time to `now`.
   5. Return the beliefs of the retrieved facts, in the same order.
6. `forgetAll()` removes every held fact without logging anything. The log is kept.
7. `log` is the list of every event in order, exposed read-only (return the same array or a frozen
   view; tests read it with `toEqual`). Omit `became` from events other than `'misremembered'`;
   do not set it to `undefined`.
8. `summary()`:
   - `kept`: the beliefs of the facts held now, in learned order;
   - `forgotten`: the facts of every `'forgotten'` and `'pushed-out'` event, in log order;
   - `missed`: the facts of every `'missed'` event, in log order;
   - `misremembered`: one entry per key that was ever distorted, `{ truth, belief }`. The truth is
     the fact as first learned under that key. The belief is the latest belief, taken from the last
     `'misremembered'` event for that key. List them in the order of their first distortion.
9. Only the draws described above may be made: `rng.chance` for attention, retrieval and
   distortion, plus whatever `adapter.distort` does. The tests use a scripted Rng that fails on any
   other call.
10. Everything is deterministic for the same inputs and seed.

## Tests required

They already exist in `packages/kit/tests/kids-memory.test.ts`; make them all pass. Do not write
other test files.

## Out of scope

- Any change to the exported types, constants, profile values or other functions in `memory.ts`.
- `packages/kit/src/index.ts`; the lead exports the module.
- Any game code.
