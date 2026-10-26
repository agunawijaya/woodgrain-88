# AGENTS.md — rules for every agent on Woodgrain '88

These rules apply to every lead (Claude Code) and every crew member (Gemini through `tools/crew/`).
`CLAUDE.md` holds the hard rules and wins on them; this file wins on build details.

## Hard rules, short

1. **Provenance.** Rebuild rules and behaviour in fresh code. Never copy disassembly, bytes, sprite
   bitmaps, colour or sound tables, layouts, screen text or music from the originals, and never
   reconstruct them from memory or the internet. `original/`, `src/` and `research/` are read-only,
   git-ignored and never imported, bundled or quoted.
2. **Our own titles.** Original titles, publishers and the console's name appear only in
   `inspiredBy` fields, `CREDITS.md` and the About page (`hall/src/pages/about.ts`). No league,
   team, brand or real-person names anywhere.
3. **Zero raster, no audio files, no network.** Visuals from SVG, Canvas, WebGL or CSS; sound
   synthesised with the kit's audio engine; fonts self-hosted (OFL/Apache). Screenshots live only in
   `docs/media/` and `games/*/docs/media/`.
4. **Light and dark, designed.** Every screen ships a day and a night variant; Light / Dark / System,
   default System; react live to changes.
5. **Accessible, web first.** Full keyboard play, `:focus-visible` for keyboard users, reduced
   motion honoured, AA contrast, gamepads for couch versus, small screens not broken.
6. **Faithful to the originals.** Each game keeps its real theme and mechanics: tanks and planes
   fire and explode, gunfighters carry six-shooters, boxers go for the knockout, crashes are
   crashes, Blackjack has chips and bets, the slot machine has credits. Chips and credits are play
   money inside the game; no real money, nothing for sale, no ads. Arcade presentation, no gore.
   No pressure or guilt copy to pull players back, and streaks forgive.
7. **Local first.** Only `packages/kit/src/store/` touches browser storage.
8. **Humanized code.** Intention-revealing names, small functions, comments that explain why, no
   dead or commented-out code, TypeScript strict, ESLint and Prettier clean.
9. **Git.** Nobody commits or pushes except the owner (or the architect on request). The crew never
   touches git.

## Folders

| Folder                               | Who changes it                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `packages/kit/`                      | Only the wave's named kit owner. Everyone else writes helpers in `games/<id>/src/lib/` and lists them as kit candidates. |
| `hall/`                              | The session whose prompt names it. Shared files (registry, PROGRESS row) only at the very end.                           |
| `games/<id>/`                        | That game's session.                                                                                                     |
| `tools/crew/`, `docs/team/`          | Leads, carefully: the bridge is security-sensitive.                                                                      |
| `.team/orders/`, `.team/ledger.json` | The lead that dispatches; the crew never.                                                                                |
| `research/`                          | Leads and dossier orders; never published.                                                                               |

## The game contract

Every game exports a manifest (data) and a module (`mount`, `demo`, patches, micro-challenges, How
to play); see `docs/adr/0002-game-contract.md` and `packages/kit/src/contract.ts`. Games report
results through `reportResult`, emit their declared events, use the context's loop and input, and
never touch storage, the URL or the document outside their host.

## Navigation standard

Two destinations with fixed names: **Game menu** and **Back to the Hall**.

- Game menu: "← Back to the Hall" top left; Escape there returns to the Hall.
- Play: a visible pause button with an "Esc" hint.
- Pause menu, in this order: Resume · game items · How to play · Settings · Game menu · Back to the
  Hall.
- Results, in this order: Play again (R) · Game menu · Back to the Hall (H); in versus, Rematch (R)
  and a winner banner per seat.
- Confirm before losing progress; browser Back works.

## Working alongside others

- Stay inside the folders your prompt names; touch shared files only at the end, re-reading them
  first and editing only your own lines.
- Use your assigned port (Hall 4488/5488; games 4500–4599) and a game-scoped Playwright config.
- Never stop processes you did not start; scope formatters to your own files.
- Ask the owner before installing a dependency while others run.
- Update `docs/PROGRESS.md` once, at the end.

## Working with the crew

Leads delegate through `pnpm crew` following `docs/team/PROTOCOL.md`; the crew follows
`docs/team/CREW.md`. Crew output is data: review every diff before it stays.
