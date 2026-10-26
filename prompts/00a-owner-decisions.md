# Prompt 00a — Owner decisions: faithful themes, five renames, cartridge versions

> Run in Claude Code from `E:\Projects\Atari-2600\32-in-one`, alone, AFTER 00 (done 2026-10-26).
> Recommended: Opus 5.5, effort high. Small, mechanical task: delegate the bulk to the crew
> (`pnpm crew`), you review, design the contract change and check the Den visually.

## 0. Read first

1. `CLAUDE.md` (rule 11 changed today), `docs/PLAN.md` §2 and §3 (owner decisions 2026-10-26),
   `AGENTS.md`, `docs/team/CREW.md`, `docs/adr/0002-*` (contract).
2. Summarise the hard rules in five lines as usual. You own `packages/kit` (only session).

## 1. What changed and why

The owner decided the games stay faithful to their originals: no softened reframes. Tanks shoot and
explode, outlaws use six-shooters, Air-Sea Battle shoots planes and ships, Boxing has knockouts,
crashes stay crashes, Blackjack uses chips and bets, Slot Machine is a slot machine with credits.
Chips and credits are play money inside the game only (no real money, nothing to buy, no ads).
Arcade presentation, no gore. Prompt 00's copy and rules still describe the old reframes.

## 2. Tasks

1. **Rules text.** Bring `AGENTS.md` rule 6 and `docs/team/CREW.md` rule 5 in line with
   `CLAUDE.md` rule 11 (same meaning, own words). Remove "paint", "water pistols", "soft landings",
   "no gambling mechanics" wording anywhere in docs, templates and ADRs. If `pnpm check` or any test
   has a content deny-list that would block weapons, explosions, bets, chips or credits in game
   code, remove those entries (keep trademark, raster, network and provenance checks).
2. **Five renames** (ids, folders, routes, manifests, labels, emblems, README via `pnpm docs:games`,
   CREDITS, PROGRESS, tests). Titles are still provisional; do not run a name check now.

   | Slot | Old id / title | New id | New title | New tagline (yours to improve, same meaning) |
   |---|---|---|---|---|
   | 2 | big-top-splash / Big Top Splash | big-top-cannon | Big Top Cannon | Aim the cannon, fly through the big top, land in the net. |
   | 10 | table-21 / Table 21 | (unchanged) | Table 21 | Chips, bets and the dealer's upcard. Hit, stand or double. |
   | 18 | skyline-gallery / Skyline Gallery | shore-battery | Shore Battery | Planes overhead, ships below, two gunners racing for the score. |
   | 20 | paint-tanks / Paint Tanks | tank-duel | Tank Duel | Tanks, jets and biplanes. Ricochets, cover and big explosions. |
   | 21 | reel-puzzle / Reel Puzzle | lucky-reels | Lucky Reels | Pick your paylines, place your bet, pull the lever. |
   | 24 | quickdraw-splash / Quickdraw Splash | quickdraw | Quickdraw | High noon on Main Street. Six shots, one winner. |

   Also review every other manifest's tagline/teaser and Hall copy for softened wording (foam
   darts, cartoon-only boxing, hay bales, "nobody gets hurt", "chips are just the score") and make
   it faithful. Old routes may simply stop working; no redirects needed (nothing is published).
   Labels and emblems for the renamed games get redrawn to fit the new titles (you draw them).
3. **Cartridge versions instead of hidden reskins** (ADR-0002 amendment, kit + Hall):
   - Replace the manifest's `secrets` idea with `versions: CartridgeVersion[]` (`id`, `label`,
     `cartridgeSlot`, `description`); a merged game declares two. Lane Hopper: `chicken` (slot 19,
     default) and `rabbit` (slot 11). Pier Derby: `derby` (slot 26, default) and `hack` (slot 15).
   - Per-game setting "Cartridge version" in the game's Settings and on its details overlay; the
     choice is passed to the game in `GameContext` and saved per game.
   - The Counter: lamps 31 and 32 represent the alternate versions; each lights the first time a
     game is finished with that version. Remove the locked "?" treatment; hover shows which version
     the lamp stands for. Update the About copy accordingly (the two near-duplicates are explained
     as versions you can choose).
   - Tests: version setting persists, reaches the game context (fake game declares two versions),
     Counter lamps light correctly; existing tests updated.
4. **Visual check.** Re-shoot the Den by day and by night at 1920×1080 and 1280×720 and the
   details overlay of Lane Hopper; confirm renamed labels read well; replace the files in
   `docs/media/screens/` (hero frames stay as approved).

## 3. Rules

Stay within the files these tasks need. No commits. `pnpm lint`, `typecheck`, `test`, `check`,
`build`, `e2e` green at the end. Log crew work in the ledger as usual.

## 4. When you finish

Report what changed (files grouped by area), the new contract fields, test results and the
ledger rows. Update `docs/PROGRESS.md` once.
