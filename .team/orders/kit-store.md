---
id: kit-store
kind: engine
fence:
  - packages/kit/src/store/local-store.ts
  - packages/kit/src/store/schema.ts
  - packages/kit/src/store/repos.ts
  - packages/kit/src/store/transfer.ts
  - packages/kit/tests/store-*.test.ts
acceptance:
  - pnpm exec vitest run packages/kit/tests/store-
  - pnpm exec tsc -p packages/kit/tsconfig.json
  - pnpm exec eslint packages/kit/src/store packages/kit/tests/store-local.test.ts packages/kit/tests/store-schema.test.ts packages/kit/tests/store-repos.test.ts packages/kit/tests/store-transfer.test.ts
  - pnpm exec prettier --check packages/kit/src/store packages/kit/tests
reads:
  - packages/kit/src/store/local-store.ts
  - packages/kit/src/store/types.ts
  - packages/kit/src/store/schema.ts
  - packages/kit/src/store/repos.ts
  - packages/kit/src/store/transfer.ts
  - packages/kit/src/emitter.ts
  - packages/kit/src/input.ts
  - packages/kit/src/types.ts
  - tsconfig.base.json
  - eslint.config.js
---

## Goal

Implement the kit's store: the single door to persistence for The Den and every game. The lead has
written every type, constant and function signature; you write the bodies and the tests.

## Context

- Four files hold `export declare function ...` declarations with doc comments:
  `local-store.ts`, `schema.ts`, `repos.ts`, `transfer.ts`. Replace each `declare` with a real
  implementation. Keep every exported name, signature, type and doc comment exactly as written; you
  may add private (non-exported) helpers and short module-level comments that explain why.
- `types.ts` (read-only for you) defines the data shapes; `emitter.ts` gives `createEmitter` for
  `onChange`.
- TypeScript is strict with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`; ESLint
  uses the strict type-checked presets (no `any`, no non-null `!`, no unsafe member access on
  `unknown` without narrowing). Narrow `unknown` with small type-guard helpers.
- Tests use Vitest in a happy-dom environment (`packages/kit/vitest.config.ts`). Import from
  `../src/store/...` with the `.ts` extension, like the source files do.

## Interface to implement

Exactly the declarations in the four files. Summary:

- `browserBackend()`, `memoryBackend(seed?)`, `createLocalStore(backend, { persistent? })`
- `defaults(name, context)`, `sanitize(name, data, context)`, `upgrade(name, envelope, context)`
- `createRepositories(store, context?)` returning `Repositories`
- `exportAll(repos, now?)`, `exportFileName(now?)`, `previewImport(text, context?)`,
  `applyImport(repos, bundle)`

## Behaviour and edge cases

1. Keys are `wg88:<repo name>`. `clearAll` removes only keys starting with `wg88:`.
2. `browserBackend` probes `localStorage` by writing and removing `wg88:probe` inside try/catch;
   any exception (or `localStorage` missing) returns a memory backend with `persistent: false`.
3. `createLocalStore.read` returns undefined for missing keys, unparsable JSON, or JSON that is not
   an object with an integer `v` and a `data` property. It never throws.
4. A write that throws (quota) copies the store's current contents into a memory backend, retries
   the write there, sets `persistent` to false and keeps going; later reads come from memory.
5. `onChange` fires after write, remove (with the name) and clearAll (with null).
6. `defaults` follows the doc comment in `schema.ts` exactly. Progress, records, stats, saves and
   event-log default to empty maps or lists.
7. `sanitize` returns null only when `data` is not a plain object. Otherwise it rebuilds the exact
   shape: missing or wrongly typed fields come from defaults, unknown keys are dropped, numbers must
   be finite (non-finite → default), volumes clamp to 0–1, hue wraps into 0–359 (integers),
   counts and durations floor at 0, strings are trimmed (display name capped to 20 characters and
   replaced by the default if empty), enum fields outside their allowed values fall back to the
   default, record boards keep only valid `RunRecord`s and at most `RECORDS_PER_BOARD` of them in
   stored order, the event log keeps only valid sessions and the newest `EVENT_LOG_LIMIT`.
   `controls.bindings` keeps a value only if it has both seats with `keys` and `pad` objects whose
   values are arrays of strings / pad inputs; otherwise null. `padSeats` must be two seats (1 or 2).
8. `upgrade` applies `MIGRATIONS[name]` from the envelope's version to `SCHEMA_VERSIONS[name]`, then
   sanitises. A version higher than current, or a non-integer / below-1 version, returns null.
9. Each repository reads and upgrades its document lazily on first `get`, falling back to
   defaults; `get` returns the cached object. `set` sanitises then writes
   `{ v: current version, data }`. `update` passes a deep copy (`structuredClone`) to the change
   function and uses its return value if it returns one, otherwise the mutated copy. `reset`
   writes defaults. `onChange` fires after set, update and reset.
10. `forgetAll` calls `clearAll` and resets every repository's cache to defaults (the profile gets a
    new id) without writing defaults back.
11. `exportAll` includes every repository's current data in its envelope; `exportedAt` is
    `now.toISOString()`. `exportFileName` gives `woodgrain-88-YYYY-MM-DD.json` (UTC date).
12. `previewImport` refuses with these reasons: longer than `MAX_IMPORT_BYTES` characters → "That
    file is too big to be a Woodgrain '88 save."; not JSON → "That file is not a Woodgrain '88
    save."; wrong `app` → same message; `format` greater than `EXPORT_FORMAT` → "That save comes
    from a newer version of Woodgrain '88."; no usable repository → "That save has nothing we can
    read." Otherwise it upgrades and sanitises each known repository, drops failures and unknown
    names, and builds the summary: display name (or null), number of record boards' distinct games
    with at least one run, total runs, patches with a non-null `earnedAt`, and sessions.
13. `applyImport` calls `set` on each repository present in the bundle and leaves the others.

## Tests required

Write these first, in four files:

- `store-local.test.ts`: read/write/remove round trip; corrupt JSON and wrong envelope shapes read
  as undefined; clearAll leaves foreign keys alone; a backend whose setItem throws switches to
  memory, keeps the data and reports `persistent: false`; onChange fires with the right names;
  `browserBackend` falls back when localStorage throws.
- `store-schema.test.ts`: defaults match the documented values; sanitize fills missing fields,
  drops unknown keys, clamps volumes and wraps hue, trims and caps display names, caps boards and
  the event log, rejects non-objects; upgrade refuses future and malformed versions; a migration
  added in a test (push onto a copy of the chain via a local helper, do not mutate the export)
  is applied in order — if the exported `MIGRATIONS` cannot be extended without mutation, test
  `upgrade` with the version-1 path only and say so in your report.
- `store-repos.test.ts`: lazy defaults; set/update/reset persist and notify; update receives a
  copy (mutating the draft does not change `get()` until committed); data written by one
  `createRepositories` is read back by a second over the same backend; forgetAll gives a new
  profile id and removes stored keys.
- `store-transfer.test.ts`: export → previewImport → applyImport round trip into a fresh memory
  store; every refusal reason; a file with one valid and one broken repository imports only the
  valid one; unknown repository names are ignored; the summary counts are right.

Use a fixed clock (`now: () => new Date('2026-10-25T12:00:00Z')`) and a counter-based `newId`.

## Out of scope

Settings logic, the UI for export/import, any file outside the fence. Do not edit `types.ts`.
