# Prompt 04 — Trailblaze (inspired by "Surround", Atari, 1977; cartridge slot 8)

> Run in Claude Code from `E:\Projects\Atari-2600\32-in-one`, AFTER prompt 03 has finished and the
> owner (or the architect) has committed it.
> Runs alone: it extends `packages/kit` (human-like Kid reflexes) and is the kit owner.
> Recommended: Opus 5.5, effort **xhigh**. Stages in §10.
> **Owner checkpoint:** stage 1 ends with hero frames of all four looks; STOP and wait.
> You lead a Gemini crew via `pnpm crew`; run `pnpm crew ping` first.

## 0. Read first

1. `CLAUDE.md`, `AGENTS.md`, `.claude/skills/retro-reborn-builder/SKILL.md`,
   `docs/guides/den-life-for-games.md`, ADRs (0002 and amendments, 0008 Den Life, 0009 arena,
   0010 Tank Duel, and the Hot & Cold ADRs on Kid memory and looks), the kit API (`kids.ts`,
   `kids/memory.ts`), `docs/templates/`.
   First reply: hard rules in five lines, this prompt, "kit owner: me", ports (game dev 4522,
   Playwright 5522; Hall 4488), `crew ping` result.
2. **Siblings to study:** `games/tank-duel/` (real-time duel on `packages/arena`, two seats, Kids
   as seats) and `games/hot-and-cold/` (several looks behind one engine, Kid memory panel). Never
   import from them; reuse `packages/arena` and the kit. If something both games need is still
   private to one of them, lift it into `packages/arena` or the kit (you are the kit owner).
3. **Reference (read-only):** `research/dossiers/08-trailblaze.md` (verified behaviour) and
   `src/08_*.asm` when you must check something. Our own words in NOTES.md.
4. This whole prompt; §14 overrides earlier sections.

Trademark: `inspiredBy.originalTitle` "Surround", `uiTitle` "the 1977 trail duel".

Code style: write it like a careful person would: clear names, short functions, comments that
explain *why*, no generated-looking boilerplate.

## 1. The pitch

Two riders who can never stop. Every cell you cross becomes a wall behind you. Steer, cut your
rival off, box them into a dead end, and keep enough room for yourself. Whoever crashes first, into
the arena, the rival's trail or their own, gives the other a point. First to 10. It is the 1977
ancestor of every light-bike duel and every snake game, and it now comes in four worlds: neon
bikes, toy trains, a mummy's endless bandage, and a skater who freezes the air into ice.

- **Tagline:** "Never stop. Never cross a line."
- **Teaser:** "A two-player trail duel from 1977: leave a wall wherever you go, trap your rival,
  survive the squeeze. Race a friend or a Neighbourhood Kid on neon bikes, toy trains, a mummy's
  bandage or a wall of ice."
- Family duels · 1–2 players (versus local + Kid bots; 4 riders in one Remix) · session 2–6 min.

## 2. What the original does (verify; record in NOTES.md)

The dossier is the behavioural spec. Key points:

- Board of 40 × 20 cells. Left rider starts at column 10, row 10, heading right; right rider at
  column 30, row 10, heading left. Movement is continuous, one cell per step; steering changes the
  heading only.
- Crashing into the border, any trail or your own trail scores a point for the other rider. Both
  crash on the same step: both score (a 10–10 tie is possible). First to 10 wins.
- After a crash: a pause of about 4.5 s with crash animation and sound, then the board clears and
  both restart from the start positions.
- 14 variations:
  - two players, or one human against the cartridge's computer (variations 2 and 4: computer on
    the left, human on the right stick);
  - constant speed, or speed-up: every 5.12 s the step period drops 15 → 12 → 9 → 6 → 3 frames
    (≈3.3 → 16.7 cells/s) and the step tone rises;
  - bordered arena (1–7) or wraparound edges (8–14);
  - 4-way or 8-way (diagonal) steering;
  - fire leaves gaps in your trail (7 and 12);
  - free-draw, unscored (13 and 14): the trails are a drawing and fire erases.
  Map every variation exactly from the dossier table into channel definitions.
- Difficulty switches: the left switch sets the computer's lookahead (B = 3 cells, A = 6 cells);
  each player's switch sets 180° reversal protection (B: reversing is ignored; A: reversing is
  allowed, straight into your own trail).
- The computer opponent: four rays of lookahead with a tie-break that alternates every 1.28 s,
  which produces its stair-step path in open space.
- Hooks to verify and keep faithfully (each one as an engine test):
  - the uncapped lookahead bug that momentarily gives the computer a full-row or full-column view;
  - reversal protection that fails when moving diagonally;
  - the right rider's crash pause 0.32 s shorter than the left's (a reused start value);
  - riders pass through each other head-on (there is no rider-to-rider collision check);
  - the winning 10th point skips the crash animation and sound;
  - the attract-mode timeout (~21 min 51 s) and the unused RAM byte go in ABOUT.md only.

## 3. Game design

### 3.1 Modes

| Mode | What it is |
|---|---|
| **Duel** | The scored variations, two humans (split keyboard / pads) or human vs opponent |
| **Doodle** | Variations 13–14: free drawing with trails, fire erases; export the drawing |
| **Daily** | One seeded match for everyone (Power Cycle of the day): beat the day's Kid, fewest points conceded |
| **Challenge link**, **Micro-challenges** | Kit standard |

Opponents: a second human, a Neighbourhood Kid (§3.3), or **"Computer 1977"**: the cartridge's own
four-ray AI rebuilt from the dossier, stair steps and lookahead bug included, labelled as the
original. In variations 2 and 4 the default opponent is Computer 1977 on the left, as on the
cartridge; any opponent can be chosen in every scored variation.

### 3.2 Settings (per game, all in the game's Settings panel)

- **Look:** *Neon Grid* (default), *Toy Trains*, *Mummy's Wrap*, *Ice Trail* (§6). Presentation
  only: the grid, timing, rules and sound-cue meanings are identical. Saved per player.
- **Match length:** *Cartridge* (first to 10) or *Short* (first to 5).
- **Speed-up preview** (shows the five speed steps), colour-blind-safe rider colours (shape and
  pattern also identify riders), reduced effects, camera (*Overhead* / *Chase* in 3D looks; the
  overhead camera is default and used in Daily and records).

### 3.3 Human-like Kids for a reflex game (kit addition)

The owner's rule from Hot & Cold applies: Kids must have human limits, never perfect play. In a
real-time game the limits are not mainly memory but perception and reflexes. Build
`packages/kit/src/kids/reflex.ts` (generic: Tank Duel, Bumper Chase, Disc Duel and the sports games
can adopt it later; document it in the game author's guide):

- `ReflexProfile`: **reaction time** (mean and spread, ms, from noticing to steering), **lookahead**
  (cells the Kid reads ahead along its heading), **awareness radius** (how far around itself it
  takes trails into account; beyond it, only big open areas), **attention** (chance per decision of
  noticing the rival's latest turn), **panic** (extra error and reaction lag that grows with speed
  and with how cramped the space is), **slip rate** (chance of a late or wrong turn), **planning
  style** (a weight set for space-claiming, cutting off, safety, mirroring).
- `KidReflex` turns a perceived snapshot into delayed, possibly imperfect inputs through a seeded
  rng (deterministic in tests), with an inspectable log (what it saw, what it missed, when it
  reacted, which slips happened).
- Kids see only what a player sees on screen; in wraparound arenas they "see across" edges only as
  well as their awareness allows.
- Use `kids/memory` for what the Kid cannot see right now: the **Ghost Trails** Remix (§3.5) hides
  trails after 3 s, and the Kid must remember where they were, with the same per-Kid memory values
  as Hot & Cold.
- Defaults (tune by simulation; record final values in NOTES.md and the kids docs):

| Kid | Reaction | Lookahead | Awareness | Panic | Style |
|---|---|---|---|---|---|
| Grandpa Lou | 330 ± 40 ms | 9 | wide | low | Reads space beautifully, turns late |
| Moss | 260 ± 40 ms | 6 | wide | low | Claims territory, plays safe |
| Rosa | 220 ± 50 ms | 5 | medium | medium | Hunts you: cuts across your path |
| Benny | 240 ± 50 ms | 5 | medium | medium | Mirrors your turns a beat later |
| Dee | 180 ± 60 ms | 3 | narrow | high | Fast hands, boxes herself in |
| Pip | 280 ± 120 ms | 3 | narrow | high | Wanders, now and then a brilliant trap |

- The Den's Kid memory setting (*Human* / *Sharp*) also covers reflexes: *Sharp* removes slips and
  halves reaction time, labelled as harder; records note which was used.
- Results panel "How Rosa saw it": a small replay strip of the last seconds before the crash with
  the Kid's view cone, a missed turn or a slip marked. Collapsible.

Balance targets (seeded simulations, crew; lock as tests with tolerances):
variation 1 (constant speed), first to 10: Lou beats Pip 75–90%; Moss vs Dee 55–70% for Moss.
Variation 3 (speed-up): Dee's win rate against Moss rises at least 8 points compared with constant
speed (fast hands matter more), Lou's falls. Computer 1977 with switch B loses to Moss 60–80%.
A scripted space-filling bot must survive alone for at least 90% of the 800 cells in a bordered
arena (validates the engine's step and collision rules).

### 3.4 Variations and channels

All 14 original variations are open channels, grouped *Bordered* / *Wraparound* / *Doodle*, with
the cartridge number shown. Every channel shows its four facts as icons: speed (constant / speed-up),
edges, 4-way / 8-way, gaps.

### 3.5 Remix channels (opened by patches)

| Remix | Rule |
|---|---|
| **Fading Trails** | Trails vanish 8 s after they are laid |
| **Ghost Trails** | Trails become invisible after 3 s but stay solid: play from memory (Kids use `kids/memory`) |
| **Shrinking Arena** | The border moves in one cell every 6 s |
| **Boost Lanes** | Glowing lanes on the floor double your speed while you ride them |
| **Four Way** | Four riders, one per corner; any mix of up to two humans and Kids; last rider standing scores |

### 3.6 Patches

| Tier | Patch | Goal |
|---|---|---|
| Club | First Wall | Win a match against anyone |
| Club | Long Ride | Survive 60 s in one point on a speed-up variation |
| Pro | Boxed In | Win a point by trapping a rival in a pocket of 10 cells or fewer (opens Fading Trails) |
| Pro | Clean Sweep | Win 10–0 against any Kid (opens Shrinking Arena) |
| Pro | Old Machine | Beat Computer 1977 with its switch on A (opens Boost Lanes) |
| Legend | Faster Than Lou | Beat Grandpa Lou in an 8-way speed-up variation with your switch on A (opens Four Way and Ghost Trails) |
| Secret | Ghost Rider | Win a point within one second after passing straight through your rival (the cartridge's missing collision check) |
| Secret | Fine Art | Export a Doodle that fills at least half the board |

### 3.7 Micro-challenges and share

Micro (45 s): "Survive 30 s at top speed", "Trap Dee once", "Fill 300 cells alone", "Win a point in
wraparound". Share: one symbol per point (🟦 you, 🟥 rival, ⬜ both), then the score:
`Woodgrain '88 #15 · Trailblaze · 🟦🟦🟥⬜🟦 · 10–6`.

## 4. Interaction

- Seat 1: WASD (Q/E/Z/C diagonals in 8-way) + Space (gap / erase). Seat 2: arrows (numpad
  diagonals) + Enter. Gamepads: stick/d-pad + A. Input is buffered one step so a quick tap between
  two steps is never lost.
- Turns take effect on the next step, exactly as in the engine; the HUD shows a small heading arrow
  for the queued turn.
- Doodle: same controls; Export (X) saves the drawing as SVG in the current look's palette.
- Feedback within one frame; the step tone follows the speed.

## 5. Screens

1. Game menu with "← Back to the Hall": two Kids duelling in the selected look (demo), modes,
   channel dial with the variation icons, opponent picker (Kid Polaroids + Computer 1977), look
   switcher preview, switches A/B per seat.
2. Pre-match cards (who, colour and pattern, switch, look).
3. Play: arena full screen; score HUD in the look's style, speed step indicator, pause (Esc).
4. Point moment: the crash plays in the look's style, the scorer's tally ticks up; on the 10th
   point, follow the cartridge (no crash animation: the board freezes) and then the win scene.
5. Results: score line, longest survival, cells claimed per rider, "How Rosa saw it", patches
   stitched, Play again (R) · Game menu · Back to the Hall (H).
6. How to play (≤60 s, interactive): you never stop, steering, walls, trapping, speed-up, gaps,
   wraparound.
7. Records per channel / opponent / memory setting. Doodle gallery (last 12 exports, local).

## 6. Art direction — four looks, one game

Each look is complete, designed for light and dark, readable first, 60 fps at 1920×1080 with 800
trail cells on screen, reduced motion respected. The 40 × 20 grid, the start positions and the cell
timing are identical in all four so engine, tests and inputs do not care which look is active.
In every look a trail cell must read as solid at a glance and the two riders must be told apart by
shape as well as colour. The signature moment in every look is **the trap closing**: the last gap
seals and the rival has nowhere to go. The crash is the second key moment.

All characters, vehicles and designs are our own. Light-bike duels and ice powers are genres; do
not imitate any film's vehicle design, costume, logo or naming.

- **Neon Grid (default):** two futuristic riders on sleek light-bikes, our own design (closed
  canopy, single glowing wheel ring, rider in a helmet with a coloured stripe), racing over a glass
  floor grid in 3D (`packages/arena`). Each bike lays a translucent wall of light, waist high, that
  ripples where it was just laid. Crash: the bike breaks into tumbling light shards and the wall
  flickers. Speed-up raises the hum, stretches the light and tilts the camera slightly. Day: a
  white acrylic arena under soft studio light, saturated light walls. Night: a black floor, walls
  glowing and reflecting.
- **Toy Trains:** two wind-up toy locomotives on a big tabletop, each laying its own track as it
  goes (sleepers and rails click into place behind it, a little puff of steam on each step).
  Running into any track derails the train: it tips, wheels spinning, a cartoon "clonk". Speed-up
  makes the chuff faster and the wind-up key spin. Day: sunlight on a play mat with painted roads.
  Night: a bedroom floor lit by the trains' own headlamps and a night light.
- **Mummy's Wrap:** two small cartoon mummies (charming, not scary) shuffling through a torch-lit
  tomb floor of sandstone tiles, each unrolling an endless bandage that never runs out; the bandage
  sticks to the floor as a wall. A rider who touches any bandage gets wound up into a cocoon from
  feet to head, wobbles and topples over. Speed-up turns the shuffle into a frantic waddle with
  flying linen ends. Day: sunlight through a shaft into a sand-gold chamber. Night: torches,
  flickering shadows, hieroglyph-like patterns of our own design glowing faintly.
- **Ice Trail:** two skaters, our own character design (warm winter suits in the two rider colours,
  frosty breath, a trail of frost from their hands), gliding over a frozen lake and freezing the air
  into a jagged wall of ice behind them. Touching any ice freezes the skater solid: frost creeps up,
  a crystalline crack, the frozen figure slides to a stop. Speed-up adds wind streaks and a
  brighter, sharper freeze sound. Day: pale blue sky, sparkling ice, cold blue shadows. Night:
  moonlight and stars, the ice walls lit from inside.

Doodle mode in each look: light painting (Neon), a train layout (Trains), bandage art (Mummy), an
ice sculpture garden (Ice). Exported SVGs use the look's palette.

Sound per look (synthesised), with shared cue meanings: step tone that rises with speed, turn tick,
gap, crash, point tally, win.

`demo(seed)`: Rosa against Moss in the Neon Grid look, silent, pauses off-screen.

## 7. Settings — §3.2. ## 8. Controls table — in HOW-TO-PLAY.

## 9. Engineering and tests

- Pure engine (`games/trailblaze/src/engine/`): grid, step clock and speed-up schedule, steering
  and reversal protection (with the diagonal hole), borders and wraparound, trails, gaps,
  simultaneous crashes, no rider-to-rider collision, scoring and the 10th-point freeze, crash
  pauses (including the asymmetric 0.32 s), Doodle erase, Remix rules, up to four riders.
  Fixed-step simulation independent of frame rate; the renderer only interpolates.
- Computer 1977 as its own module with the dossier's lookahead, tie-break timer and bug.
- Kit `kids/reflex` with unit tests (reaction distribution, lookahead, awareness, panic curve,
  slips, determinism by seed, inspectable log) and docs; Ghost Trails wired to `kids/memory`.
- Simulations (crew): Kids × variations × opponents; balance targets §3.3; engine fuzzing (100k
  random input streams: no rider ever occupies a trail cell without a crash, scores always sum
  correctly).
- Playwright (port 5522): two-seat duel to 10 with keyboard, duel vs a Kid, vs Computer 1977 in
  variation 2, speed-up, wraparound, 8-way, gaps, Doodle with erase and SVG export, all four looks
  via the switcher, Remix Four Way, results panel, tutorial, micro-challenge, challenge link,
  reduced motion. Screenshots 1280×720 and 1920×1080, light and dark, **for each look**: menu,
  mid-duel, trap closing, crash moment, results, Doodle.

## 10. Staged workflow

1. **Hero frames — OWNER CHECKPOINT.** Live scenes at 1920×1080 for **each of the four looks**:
   (a) mid-duel with long trails, by day; (b) the trap closing and the crash, by night.
   Eight frames, at least five critique rounds per look: beautiful, readable, the two riders
   clearly distinct, the four looks clearly different from each other and from Tank Duel, Hot &
   Cold and the Den? Save to `games/trailblaze/docs/media/hero/` with notes; **STOP and wait for
   the owner.**
2. Engine, Computer 1977, kit reflex module, simulations (crew-heavy, you review) → NOTES.md.
3. Wireframe play for all 14 variations and Doodle.
4. Art pass: all four looks, light and dark.
5. Modes, channels, Remix, patches, micro, daily, tutorial, settings, results panel, Doodle export.
6. Sound and feel. 7. Critique loop (≥3 rounds per look). 8. Integration, docs, final checks.

## 11. Documentation

`games/trailblaze/docs/`: ABOUT (the 1977 game, the computer opponent, the hooks and why they
happen, attract timeout and unused byte), HOW-TO-PLAY (both seats, variations table with cartridge
numbers, switches, settings incl. looks, Kids and Computer 1977, Doodle, patches, Den Life
section), ARCHITECTURE (engine, step clock, AI modules, four renderers and where each visual and
sound lives), CHANGES-FROM-ORIGINAL, NOTES. Update `docs/guides/den-life-for-games.md` with the
reflex module. ADRs: Kid reflex model; Trailblaze looks.

## 12. Content rules — CLAUDE.md rule 11 (crashes, cocoons and freezes are cartoon; no gore). Kid lines written fresh.

## 13. When you finish

Report: what you built; verified facts and hook verdicts; reflex API and final Kid values; balance
numbers vs targets; performance per look (fps with a full board, chunk sizes; Hall unchanged); kit
changes; crew ledger rows; deviations; commands. Update PROGRESS once. No commits.

## 14. Hall integration

Replace the placeholder `hall/src/data/coming-soon/trailblaze.ts` with the real manifest in
`games/trailblaze/` and a lazy `load`; status playable, players '1-2P', versus 'local+bot',
14 original channels (`originalGame` numbers, grouped Bordered / Wraparound / Doodle) + 5 Remix,
supports daily/challenge/micro, events declared, label refined. Results with
`presentation: 'game'`, share with emoji summary, pause items (incl. Look and camera), difficulty
per seat, Kids and Computer 1977 as seats. Kit: `kids/reflex` exported; the Den's Kid setting
covers reflexes. Shared files only at the very end, re-read first, change only your lines.
