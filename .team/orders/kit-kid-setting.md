---
id: kit-kid-setting
kind: engine
model: gemini-3.8-flash-high
fence:
  - packages/kit/src/settings.ts
  - packages/kit/src/contract.ts
  - packages/kit/src/store/types.ts
  - packages/kit/src/store/schema.ts
  - packages/kit/src/kids/mode.ts
  - packages/kit/src/index.ts
  - packages/kit/tests/kids-mode.test.ts
  - packages/kit/tests/store-schema.test.ts
  - packages/kit/tests/settings.test.ts
acceptance:
  - pnpm exec vitest run --project kit
  - pnpm exec eslint packages/kit/src packages/kit/tests
  - pnpm exec prettier --check packages/kit/src packages/kit/tests
  - pnpm exec tsc -p packages/kit/tsconfig.json
reads:
  - packages/kit/src/settings.ts
  - packages/kit/src/contract.ts
  - packages/kit/src/store/types.ts
  - packages/kit/src/store/schema.ts
  - packages/kit/src/kids/memory.ts
  - packages/kit/src/kids/reflex.ts
  - packages/kit/src/share.ts
  - packages/kit/tests
  - docs/adr/0011-kid-memory.md
  - docs/adr/0012-kid-reflexes.md
---

## Goal

The Den's Kid setting: one collection-wide choice, **Human** (the default) or **Sharp** (harder:
perfect memory, no slips, half reaction time). The kit stores it, exposes it to games, and gives
games and the Hall what they need to mark Sharp results. The Den's settings screen, the Hall's
records screen and the games are wired in a later order. Here only the kit changes.

The type already exists: `MemoryMode = 'human' | 'sharp'` in `kids/memory.ts`, and both
`memoryProfile(kid, mode)` and `reflexProfile(kid, mode)` take it. Reuse it everywhere. Do not add
a second type.

## Changes

1. **Settings data** (`store/types.ts`, `store/schema.ts`):
   - Add `kids: MemoryMode` to `SettingsData` with a doc comment ("The Neighbourhood Kids:
     human-like, or sharp (perfect memory, no slips, half reaction time). Settings v3.").
   - Bump `SCHEMA_VERSIONS.settings` from 2 to 3.
   - Add `migrateSettingsV2ToV3`, which sets `kids: 'human'` and keeps everything else, to
     `MIGRATIONS.settings`, with a comment line like the v1 → v2 one.
   - The sanitiser: `kids: data.kids === 'sharp' ? 'sharp' : 'human'`.
   - Update the default settings wherever they are built.
2. **Settings API** (`settings.ts`): add `kids(): MemoryMode` to `SettingsApi` (reads the repo
   now).
3. **Game contract** (`contract.ts`):
   - Add `kids(): MemoryMode` to `GameSettingsView`, documented: "The Den's Kid setting. Read it
     when a match starts; a change applies from the next match."
   - Add an optional `kids?: MemoryMode` to `GameResult`: "Which Kids the player faced, when Kids
     played. The Hall marks Sharp results on records and share lines."
4. **Records** (`store/types.ts`, `store/schema.ts`):
   - Add an optional `kids?: 'sharp'` to `RunRecord`, present only for runs against Sharp Kids.
   - The records sanitiser keeps it when it is exactly `'sharp'` and drops anything else.
   - Leave the records schema version alone: the field is optional, so old data stays valid.
5. **Marks** (`kids/mode.ts`, exported from `index.ts`):
   ```ts
   /** What a share line or a record says about the Kids, or nothing for human ones. */
   export const SHARP_KIDS_MARK = 'Sharp Kids';
   /** A share line with " · Sharp Kids" on the end when the Kids were sharp; unchanged otherwise. */
   export function withKidsMark(line: string, kids: MemoryMode | undefined): string;
   /** One line for the Den's settings: what Sharp changes. */
   export const SHARP_KIDS_NOTE =
     'Sharp Kids remember everything, never fumble and react twice as fast.';
   ```

## Tests required

- `tests/store-schema.test.ts` (add to the existing schema tests): a stored settings v2 envelope migrates
  to v3 with `kids: 'human'` and nothing else changed; v3 data with `kids: 'sharp'` survives the
  sanitiser; garbage becomes `'human'`; a run record with `kids: 'sharp'` survives the records
  sanitiser and one with `kids: 'loud'` loses the field.
- `tests/settings.test.ts` (new, or add to the file that already tests `createSettings` if there is one; say which): `kids()` follows `update`.
- `tests/kids-mode.test.ts`: `withKidsMark` for human, sharp and undefined; the mark text.
- Every existing kit test keeps passing. If a test builds a full `SettingsData` or fake
  `GameSettingsView` by hand, add the new field there (tests are in your fence).

## Out of scope

The Hall (`hall/`), the games, the Den settings screen, and anything outside the fence. Adding
`kids()` to `GameSettingsView` will make code outside the kit fail to compile until the next order
wires it. That is expected; note it in your report.
