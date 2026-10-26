# Progress

Updated once at the end of each prompt. Last update: prompt 01 (Den Life), 2026-10-26.

## Foundation (prompt 00)

| Part | Status |
|---|---|
| Crew bridge (`tools/crew/`), protocol, ledger | done; 32 bridge tests; 39 orders accepted |
| Behaviour dossiers (`research/`, unpublished) | 31 of 31 written and lead-checked (Swarm Garden's partly: one open interpretation) |
| `packages/kit` | done; 117 unit tests |
| Game contract, registry of 30, fake test game | done; fake game only in `hall/harness.html` |
| The Den by day and night, list view, intro, details, records, about, settings | done; hero frames approved by the owner |
| Pause and results (navigation standard) | done; proven end to end with the fake game |
| Docs, ADRs 0001–0007, licences, CI and Pages workflows | done; workflows written, not run |

## Owner decisions (prompt 00a)

| Part | Status |
|---|---|
| Faithful themes (CLAUDE.md rule 11) in AGENTS, CREW, templates and every manifest | done; no content deny-list existed to remove |
| Five renames: Big Top Cannon, Shore Battery, Tank Duel, Lucky Reels, Quickdraw | done; new labels and emblems; Table 21 copy rewritten |
| Cartridge versions instead of hidden reskins (ADR-0002 amendment) | done; kit contract, progress schema v2, picker on details and in-game settings, Counter places 31–32 |
| Tests | 32 bridge, 125 kit, 22 Hall, 3 scripts (Vitest); 34 Playwright |

## Den Life (prompt 01)

| Part | Status |
|---|---|
| Kit: streak, versus, run, kids, patch-art, channel kinds, daily channel, emoji summary; store v3 | done; ADR-0008 and the ADR-0002 amendment |
| Difficulty switches per seat (A hard, B easy), gold thread on A | done; Den console, `[` and `]`, pause menu, details lines |
| The Den grows (posters, trophies, chain, lights, ON AIR, ribbon, beanbag, plaque, remote) | done; hide in Settings; "Forget my data" clears it |
| Calendar month view, corkboard, chalkboard, door jacket, Counter celebration | done |
| Jacket screen (drag and drop, keyboard, undo, Auto-arrange, export card), patch up close | done |
| Kids screen and the Block Ladder; Block champion patch | done |
| Versus Night (setup, raffle, series, crown, rematch, rivalries) | done; a Kid can take seat 2 |
| Power Cycle Run (hold POWER or P, automatic flips, goal card, rounds, results, records) | done; opens with five games that have micro-challenges |
| Channel dial (knob, strip, number pad, surprise) on details and game menus | done |
| Records, Settings, results (stitched patches, lamps lit, daily share line) | done |
| Dev showcase (`?showcase=` full, mid or new) and fixtures | done; both kept out of the build (checked) |
| Hero frames | approved by the owner after two review rounds |
| Tests | 32 bridge; 182 kit, 105 Hall, 3 scripts (Vitest); 59 Playwright |

## Games

Status values: **coming soon** (manifest, label, slate and details in the Hall; no game yet) ·
**in progress** · **playable** · **polished**.

| Slot | Game | Family | Wave | Status | Notes |
|---|---|---|---|---|---|
| 01 | Saucer Patrol | Arcade | 6 | coming soon | |
| 02 | Big Top Cannon | Arcade | 4 | coming soon | Renamed in 00a |
| 03 | Sum Rush | Brain | 10 | coming soon | Label band darkened to meet AA |
| 04 | Quad Cube | Brain | 3 | coming soon | Nine variations in the original |
| 05 | Hot & Cold | Brain | 1 | coming soon | Pilot wave |
| 06 | Disc Duel | Brain | 3 | coming soon | Hidden board editor in the original |
| 07 | Pocket Links | Sports | 5 | coming soon | |
| 08 | Trailblaze | Duels | 2 | coming soon | The original never tests the two players against each other |
| 09 | Crown Jump | Brain | 3 | coming soon | |
| 10 | Table 21 | Brain | 10 | coming soon | Chips and bets as play money; optional coach |
| 11 | Lane Hopper | Arcade | 4 | coming soon | Versions: chicken (default, program 19), rabbit (program 11, Counter place 31) |
| 12 | Putt Parlor | Sports | 5 | coming soon | |
| 13 | Chalk Talk | Sports | 9 | coming soon | |
| 14 | Bumper Chase | Duels | 10 | coming soon | |
| 15 | Pier Derby | Sports | 8 | coming soon | Versions: derby (default, program 26), hack (program 15, Counter place 32) |
| 16 | Gravity Duel | Duels | 2 | coming soon | |
| 17 | Glove Box | Duels | 7 | coming soon | |
| 18 | Shore Battery | Arcade | 6 | coming soon | Renamed in 00a |
| 19 | Baseline | Sports | 7 | coming soon | |
| 20 | Tank Duel | Duels | 1 | coming soon | Pilot wave; renamed in 00a |
| 21 | Lucky Reels | Brain | 10 | coming soon | A real slot machine with credits, play money only; renamed in 00a |
| 22 | Slalom Line | Sports | 9 | coming soon | Random courses in two variations of the original |
| 23 | Lasso Run | Arcade | 8 | coming soon | |
| 24 | Quickdraw | Duels | 2 | coming soon | Renamed in 00a |
| 25 | Drop Zone | Arcade | 4 | coming soon | |
| 26 | Hover Blast | Arcade | 6 | coming soon | Label band darkened to meet AA |
| 27 | Hoop Duel | Sports | 7 | coming soon | |
| 28 | Swarm Garden | Arcade | 8 | coming soon | Dossier partly checked |
| 29 | Lane Ten | Sports | 5 | coming soon | |
| 30 | Sandlot Slugger | Sports | 9 | coming soon | |
