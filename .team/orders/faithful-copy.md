---
id: faithful-copy
kind: data
model: gemini-3.8-flash-high
fence:
  - hall/src/data/coming-soon/baseline.ts
  - hall/src/data/coming-soon/bumper-chase.ts
  - hall/src/data/coming-soon/chalk-talk.ts
  - hall/src/data/coming-soon/crown-jump.ts
  - hall/src/data/coming-soon/disc-duel.ts
  - hall/src/data/coming-soon/drop-zone.ts
  - hall/src/data/coming-soon/glove-box.ts
  - hall/src/data/coming-soon/gravity-duel.ts
  - hall/src/data/coming-soon/hoop-duel.ts
  - hall/src/data/coming-soon/hot-and-cold.ts
  - hall/src/data/coming-soon/hover-blast.ts
  - hall/src/data/coming-soon/lane-ten.ts
  - hall/src/data/coming-soon/lasso-run.ts
  - hall/src/data/coming-soon/pocket-links.ts
  - hall/src/data/coming-soon/putt-parlor.ts
  - hall/src/data/coming-soon/quad-cube.ts
  - hall/src/data/coming-soon/sandlot-slugger.ts
  - hall/src/data/coming-soon/saucer-patrol.ts
  - hall/src/data/coming-soon/slalom-line.ts
  - hall/src/data/coming-soon/sum-rush.ts
  - hall/src/data/coming-soon/swarm-garden.ts
  - hall/src/data/coming-soon/trailblaze.ts
acceptance:
  - pnpm exec tsc -p hall/tsconfig.json
  - pnpm exec vitest run --project hall
  - pnpm exec eslint hall/src/data/coming-soon/baseline.ts hall/src/data/coming-soon/bumper-chase.ts hall/src/data/coming-soon/chalk-talk.ts hall/src/data/coming-soon/crown-jump.ts hall/src/data/coming-soon/disc-duel.ts hall/src/data/coming-soon/drop-zone.ts hall/src/data/coming-soon/glove-box.ts hall/src/data/coming-soon/gravity-duel.ts hall/src/data/coming-soon/hoop-duel.ts hall/src/data/coming-soon/hot-and-cold.ts hall/src/data/coming-soon/hover-blast.ts hall/src/data/coming-soon/lane-ten.ts hall/src/data/coming-soon/lasso-run.ts hall/src/data/coming-soon/pocket-links.ts hall/src/data/coming-soon/putt-parlor.ts hall/src/data/coming-soon/quad-cube.ts hall/src/data/coming-soon/sandlot-slugger.ts hall/src/data/coming-soon/saucer-patrol.ts hall/src/data/coming-soon/slalom-line.ts hall/src/data/coming-soon/sum-rush.ts hall/src/data/coming-soon/swarm-garden.ts hall/src/data/coming-soon/trailblaze.ts
  - pnpm exec prettier --check hall/src/data/coming-soon/baseline.ts hall/src/data/coming-soon/bumper-chase.ts hall/src/data/coming-soon/chalk-talk.ts hall/src/data/coming-soon/crown-jump.ts hall/src/data/coming-soon/disc-duel.ts hall/src/data/coming-soon/drop-zone.ts hall/src/data/coming-soon/glove-box.ts hall/src/data/coming-soon/gravity-duel.ts hall/src/data/coming-soon/hoop-duel.ts hall/src/data/coming-soon/hot-and-cold.ts hall/src/data/coming-soon/hover-blast.ts hall/src/data/coming-soon/lane-ten.ts hall/src/data/coming-soon/lasso-run.ts hall/src/data/coming-soon/pocket-links.ts hall/src/data/coming-soon/putt-parlor.ts hall/src/data/coming-soon/quad-cube.ts hall/src/data/coming-soon/sandlot-slugger.ts hall/src/data/coming-soon/saucer-patrol.ts hall/src/data/coming-soon/slalom-line.ts hall/src/data/coming-soon/sum-rush.ts hall/src/data/coming-soon/swarm-garden.ts hall/src/data/coming-soon/trailblaze.ts
reads:
  - CLAUDE.md
  - docs/PLAN.md
  - packages/kit/src/contract.ts
  - hall/src/data/coming-soon/tank-duel.ts
  - hall/src/data/coming-soon/quickdraw.ts
  - hall/src/data/coming-soon/table-21.ts
---

## Goal

Make the player-facing copy of these 22 coming-soon manifests faithful to each original game. The
owner decided on 2026-10-26 that no game is softened any more (CLAUDE.md rule 11, PLAN §3).
Copy that still describes a gentler reframe gets rewritten; copy that is already faithful stays
exactly as it is.

## Context

Rule 11, in short: keep each game's real theme and mechanics. Tanks and planes shoot and explode,
outlaws use six-shooters, boxers box with knockouts, crashes stay crashes, missiles are missiles.
Chips and credits are play money inside the game. Presentation is arcade-style, with no gore and no
cruelty played for its own sake.

The old copy came from a rule that has now been dropped ("nobody gets hurt": paint instead of
shells, water pistols, foam darts, hay bales, cartoon-only boxing). PLAN §2's table has the
faithful one-line idea for every game: use it as the source of truth for each game's theme.

These copy lines are already known to need a rewrite:

- `bumper-chase.ts`: "soft foam darts" and "foam darts" become missiles (PLAN: maze-car duel with
  missiles).
- `glove-box.ts`: "Cartoon boxing ... Bells, not bruises" and "nobody ever hits the canvas" become
  real boxing scored on clean punches, knockouts included.
- `drop-zone.ts`: "drop into a soft hay bale" becomes a crash landing (PLAN: crash-landings and all).
- `lasso-run.ts`: "loop each calf gently home" becomes roping the herd before it escapes.

Read the other 18 as well and fix any line that softens its original in the same way. Leave alone
any wording that only describes our own design (for example "obstacles we built ourselves", or
"clues that paint the board", where "paint" means colouring the board).

The six manifests under `reads` (tank-duel, quickdraw, table-21) were rewritten by the lead today.
They show the tone wanted: concrete, faithful, a little playful, never coy.

## Behaviour and edge cases

1. Change only `tagline`, `teaser` and the `description` strings of `channels`, and only where the
   current text softens the original. Do not touch any other field: no ids, slots, colours, labels,
   emblems, `inspiredBy`, controls or events.
2. `tagline`: one line, 1–80 characters. `teaser`: two or three sentences, at most 320 characters.
   Count the characters.
3. Our own words. Never mention an original title, a publisher or the console in these strings, and
   no brand, league, team or real-person names.
4. No gore, no blood, no cruelty played for its own sake. Arcade energy is welcome.
5. British spelling, as in the rest of the copy. Keep each file's existing quote style and
   formatting so Prettier stays clean.
6. In your report, list every file you changed with the old and new line, and name each of the 22
   files you checked and left alone.

## Out of scope

Any file outside the fence. In particular, the six manifests listed under `reads` and the Lane
Hopper and Pier Derby manifests: the lead is changing them in parallel.
