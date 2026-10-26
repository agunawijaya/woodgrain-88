---
id: den-docs
kind: docs
model: gemini-3.8-flash-high
fence:
  - docs/den-life.md
  - docs/guides/den-life-for-games.md
acceptance:
  - pnpm exec prettier --check docs/den-life.md docs/guides/den-life-for-games.md
  - node -e "const t = require('fs').readFileSync('docs/den-life.md', 'utf8'); for (const h of ['## Power Cycle of the day', '## Streaks and the calendar', '## Patches', '## The jacket', '## The difficulty switches', '## Channels', '## Power Cycle Run', '## Versus Night', '## The Neighbourhood Kids', '## The Counter', '## The Den grows', '## Settings', '## Controls', '## Your data']) if (!t.includes(h)) { console.error('missing ' + h); process.exit(1); }"
  - node -e "const t = require('fs').readFileSync('docs/guides/den-life-for-games.md', 'utf8'); for (const h of ['## Checklist', '## Channels', '## Difficulty switches', '## Patches', '## Micro-challenges', '## Emoji summary', '## Seats and the Kids', '## Versus', '## Worked example']) if (!t.includes(h)) { console.error('missing ' + h); process.exit(1); }"
reads:
  - CLAUDE.md
  - docs/adr/0008-den-life.md
  - docs/adr/0002-game-contract.md
  - packages/kit/src/contract.ts
  - packages/kit/src/channels.ts
  - packages/kit/src/patches.ts
  - packages/kit/src/patch-art.ts
  - packages/kit/src/micro.ts
  - packages/kit/src/run.ts
  - packages/kit/src/streak.ts
  - packages/kit/src/versus.ts
  - packages/kit/src/kids.ts
  - packages/kit/src/daily.ts
  - packages/kit/src/share.ts
  - hall/src/den/growth.ts
  - hall/src/data/cycle.ts
  - hall/tests/fixtures/fake-game.ts
  - hall/tests/fixtures/catch-game.ts
  - hall/tests/fixtures/turn-game.ts
---

## Goal

Two Markdown documents for Den Life, the collection-wide layer of Woodgrain '88:

1. `docs/den-life.md`, for players: every system explained plainly, with the patch tiers and the
   growth table.
2. `docs/guides/den-life-for-games.md`, for whoever writes a game prompt: exactly what each game
   must supply so Den Life works for it, with a worked example on the test fixtures.

Every fact must come from the files listed under `reads`. When a file and this order disagree,
follow the file and mention it in your report.

## Rules for the writing

- British English, plain and warm, short sentences. No hype, no exclamation marks, no emoji (except
  quoting the share line formats exactly as the code builds them).
- Never name an original game, publisher or console. Use our own game titles only (as in the
  manifests), and only when an example needs one.
- No pressure or guilt language. Streaks forgive; say so.
- Diagrams only as Mermaid code blocks (at most two per document).
- Keep each document under 1,800 words.

## docs/den-life.md: sections, in this order

1. `## Power Cycle of the day`
   - one game each day, the same for everyone, and its channel for the day;
   - the first finished run of that game each day counts for the daily score; later runs are
     practice;
   - the daily share line format, from `dailyShareLine`;
   - the name is added only when the player turns that setting on.
2. `## Streaks and the calendar`
   - a day counts when any run finishes, in any game or mode;
   - one automatic snow day per ISO week covers a single missed day; a second miss leaves an empty
     square and nothing else;
   - future days are never awarded;
   - the wall calendar page and the month view: flip back up to twelve months, PageUp and
     PageDown.
3. `## Patches`
   - the four tiers as a table: tier, shape, what it is for. Club is round, Pro a shield, Legend
     star-edged, Secret a hexagon whose goal is hidden behind a hint;
   - gold thread: earned with that seat's difficulty switch on A, and an earned patch turns gold
     when its goal is met again on A;
   - where patches show: the results screen stitches them in, the door jacket glints until you look;
   - a patch's details up close.
4. `## The jacket`: front and back; the drawer and its filters; drag and drop; snapping, swapping,
   turning in 15° steps, taking off; the keyboard path; undo and redo; Auto-arrange; export as an
   SVG card, with the name only when the player chooses.
5. `## The difficulty switches`: left for seat 1, right for seat 2, A hard and B easy; click, drag,
   `[` and `]`; they persist; each game says what A means in its details; the pause menu shows and
   flips them; a change mid-run may apply from the next round.
6. `## Channels`: every variation of the original program is open from the first play; Remix
   channels are earned with a patch; the TV dial (turn, strip, type the number and Enter, S for a
   surprise); "Game N on the cartridge".
7. `## Power Cycle Run`
   - five games, a 45-second goal in each;
   - the power switch flips by itself between rounds, each flip about 15% faster than the last;
   - scoring per round: 100 plus 10 a second left, 0 when missed;
   - the run share line format, from `runShareLine`;
   - free-run records (best ten) and the daily run (first of the day);
   - how to start: hold POWER or P for a second, or the top bar chip;
   - it opens when five games on the shelf have micro-challenges.
8. `## Versus Night`
   - two players, best of 3 or 5, the raffle draw;
   - a Neighbourhood Kid can take seat 2 in games with a bot seat;
   - the chalkboard, the crown, Rematch keeping the names;
   - rivalries by pair of names;
   - a drawn game is played again.
9. `## The Neighbourhood Kids`
   - a table of the six kids: name, style line, bio, from `KIDS`;
   - the Block Ladder order and what Block champion brings;
   - wins with the switch on A are shown apart.
10. `## The Counter`: lamps 1–30 light with a game's first patch; 31 and 32 with a finished run on
    the other cartridge version; all 32 ring the bell once and bring the plaque.
11. `## The Den grows`: the growth table from `growth.ts` (what earns it, what appears, where);
    "Show what the room has grown" hides it without forgetting.
12. `## Settings`: the four Den Life settings.
13. `## Controls`: one table for mouse and keyboard.
14. `## Your data`: everything stays in this browser; export and import; "Forget my data" clears
    Den Life too, growth included.

## docs/guides/den-life-for-games.md: sections, in this order

1. `## Checklist`: a short checklist of everything a game supplies (one line each, with the file
   where it lives: the manifest or the module).
2. `## Channels`: `ChannelDef` fields; originals for every variation, numbered in the original's
   order, `group` for games with many, `originalGame`; Remix channels with `unlockedBy`; the 64
   limit; ids stable forever.
3. `## Difficulty switches`: `manifest.difficulty` (`left`, optional `right`, `liveChange`, lines of
   1–60 characters); reading `ctx.difficulty.get()` and `onChange`; apply from the next round when
   `liveChange` is false.
4. `## Patches`
   - 3–5 per game (Club, Pro, Legend, one Secret with a hint);
   - `PatchDef` and goals on the game's own events;
   - titles of at most 28 characters;
   - thresholds published in the details;
   - the art comes from the label colours and the emblem, so the game draws nothing.
5. `## Micro-challenges`: `module.microChallenges` with `MicroChallengeDef` fields and limits;
   `run.micro` (goal and seconds); the Hall's clock and HUD; ending the run when time is up; set
   `supports.microChallenges`.
6. `## Emoji summary`: `GameResult.emoji`, at most 12, pictographs, keycaps, flags and coloured
   squares or circles only; checked by `emojiSummary`.
7. `## Seats and the Kids`
   - `ctx.seats` and `SeatInfo.kid`;
   - `aiSettings(kid, ranges)` with `DEFAULT_AI_RANGES`, and `errorRateForRound`;
   - a table of the nine personality parameters with what each should change in a game's AI;
   - Benny's `mirrorsPlayer`.
8. `## Versus`: `manifest.versus` ('local' or 'local+bot'); report `winnerSeat` (null for a draw);
   Versus Night picks games by it.
9. `## Worked example`: the fixtures. Show the channel, patch, micro-challenge and Kid mapping
   pieces of `catch-game.ts`, `fake-game.ts` and `turn-game.ts` as short excerpts (paraphrased
   signatures are fine; do not paste more than 15 lines from any one file).

## Report

List any fact where the files disagreed with this order, and anything you could not find.
