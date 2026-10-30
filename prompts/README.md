# Prompts — Woodgrain '88

Each file is one task for one Claude Code session (Opus 5.5, the *lead*), written by the architect
after the owner approved the design. Each lead runs its own Gemini *crew* through the Antigravity
CLI (`tools/crew/`, built in 00); the owner never relays messages between them.

| # | Prompt | Depends on | Status |
|---|---|---|---|
| 00 | `00-foundation.md` — crew bridge, 30 dossiers, kit, contract, The Den | — | Done 2026-10-26 |
| 00a | `00a-owner-decisions.md` — faithful themes, five renames, cartridge versions | 00 | Done 2026-10-26 |
| 01 | `01-den-life.md` — patches, the jacket, Pro switch, channels, Power Cycle of the day and Run, Versus Night, the Neighbourhood Kids, the Counter | 00, 00a | Done 2026-10-27 |
| 02 | `02-tank-duel.md` — Tank Duel (pilot game) + `packages/arena` (three.js diorama toolkit) | 01 | Done 2026-10-27 |
| 03 | `03-hot-and-cold.md` — Hot & Cold + kit human-like Kid memory; three looks (Polar, Tabletop, Radar) | 02 | Done 2026-10-30 (finished by 03a, `48e7511`) |
| 04 | `04-trailblaze.md` — Trailblaze + kit human-like Kid reflexes; four looks (Neon Grid, Toy Trains, Mummy's Wrap, Ice Trail) | 03 committed | Done 2026-10-29 (`b666453`) |
| 03a | `03a-hot-and-cold-finish.md` — finish Hot & Cold (Hall, e2e, docs, critique) + the Den's Kid setting (Human / Sharp) | 04 | Done 2026-10-30 (`48e7511`) |
| 04a | `04a-trailblaze-polish.md` — readable riders, crash camera, Mummy cocoon crash, results fixes, one-cell lag | 04 | Done 2026-10-30 (`48e7511`) |
| 05+ | One prompt per game, after each game's brief. The first game of each family builds that family's shared package (board, sport) | 02 | Not written yet |

## Conventions

- Open Claude Code in `E:\Projects\Atari-2600\32-in-one` and say: "Run `prompts/NN-<name>.md`."
- Every session reads `CLAUDE.md` and the builder skill first and reports the hard rules in five
  lines before working, then runs `pnpm crew ping` (from prompt 01 on).
- `original/` and `src/` are the owner's reference folders: read-only, git-ignored, never published.
- Prompts with a hero-frame checkpoint stop for the owner's approval; reply in the same session to
  continue.
- Sessions and crews never commit. The owner (or the architect, on request) commits after each wave.
- Fixes to a prompt that has already run arrive as addendum prompts (`00a`, `00b`, ...), never as
  edits to the original.
- `.team/LEDGER.md` shows what the crew did and roughly how many Claude tokens it saved.
