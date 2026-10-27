# Prompt 03 — Hot & Cold (inspired by "Flag Capture", Atari, 1978; cartridge slot 5)

> Run in Claude Code from `E:\Projects\Atari-2600\32-in-one`, AFTER prompt 02 (done, `3ac6b09`).
> Runs alone: it extends `packages/kit` (human-like Kid memory) and is the kit owner.
> Recommended: Opus 5.5, effort **xhigh**. Stages in §10.
> **Owner checkpoint:** stage 1 ends with hero frames of all three looks; STOP and wait.
> You lead a Gemini crew via `pnpm crew`; run `pnpm crew ping` first.

## 0. Read first

1. `CLAUDE.md`, `AGENTS.md`, `.claude/skills/retro-reborn-builder/SKILL.md`,
   `docs/guides/den-life-for-games.md`, ADRs (0002 and amendments, 0008 Den Life, 0009 arena,
   0010 Tank Duel), the kit API (`kids.ts` especially), `docs/templates/`.
   First reply: hard rules in five lines, this prompt, "kit owner: me", ports (game dev 4521,
   Playwright 5521; Hall 4488), `crew ping` result.
2. **Sibling to study:** `games/tank-duel/` (how a real game integrates: manifest, channels, Kids,
   patches, micro-challenges, daily, results, pause, demo, docs). Never import from it; reuse
   `packages/arena` and the kit.
3. **Reference (read-only):** `research/dossiers/05-hot-and-cold.md` (verified behaviour) and
   `src/05_Flag_Capture.asm` when you must check something. Our own words in NOTES.md; boards are
   generated, never copied.
4. This whole prompt; §14 overrides earlier sections.

Trademark: `inspiredBy.originalTitle` "Flag Capture", `uiTitle` "the 1978 hidden-flag hunt".

## 1. The pitch

A hidden flag on a 9×7 field. Every square you uncover tells you something: how far the flag is
(counted like a chess king), which way it lies, or that you just stepped on a bomb and must walk
home. Race a friend to it, take turns like a board game, or hunt alone against a check limit or a
clock. In 1978 every clue vanished the moment you let go of the button. Now you choose: keep your
notes on the board, or play it the way it was, from memory, against Neighbourhood Kids who forget
things too.

- **Tagline:** "Every square is a clue. One of them is the flag."
- **Teaser:** "Uncover distances, arrows and the odd bomb, close in on a hidden flag, and get there
  before your rival. Play with notes on the board or purely from memory, against friends or Kids
  who remember about as well as people do."
- Family brain · 1–2 players (versus local + Kid bots) · session 2–10 min.

## 2. What the original does (verify; record in NOTES.md)

Everything in the dossier §2–§5 is the behavioural spec. Key points:

- 9 columns × 7 rows (63 squares); each round: 1 flag, 8 bombs, 27 distance squares, 28 arrow
  squares (arrows are the default fill).
- Distance = the larger of the row and column differences (1–8). Arrows: 8 compass directions.
- Revealing: the flag check runs **before** the square's type, so a moving flag standing on a bomb
  square is captured safely.
- Bomb: short blast, then you return to your home corner, unless the other player stands on it
  (then you stay where you are).
- Players move in 8 directions, the field wraps on all edges, two players can't share a square,
  a short lockout after each step before you can reveal.
- The clue shows only while fire is held (Classic Memory).
- 10 variations: 1–2 simultaneous race (stationary / moving bouncing flag), 3–5 alternating turns
  (stationary / bouncing / wrapping), 6–7 solo check limit 75 (stationary / bouncing), 8–10 solo
  timed 75 ticks ≈ 1.5 min (stationary / bouncing / wrapping). First to 15 in 1–3, to 75 in 4–5.
- Difficulty switch A: variation 1 slows that player's steps (~25%); variations 6–7 count two
  checks per reveal; elsewhere no effect.
- Hooks to verify and keep faithfully: the swapped configuration bits (a solo player who finds the
  flag on exactly the 75th check gets a bonus round; the expert fast-timer in 8–10 never activates;
  variation 2 ignores the switch); 75-point target in two-player variations 4–5; home-corner bomb
  immunity; the flag may sit on a bomb square.
- No computer opponent exists. Say so in ABOUT.md.

## 3. Game design

### 3.1 Modes

| Mode | What it is |
|---|---|
| **Race** | Variations 1–2: both move at once on one field, first to the flag scores |
| **Turns** | Variations 3–5: one reveal per turn, board-game style |
| **Solo: Check limit** | Variations 6–7 |
| **Solo: Against the clock** | Variations 8–10 |
| **Daily** | One seeded field for everyone (Power Cycle of the day): fewest checks to the flag |
| **Challenge link**, **Micro-challenges** | Kit standard |

Opponent for Race and Turns: a second human (split keyboard / pads) or a Neighbourhood Kid.
**Match length** setting: *Cartridge* (as 1978: 15 or 75) or *Short* (first to 5).

### 3.2 Settings (per game, all in the game's Settings panel)

- **Clues:** *Notebook* (default; revealed clues stay on the field for everyone) or *Classic
  Memory* (a clue shows only while you hold reveal, as in 1978). Kids follow the same rule.
- **Possibility fog** (toggle, default off): squares that can no longer hold the flag dim. Never
  available in Daily, challenge links or ranked records (show why when disabled).
- **Look:** *Polar Expedition* (default), *Tabletop Board*, *Radar Room* (§6). Changes only the
  presentation; rules, timing and sound cues stay identical. Saved per player.
- Match length, step speed preview, colour-blind-safe clue colours, reduced effects.

### 3.3 Human-like memory for the Neighbourhood Kids (new kit module, the heart of this prompt)

The owner's requirement: Kids must not have perfect recall. A person forgets, mixes things up and
misses what the other player did; each Kid must too, to a degree that fits its personality.

Build `packages/kit/src/kids/memory.ts` (generic, reusable by Table 21's card counting, Disc Duel,
Crown Jump and others; document it in the game author's guide):

- `MemoryProfile` per Kid: **capacity** (how many separate facts it can hold), **half-life**
  (seconds, how fast an unrehearsed fact fades), **distortion** (chance that a recalled fact comes
  back slightly wrong), **attention** (chance of noticing something the opponent revealed),
  **rehearsal** (whether using a fact refreshes it), **salience weights** (own discoveries, bombs
  and surprises stick better than routine clues).
- `KidMemory` with `observe(fact, salience, now)`, `recall(now, rng)` returning the facts the Kid
  currently "has" (possibly distorted), `forgetAll()`, and an inspectable log for the results
  screen and tests. Forgetting is probabilistic and seeded (deterministic in tests): strength
  decays exponentially by half-life; when over capacity the weakest fact goes first.
- Distortion is domain-defined by the game through a small adapter: here a distance can be recalled
  ±1, an arrow rotated by one step (45°), a position shifted by one square.
- Defaults (tune by simulation; record final values in NOTES.md and the kids docs):

| Kid | Capacity | Half-life | Distortion | Attention to opponent | Character |
|---|---|---|---|---|---|
| Grandpa Lou | 9 | 120 s | 2% | 90% | Remembers nearly everything, slowly |
| Moss | 7 | 90 s | 4% | 80% | Careful, rehearses what matters |
| Rosa | 6 | 60 s | 6% | 85% | Watches *you* more than the field |
| Benny | 6 | 60 s | 5% | 95% | Copies what you found |
| Dee | 4 | 30 s | 10% | 50% | Rushes, forgets, mixes up numbers |
| Pip | 3 | 20 s | 18% | 40% | Scatterbrained, sometimes lucky |

- **In Classic Memory** the model governs everything the Kid knows. **In Notebook** clues are on the
  field for everyone, so memory does not limit what the Kid can see; instead a matching
  **attention/reading budget** (how many visible clues the Kid takes into account per decision,
  same personality scale) keeps it human. Kids never see hidden information.
- Transparency: after a match the results screen can show "What Lou remembered": facts kept,
  forgotten, misremembered, missed (a small, fun panel, collapsible).
- Global Kid setting in the Den's settings: *Human memory* (default) or *Sharp memory* (perfect
  recall, labelled as a harder option). Records note which was used.

### 3.4 How each Kid plays Hot & Cold

All reason over the facts they currently remember with the same constraint solver (candidate squares
consistent with remembered clues, accounting for a moving flag's possible paths); personality
changes choices and timing:

- **Lou:** picks the square with the highest expected information; walks slowly (step delay at the
  top of the human range).
- **Moss:** only commits to the flag when ≤2 candidates remain; avoids squares adjacent to known
  bombs.
- **Dee:** greedy: heads for the most likely square at once, reveals often, hits bombs.
- **Pip:** mixes random steps with occasional good guesses.
- **Rosa:** in Race, parks on your home corner when you are near unknown squares (using the
  home-corner rule), and races you for squares you are heading to.
- **Benny:** prioritises clues you uncovered (if it noticed them) and tries to beat you to your
  conclusion.

Kids move at human speeds (the original's step pacing with a reaction delay) and obey the post-step
lockout and difficulty switches exactly like a player.

Balance targets (seeded simulations, crew; record in NOTES.md and lock as tests with tolerances):
Race variation 1, Classic Memory, human memory: Lou beats Pip 75–90% of first-to-5 matches; Moss vs
Dee 50–70% for Moss. Solo variation 6 with a scripted perfect solver: median checks to the flag
4–8 (validates board generation); with Lou's memory in Classic: median ≤ 2 checks more than
perfect. No variation leaves the flag unfindable (every field solvable).

### 3.5 Remix channels (opened by patches)

**Two Flags** (two flags, clues point to the nearer one), **Minefield** (16 bombs, fewer arrows),
**Thin Ice** (Notebook clues fade after 10 s), **Drift Storm** (the flag moves two squares per miss).

### 3.6 Patches

| Tier | Patch | Goal |
|---|---|---|
| Club | Flag Finder | Capture 10 flags (any mode) |
| Club | Neighbour's Rival | Win a Race or Turns match against any Kid |
| Pro | Bomb Dodger | 5 flags in a row without hitting a bomb (opens Minefield) |
| Pro | Sharp Eyes | Solo variation 6 in 12 checks or fewer (opens Thin Ice) |
| Pro | Pure Memory | Win a Turns match against Moss in Classic Memory (opens Two Flags) |
| Legend | Old Fox | Beat Grandpa Lou in a moving-flag variation in Classic Memory with your switch on A (opens Drift Storm) |
| Secret | Lucky 75 | Find the flag on exactly the 75th check in solo (triggers the cartridge's bonus round) |

### 3.7 Micro-challenges and share

Micro (45 s): "Find the flag", "Find 2 flags", "A flag without a bomb", "Beat Dee to the flag".
Emoji summary: one symbol per reveal (🔢 distance, ➡️ arrow, 💥 bomb, 🚩 flag), max 12, then checks:
`Woodgrain '88 #14 · Hot & Cold · 🔢➡️💥🔢🚩 · 5 checks`.

## 4. Interaction

- Seat 1: WASD (and Q/E/Z/C diagonals) + Space to reveal (hold in Classic Memory). Seat 2: arrows
  (and numpad diagonals) + Enter. Gamepads: stick/d-pad + A.
- Mouse in solo and Turns: click a square to walk there along the shortest wrapped path (respecting
  step timing), click again or press reveal to check it.
- Feedback within one frame; illegal step (occupied square) gives a nudge and a one-line reason.

## 5. Screens

1. Game menu with "← Back to the Hall": the field idling in the selected look (demo), modes, channel
   dial, opponent picker (Kid Polaroids), Clues mode, look switcher preview, switches A/B per seat.
2. Pre-match cards (who, colour, switch, Classic/Notebook badge).
3. Play: field full screen; HUD with scores or checks/time, turn indicator in Turns, pause (Esc).
4. Results: round summary, "What the Kid remembered" panel, patches stitched, Play again (R) ·
   Game menu · Back to the Hall (H).
5. How to play (≤90 s, interactive): move, reveal, distance, arrow, bomb and home, combining two
   clues, moving flag.
6. Records per channel/mode/memory setting.

## 6. Art direction — three looks, one game

Each look is complete, designed for light and dark, readable first, 60 fps at 1920×1080, reduced
motion respected. The field geometry (9×7, square positions) is identical in all three so tests and
inputs don't care which look is active. The signature moment in every look: **closing in and
capturing the flag** (the last clues converge, the flag rises, a celebration that fits the look);
the bomb-and-walk-home is the second key moment.

- **Polar Expedition (default):** a 3D snowfield grid marked with survey stakes (`packages/arena`).
  Tiny explorers in parkas leave footprints; uncovered distance squares show carved numerals with a
  warm glow that gets *hotter* the closer the flag (the title's joke), arrows as planted
  directional markers, bombs throw a plume of snow and the explorer tumbles back home on a sled
  run; the flag bursts out of the snow and unfurls. Day: dazzling white and ice blue, crisp blue
  shadows. Night: aurora over the field, lantern light on the explorers, glowing clue marks.
- **Tabletop Board:** a handsome wooden board game on a table: tiles flip over with a satisfying
  click to show painted numbers and arrows, wooden pawn explorers, a bomb tile pops with a cartoon
  puff and the pawn hops home, the flag is a little pennant on a pin. Day: warm daylight on oak and
  felt. Night: a single lamp, deep shadows, brass details catching light.
- **Radar Room:** a sweeping radar/sonar scope with a phosphor grid; reveals ping, distance rings
  pulse, arrows are vector bearings, bombs are a static burst and the blip snaps back to its home
  corner, the flag is a locked target with a triumphant ping. Day: a light-panel console (pale
  greens and greys, readable in sunlight). Night: deep green phosphor glow. Must not look like the
  Den's CRT TV.

Sound per look (synthesised), with shared cue meanings: step, reveal, distance tone (pitch rises as
distance falls), arrow tone, bomb, flag fanfare.

`demo(seed)`: two Kids racing in the Polar look, silent, pauses off-screen.

## 7. Settings — §3.2. ## 8. Controls table — in HOW-TO-PLAY.

## 9. Engineering and tests

- Pure engine (`games/hot-and-cold/src/engine/`): board generation (seeded, our own generator with
  the same composition), clue computation, reveal order (flag first), moving flag (bounce/wrap),
  movement and wrap, occupancy, lockouts, scoring and win rules per variation, the cartridge's hooks
  (bonus round on exactly 75, home-corner immunity, flag on bomb square, switch effects).
- Constraint solver for candidate squares (used by the fog, the Kids and the tests).
- Kit `kids/memory` with exhaustive unit tests (decay, capacity, distortion adapters, attention,
  determinism by seed, inspectable log) and docs.
- Simulations (crew): Kids × variations × clue modes; balance targets §3.4; solvability check of
  100k generated fields.
- Playwright (port 5521): Race with two keyboard seats, Turns vs a Kid in Classic Memory, solo
  check limit to a loss (target revealed) and to a win, timed mode, look switcher (all three),
  fog toggle disabled in Daily, Kid memory panel, tutorial, keyboard-only and mouse paths,
  micro-challenge, challenge link, reduced motion. Screenshots 1280×720 and 1920×1080, light and
  dark, **for each look**: menu, mid-hunt, bomb moment, capture moment, results.

## 10. Staged workflow

1. **Hero frames — OWNER CHECKPOINT.** Live scenes at 1920×1080 for **each of the three looks**:
   (a) mid-hunt with several clues uncovered, by day; (b) the flag capture moment, by night.
   Six frames, at least five critique rounds per look: beautiful, readable, clearly different from
   each other and from Tank Duel and the Den? Save to `games/hot-and-cold/docs/media/hero/` with
   notes; **STOP and wait for the owner.**
2. Engine, solver, kit memory module, simulations (crew-heavy, you review) → NOTES.md.
3. Wireframe play for all variations and both clue modes.
4. Art pass: all three looks, light and dark.
5. Modes, channels, Remix, patches, micro, daily, tutorial, settings, memory panel.
6. Sound and feel. 7. Critique loop (≥3 rounds per look). 8. Integration, docs, final checks.

## 11. Documentation

`games/hot-and-cold/docs/`: ABOUT (the 1978 game, vanishing clues, the swapped configuration bits,
the 75-check bonus round), HOW-TO-PLAY (both seats, mouse, clues, variations table with cartridge
numbers, settings incl. looks and clue modes, Kids, patches, Den Life section), ARCHITECTURE
(engine, solver, memory model, three renderers and where each visual/sound lives),
CHANGES-FROM-ORIGINAL, NOTES. Update `docs/guides/den-life-for-games.md` with the Kid memory module
(how a game defines facts, salience and distortion). ADRs: Kid memory model; Hot & Cold looks.

## 12. Content rules — CLAUDE.md rule 11 (bombs explode; no gore). Kid lines written fresh.

## 13. When you finish

Report: what you built; verified facts and hook verdicts; memory model API and final Kid values;
balance numbers vs targets; performance per look (fps, chunk sizes; Hall unchanged); kit changes;
crew ledger rows; deviations; commands. Update PROGRESS once. No commits.

## 14. Hall integration

Replace the placeholder `hall/src/data/coming-soon/hot-and-cold.ts` with the real manifest in
`games/hot-and-cold/` and a lazy `load`; status playable, players '1-2P', versus 'local+bot',
10 original channels (`originalGame` numbers, grouped Race / Turns / Solo) + 4 Remix, supports
daily/challenge/micro, events declared, label refined. Results with `presentation: 'game'`, share
with emoji summary, pause items (incl. Clues mode and Look), difficulty per seat, Kids as seats.
Kit: `kids/memory` exported; Den settings gain the Kid memory option (Human / Sharp). Shared files
only at the very end, re-read first, change only your lines.
