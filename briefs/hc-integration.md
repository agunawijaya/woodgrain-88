# Brief: Hot & Cold into the Hall, channel groups, pause items

For: engineer. References: `CLAUDE.md`, `AGENTS.md`, `prompts/03a-hot-and-cold-finish.md` (§1),
`prompts/03-hot-and-cold.md` (§14), and the finished siblings `games/trailblaze/` and
`games/tank-duel/` (how a game is wired into the Hall). This repo has no DESIGN.md; the decisions
below are the director's and are final.

Stay inside: `games/hot-and-cold/**` (except `docs/`), `hall/src/data/registry.ts`,
`hall/src/data/coming-soon/hot-and-cold.ts` (delete it), `hall/package.json`, `pnpm-lock.yaml`
(through `pnpm install --offline` only). Another session may be working in `games/trailblaze/`: do
not touch it. Do not commit.

## 1. Into the Hall (as Trailblaze did)

- `games/hot-and-cold/package.json`: `exports` for `./manifest` → `./src/manifest.ts` and
  `./module` → `./src/module.ts` (copy Trailblaze's shape).
- `hall/package.json`: depend on `"@woodgrain-88/hot-and-cold": "workspace:*"`, then
  `pnpm install --offline` from the repo root.
- `hall/src/data/registry.ts`: import the manifest from `@woodgrain-88/hot-and-cold/manifest`,
  replace the placeholder entry with `{ manifest: hotAndCold, load: () =>
import('@woodgrain-88/hot-and-cold/module').then((module) => module.hotAndCold) }`, with a one-line
  comment like Trailblaze's. Delete `hall/src/data/coming-soon/hot-and-cold.ts`. Do not use `git rm`
  or touch the git index.
- Check: `pnpm exec tsc -p hall/tsconfig.json`, `pnpm exec vitest run --project hall`, and the
  Hall build (`pnpm --filter <hall package name> build`): report the Hall entry chunk size and the
  Hot & Cold chunk size, and confirm three.js is not in the Hall's entry chunk (grep the built
  entry for `WebGLRenderer`).

## 2. Channel groups

The Hall shows channels in groups. Use exactly these `group` values in
`games/hot-and-cold/src/channels.ts`:

| Channels                                    | Group   |
| ------------------------------------------- | ------- |
| game-1                                      | `Race`  |
| game-2 to game-7 (turns, and hunt for hunt) | `Turns` |
| game-8 to game-10 (the clock games)         | `Solo`  |
| the four Remix                              | `Remix` |

Titles and descriptions stay as they are. Update any test that pins the old groups, and add one
that pins these.

## 3. Pause items (during a match)

`context.setPauseItems` during a match, in this order, labels exactly as written:

1. **`Look: <look name>`**, for example `Look: Polar Expedition`. Selecting it moves to the next of
   the three looks and saves the setting. It applies **live**: the match goes on, on a new stage
   for the new look.
   - Add `setLook(next: { stage: Stage; look: LookDefinition }): void` to the Hot & Cold
     `MatchSession`. It works like the existing `setAppearance`: take the old view off, dispose it,
     build the view on the new stage with the new look, `redraw()`, and switch the match sound to
     the new look's palette.
   - The controller builds the new stage (`createLookStage`), calls `session.setLook`, then
     disposes the old stage.
   - After the change, set the pause items again so the label shows the new look.
2. **`Clues: Classic Memory`** or **`Clues: Notebook`**. Selecting it switches the setting. It
   applies **from the next match**, never mid-hunt: records are kept per clue mode, and switching
   to Notebook mid-hunt would show every hidden clue. While the setting differs from the clues the
   current match uses, the label ends with ` (next match)`, for example
   `Clues: Notebook (next match)`. Only in normal runs; in daily, challenge, Power Cycle Run and
   Versus Night runs leave the item out.
3. **`Change channel`**: the existing item, unchanged (normal runs only).

The menu and results screens keep no pause items, as today.

## 4. Checks

Run from the repo root and report the summary lines:

- `pnpm exec vitest run --project hot-and-cold`
- `pnpm exec tsc -p games/hot-and-cold/tsconfig.json`
- `pnpm exec eslint games/hot-and-cold/src games/hot-and-cold/tests`
- `pnpm exec prettier --check games/hot-and-cold hall/src`
- the Hall checks in §1

Then open the game in its harness and check the two pause items work (start the game's dev server
on port 4521 with `pnpm exec vite --port 4521 --strictPort` in `games/hot-and-cold`, use
`http://localhost:4521/game.html`, and stop the server you started when done). Use Playwright from
a script, as `games/trailblaze/e2e/` does. Describe what you saw.

Report back: files changed (one line each), checks and their key output, anything you did not do,
and any visual or gameplay question you stopped at.
