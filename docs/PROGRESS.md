# Progress

Updated once at the end of each prompt. Last update: prompt 04 (Trailblaze), 2026-10-29.

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

## Tank Duel (prompt 02)

| Part | Status |
|---|---|
| `packages/arena` (stage, light rigs, post, particles, ribbons, ground paint, effects, shake, framing) | done; ADR-0009; three.js kept out of the Hall's entry (checked in `pnpm check`) |
| Engine: the 27 original channels and 4 Remix, every 1977 rule and hook, a shell flight cap | done; pure and fixed-step |
| Our arenas (Open Field, Sandbag Line, Old Quarter, Bumper Yard) and cloud skies | done; validated for symmetry, enclosure, reachability and spawn safety |
| The Neighbourhood Kids as commanders and pilots | done; fair by construction, human-paced settle; every Kid scores on a still tank on every tank channel |
| Balance targets | Lou v Pip 84%, novice v Pip 47%, no 0–0 rounds: met. Dee v Moss 60.5%: at the top edge. Score band 10–35 (raised by the owner from 6–20) in 88% of rounds against 90%: short. See NOTES.md |
| Diorama (tanks, biplanes, bomber, jets), HUD, day and night | done; hero frames approved by the owner; ADR-0010 |
| Menu, pre-match, results with replay, records, settings, tutorial (six lessons) | done |
| Modes: Vs a Kid, Versus, Practice; daily, challenge links, micro-challenges, Versus Night | done |
| Sound (synthesised one-shots and held engine hums) | done; kit `hold()` added |
| Hall integration (registry, lazy chunk, opponent in results, Den TV demo) | done; the demo holds a still picture under reduced motion or software drawing |
| Hall fixes found on the way | Details opens the overlay for a playable game (`#/details/<id>`); the Den keeps its channel when you come back; the first key reaches a game; stopped loops are let go (memory no longer grows a match at a time); calendar's spoken name carries what it prints |
| Performance | 60 fps at 1920 × 1080 on seven channels by day and night; memory flat over ten minutes on the menu (45–46 MB); Hall entry 377 kB (gzip 122), game chunk 825 kB (gzip 225), loaded on demand |
| Tests | 32 bridge; 185 kit, 110 Hall, 3 scripts, 58 arena, 261 Tank Duel (Vitest; 6 balance checks opt-in); 59 Hall Playwright, 11 Tank Duel flows, 32 screenshot runs |

## Trailblaze (prompt 04)

| Part | Status |
|---|---|
| Engine: the 14 cartridge variations, every 1977 rule and quirk, Remix rules (Fading, Shrinking, Boost Lanes), Four Way | done; pure and fixed-step; the scripted filler lays 616 of 684 open cells |
| Computer 1977 | done; faithful to the program, including steering right when boxed in |
| Kit `kids/reflex` (human reflexes) and `sticks` (eight-way keys) | done; ADR-0012; Hot & Cold moved onto the kit's sticks |
| Kid riders, Ghost Trails memory | done; foreseen moves timed, surprises reacted to, a reaction's worth of open road |
| Balance targets | Lou v Pip 84% (v3 65%), Moss v Dee 70% (Dee +11 at speed): met and locked. Moss v Computer 1977 95–100% against 60–80%: missed, kept faithful (NOTES.md) |
| Four looks (Neon Grid, Toy Trains, Mummy's Wrap, Ice Trail), light and dark, Chase camera, Remix pieces | done; hero frames approved by the owner (two review rounds); ADR-0013 |
| Menu, pre-match, HUD, results with "How Rosa saw it", tutorial, records, Doodle gallery, settings | done |
| Modes: vs a Kid, Versus, vs Computer 1977, Doodle (SVG export), Four Way; daily, challenge links, micro-challenges | done |
| Sound (four synthesised palettes, held hums that climb with the speed-up) | done |
| Hall integration (registry, lazy chunk, Den TV demo) | done; Hall entry 386 kB (gzip 124), game chunk 207 kB (gzip 65) plus the shared three.js chunk |
| Performance | 60 fps at 1920 × 1080 with every cell laid, all looks, day and night (RTX 4060 laptop); 15–24 fps on the same laptop's integrated GPU, limited by the stage, not the trails |
| Open | The picture runs about one cell behind the rules (feel pass idea in NOTES.md); the Den has no Kid memory setting yet, so Kids ride as Human; neon start chevrons show for an unused seat in solo Doodle |
| Tests | 207 Trailblaze, 239 kit, 110 Hall (Vitest; balance and 100k fuzz opt-in); 10 Trailblaze flows, 16 screenshot runs (96 pictures) |

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
| 08 | Trailblaze | Duels | 2 | playable | The original never tests the two players against each other; four looks, Kids with human reflexes |
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
| 20 | Tank Duel | Duels | 1 | playable | Pilot wave; renamed in 00a. Balance notes in the game's NOTES.md |
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
