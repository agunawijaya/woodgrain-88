# Progress

Updated once at the end of each prompt. Last update: prompt 05 (Gravity Duel), 2026-10-30.

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

## Trailblaze (prompts 04 and 04a)

| Part | Status |
|---|---|
| Engine: the 14 cartridge variations, every 1977 rule and quirk, Remix rules (Fading, Shrinking, Boost Lanes), Four Way | done; pure and fixed-step; the scripted filler lays 616 of 684 open cells |
| Computer 1977 | done; faithful to the program, including steering right when boxed in |
| Kit `kids/reflex` (human reflexes) and `sticks` (eight-way keys) | done; ADR-0012; Hot & Cold moved onto the kit's sticks |
| Kid riders, Ghost Trails memory | done; foreseen moves timed, surprises reacted to, a reaction's worth of open road |
| Balance targets | Lou v Pip 84% (v3 65%), Moss v Dee 70% (Dee +11 at speed): met and locked. Moss v Computer 1977 95–100% against 60–80%: missed, kept faithful (NOTES.md) |
| Four looks (Neon Grid, Toy Trains, Mummy's Wrap, Ice Trail), light and dark, Chase camera, Remix pieces | done; ADR-0013. 04a: riders drawn at a readable size (Neon's a three-cell motorbike that banks into turns), a camera push toward every crash, the Mummy crash a cocoon wound from the feet up, dyed and woven linen; hero frames approved by the owner (third set) |
| Feel and screens (04a) | done: the picture is never more than one cell behind the rules (0.46 cell on average, was 0.94; a queued turn shows from the next frame); each look's riders up close on the pre-match cards and in the menu's Riders card; results show cells laid and traps sprung per rider; solo Doodle marks only its own start |
| Menu, pre-match, HUD, results with "How Rosa saw it", tutorial, records, Doodle gallery, settings | done |
| Modes: vs a Kid, Versus, vs Computer 1977, Doodle (SVG export), Four Way; daily, challenge links, micro-challenges | done |
| Sound (four synthesised palettes, held hums that climb with the speed-up) | done |
| Hall integration (registry, lazy chunk, Den TV demo) | done; Hall entry 386 kB (gzip 124), game chunk 207 kB (gzip 65) plus the shared three.js chunk |
| Performance | 60 fps at 1920 × 1080 with every cell laid, all looks, day and night (RTX 4060 laptop; re-measured after 04a); 15–24 fps on the same laptop's integrated GPU, limited by the stage, not the trails |
| Open | By day, Neon's crash shards and Ice's frozen skater want more contrast on the pale floors (hero NOTES) |
| Tests | 224 Trailblaze (Vitest; balance and 100k fuzz opt-in), including the glide's one-cell limit; 11 Trailblaze flows, 16 screenshot runs (96 pictures) |

## Hot & Cold (prompts 03 and 03a)

| Part | Status |
|---|---|
| Engine: the ten cartridge variations to the tick, the flag checked first, bouncing and wrapping flags; Remix (Two Flags, Minefield, Thin Ice, Drift Storm) | done; pure and fixed-step |
| Solver and possibility fog | done; the exact solver never loses the flag in 100,000 fields per motion |
| The Neighbourhood Kids with human memory (kit `kids/memory`, ADR-0011) | done; "What Lou remembered" after a match |
| Balance targets | Lou v Pip 85.1% (75–90), Moss v Dee 61.6% (50–70), perfect hunter median 4 checks (4–8), Lou within perfect + 2: met and locked (7 opt-in checks pass) |
| Three looks (Polar Expedition, Tabletop Board, Radar Room), light and dark | done; ADR-0014; the look switches live from the pause menu. 03a critique: the Polar day blast no longer whites out the explorer, the Radar static is round and lies under the blip, the Tabletop pennant reads from above |
| Feel | a step is drawn within the 7-tick settle time, so the explorer stands on its square the moment a check is allowed |
| Menu, pre-match, HUD, results, records, settings, tutorial | done |
| Modes: vs a Kid, Versus, Alone; daily, challenge links, micro-challenges, Versus Night | done |
| Sound (three synthesised palettes, one cue per meaning) | done |
| Hall integration (registry, lazy chunk, channel groups Race / Turns / Solo / Remix, Look and Clues pause items) | done; Hall entry 397 kB (gzip 128), game chunk 186 kB (gzip 63), three.js kept out of the entry |
| The Den's Kid setting, Human / Sharp (03a) | done: kit (settings schema v3, `kids()`, `withKidsMark`), the Den's settings, records and share lines marked "Sharp Kids", Hot & Cold and Trailblaze; Tank Duel's Kids use neither memory nor reflexes (noted in its NOTES) |
| Performance | 60 fps at 1920 × 1080 in all three looks by day and night (frame p95 16.8 ms, CPU at most 4 ms at p95) |
| Open | Variation 4's marathon (warn before it?); turns between unequal Kids are one-sided (NOTES.md) |
| Tests | 122 Hot & Cold, 247 kit, 110 Hall (Vitest; balance opt-in); 14 Hot & Cold flows, 1 Trailblaze Kid flow, 12 screenshot runs (60 pictures) |

## Gravity Duel (prompt 05)

| Part | Status |
|---|---|
| DeepSeek joins the crew (OpenCode CLI, members `deepseek-pro` and `deepseek-flash`) | done; ADR-0015; the runner accepts only DeepSeek models and never passes `--auto`; a clean finish is no longer misread as a quota stop |
| Engine: the 17 cartridge variations (7 duels, 6 docking races, 4 solo docking), every verified rule, Remix (Binary Stars, Comet, Asteroid Belt, Last Fuel) | done; pure, fixed-step, whole numbers; the speed fold, the 128-tick missile life, the cloak that skips every touch; all 12 hooks confirmed by an independent DeepSeek Pro read |
| Kit `kids/aim` (lead share and overshoot) | done; ADR-0017 |
| Kid pilots: the real physics run forward on the Kid's slightly wrong idea of the target, reflexes, memory of the bars, aim | done; "How Rosa flew it" after a match |
| Balance targets | Lou v Pip 87.7% (75–90), Moss v Dee 68.3% (55–70), Dee's star crashes 2.22× Moss's (≥ 2), Lou's docks 1.65× Pip's (≥ 1.5), the perfect docker 20/20 on switches B and A: met and locked (300 matches, seed 23) |
| Four looks (Deep Space, Brass Orrery, Paper Sky, Whirlpool), light and dark, Follow camera, hit nudge, the trajectory guide | done; ADR-0016; hero frames approved by the owner; three critique rounds on the real screens |
| Menu, pre-match, HUD, results, tutorial (seven lessons on the real engine), records, settings | done, to Trailblaze's standard; the tutorial's lessons were made reachable at 60 Hz and its taps counted |
| Modes: vs a Kid, Versus, docking race, solo docking, Remix; daily, challenge links, four micro-challenges, eight patches (two secret) | done |
| Sound (four synthesised palettes; the two engines a fourth apart) | done |
| Hall integration (registry, lazy chunk, Den TV demo) | done; Hall entry 341 kB (gzip 109), game chunk 198 kB (gzip 63) plus the shared three.js chunk |
| Performance | 26–38 fps at 1920 × 1080 in every look, day and night, measured in headless Playwright Chromium, where Trailblaze gives 27–40; not yet measured in a desktop browser |
| Open | Challenge links carry no opponent (the kit's `Challenge` has none; the Hall seats the Kid); the tutorial has no unit test (its e2e flow covers every lesson) |
| Tests | 261 Gravity Duel (Vitest, including all 17 variations flown by Kids), 75 bridge; 16 Gravity Duel flows, 16 screenshot runs (96 pictures) |

## Games

Status values: **coming soon** (manifest, label, slate and details in the Hall; no game yet) ·
**in progress** · **playable** · **polished**.

| Slot | Game | Family | Wave | Status | Notes |
|---|---|---|---|---|---|
| 01 | Saucer Patrol | Arcade | 6 | coming soon | |
| 02 | Big Top Cannon | Arcade | 4 | coming soon | Renamed in 00a |
| 03 | Sum Rush | Brain | 10 | coming soon | Label band darkened to meet AA |
| 04 | Quad Cube | Brain | 3 | coming soon | Nine variations in the original |
| 05 | Hot & Cold | Brain | 1 | playable | Pilot wave |
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
| 16 | Gravity Duel | Duels | 2 | playable | DeepSeek joined the crew for its engine; four looks, Kids that forecast the real physics |
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
