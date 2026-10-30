# Brief: wire the Den's Kid setting into the Den, the Hall and the games

For: engineer. Runs after `briefs/kit-kid-setting.md` (the kit now has `SettingsData.kids`,
`SettingsApi.kids()`, `GameSettingsView.kids()`, `GameResult.kids`, `RunRecord.kids`,
`withKidsMark`, `SHARP_KIDS_MARK`, `SHARP_KIDS_NOTE`). References: `CLAUDE.md`,
`prompts/03a-hot-and-cold-finish.md` §2. The decisions below are the director's and are final.

Stay inside the files named below. Another session works in `games/trailblaze/` at the same time:
there, change only the lines this brief names. Do not commit or touch the git index.

## 1. The Den's settings (`hall/src/chrome/settings-panel.ts`)

In the **Den Life** section, after the "Put my name on share lines" toggle and before "Versus
Night series length", add a choice built the way the Versus Night choice is:

- a note line `The Neighbourhood Kids`;
- a radio group, `aria-label="The Neighbourhood Kids"`, with **Human** (value `human`) and
  **Sharp (harder)** (value `sharp`), wired to `settings.update` like the others;
- under it, a `settings-note` with the kit's `SHARP_KIDS_NOTE`.

## 2. The Hall's game context and records (`hall/src/play/session.ts`, Hall records views)

- `settings.kids: () => settings.kids()` in the context the Hall gives a game.
- In `reportResult`: when `result.kids === 'sharp'`, the submitted run record gets `kids: 'sharp'`.
- Anywhere the Hall writes a share line itself (search `dailyShareLine` in `hall/src`): pass it
  through `withKidsMark(line, result.kids)`.
- Anywhere the Hall lists run records (search where records boards are rendered in `hall/src`): a
  record with `kids: 'sharp'` shows ` · Sharp Kids` after its date, in the same muted style as the
  date. If you find more than one place, do all of them and list them.

## 3. Hot & Cold (`games/hot-and-cold/src/app/controller.ts`, `src/dev/fake-context.ts`, `src/dev/game.ts`)

- `kidMemory()` returns `context.settings.kids()`. It is read when a match starts (it already is),
  so a change applies from the next match.
- The `GameResult` it reports carries `kids: <the mode the match used>` when a Kid played, and
  nothing otherwise. The share line goes through `withKidsMark`.
- The dev fake context gains `kids()`, from a harness URL option `kids=sharp` (default `human`),
  read in `src/dev/game.ts` the way the other options are.

## 4. Trailblaze: only these lines

- `games/trailblaze/src/app/controller.ts`:
  - the `createKidRider` call in `driverFor` uses `mode: context.settings.kids()` (read when the
    ride starts);
  - the `recordMatch` call's `memory` field and the `GameResult` get the same mode (`kids` only when
    a Kid rode);
  - the results' share line goes through `withKidsMark`.

  Change nothing else in that file.

- `games/trailblaze/src/dev/fake-context.ts` and `src/dev/game.ts`: `kids()` and the `kids=sharp`
  harness option, as for Hot & Cold.
- Leave `src/demo/demo.ts`, `src/dev/play.ts` and `src/sim/` as they are: the Den TV demo and the
  dev pages always show Human Kids.

## 5. Tank Duel

Its Kids use neither `kids/memory` nor `kids/reflex`. Add `kids()` to
`games/tank-duel/src/dev/fake-context.ts` so it compiles, and nothing else in its code. Append one
line to the open-questions or notes list in `games/tank-duel/docs/NOTES.md`: "The Den's Kid setting
(Human / Sharp, prompt 03a) does not change Tank Duel's Kids: they use neither `kids/memory` nor
`kids/reflex`."

## 6. Checks

From the repo root, and report the key lines:

- `pnpm exec tsc -p` for `hall`, `games/hot-and-cold`, `games/trailblaze`, `games/tank-duel`;
- `pnpm exec vitest run --project hall --project hot-and-cold --project trailblaze --project kit`;
- `pnpm exec eslint` and `pnpm exec prettier --check` on every file you touched.

Report back: files changed (one line each), the checks and their key output, anything not done, and
any visual or gameplay question you stopped at.
