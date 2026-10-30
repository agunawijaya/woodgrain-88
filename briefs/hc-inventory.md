# Brief: inventory of what prompt 03 left open in Hot & Cold

For: qa-scout. Read-only: do not edit any file except the report below.
References: `CLAUDE.md`, `prompts/03-hot-and-cold.md` (§3.5, §3.6, §3.7, §9, §11, §14),
`prompts/03a-hot-and-cold-finish.md`, `games/tank-duel/` and `games/trailblaze/` (what "done" looks like).

Answer each item with facts and `path:line` evidence. Say "not found" when you searched and found
nothing (and say what you searched for). Mark anything you infer as an inference.

Write the full report to `briefs/hc-inventory.report.md`; your final message is a short summary.

## A. Hall integration

1. Is Hot & Cold registered with a `load` in `hall/src/data/registry.ts`, or still the
   `coming-soon/hot-and-cold.ts` placeholder?
2. Does `games/hot-and-cold/package.json` have `exports` for `./manifest` and `./module` (compare
   `games/trailblaze/package.json`)? Does `hall/package.json` depend on `@woodgrain-88/hot-and-cold`?

## B. Channels and Remix

1. List every channel in `games/hot-and-cold/src/channels.ts`: id, kind, group, title, unlockedBy.
2. For each of the four Remix (Two Flags, Minefield, Thin Ice, Drift Storm): is the channel defined,
   does its `unlockedBy` name a patch that exists in `src/progress/patches.ts`, and where is its rule
   implemented in the engine or session (`path:line`)? If a rule is missing, say so.
3. Prompt 03a asks for groups "Race / Turns / Solo". What groups does the code use?

## C. Patches, micro-challenges, share

1. List patch ids and tiers from `src/progress/patches.ts`. Is the secret Lucky 75 present?
2. Is the cartridge's bonus round on exactly the 75th check implemented (search the engine for
   "bonus", "75")? Cite it.
3. List micro-challenge ids and channels. Where is the emoji share summary built?

## D. Controller and kit contract

In `games/hot-and-cold/src/app/controller.ts` and `src/module.ts`:

1. Which `setPauseItems` calls exist, with which items? (03 asks for Clues mode and Look.)
2. Where is `reportResult` called, and with which `presentation`? Is the share line passed?
3. How are the possibility fog locks applied (daily, challenge, power-cycle-run, versus-night),
   and are records marked when the fog was on?
4. Does the manifest declare `difficulty`, `events`, `supports` (daily, challenge, micro)?

## E. Tests, e2e, screenshots, docs

1. Run `pnpm exec vitest run --project hot-and-cold` from the repo root and report the summary lines.
2. Run `pnpm exec tsc -p games/hot-and-cold/tsconfig.json` and
   `pnpm exec eslint games/hot-and-cold/src games/hot-and-cold/tests`; report error counts.
3. Does `games/hot-and-cold/` have `playwright.config.ts`, `e2e/`, or `docs/media/screens/`?
4. Which of ABOUT.md, HOW-TO-PLAY.md, ARCHITECTURE.md, CHANGES-FROM-ORIGINAL.md, NOTES.md exist in
   `games/hot-and-cold/docs/`? Is there an ADR for the Hot & Cold looks in `docs/adr/`?
5. In `games/hot-and-cold/docs/NOTES.md`: quote the balance numbers and the final Kid memory values
   if present.

## F. The Den's Kid setting (does not exist yet)

1. Where do the Den's settings live (the settings screen in `hall/src`, and the kit's settings
   store and schema in `packages/kit/src`)? Give the current store schema version and how a
   setting is read and written (function names, `path:line`).
2. Where do games read Den-wide settings through `GameContext` (`packages/kit/src/contract.ts`,
   `GameSettingsView`)?
3. Every call site of `memoryProfile(` and `reflexProfile(` in the repo, and every place a game
   passes a `mode: 'human'` (or similar) when building a Kid.
4. Do Tank Duel's Kids use `kids/memory` or `kids/reflex`? Search `games/tank-duel/src`.
5. In Trailblaze: every line that builds a Kid rider (`createKidRider(`), with `path:line`.
