# Prompt 01 — Den Life: the collection's gamification layer

> Run in Claude Code from `E:\Projects\Atari-2600\32-in-one`, alone, AFTER 00 and 00a (both done
> and committed, `ceccf3c`). Recommended: Opus 5.5, effort **xhigh**. Long session; work in the
> stages of §12.
> **Owner checkpoint:** stage 4 ends with Den Life hero frames; STOP there and wait for the
> owner's approval before building the rest.
> You lead a Gemini crew through `pnpm crew` (see `docs/team/PROTOCOL.md`). Run `pnpm crew ping`
> first. You own `packages/kit` and `hall/` (only session).

## 0. Read first

1. This whole prompt, then `CLAUDE.md`, `AGENTS.md`, `.claude/skills/retro-reborn-builder/SKILL.md`.
   Your first reply summarises the hard rules in five lines, names this prompt, says you own the kit
   and the Hall, states port 4488 (Hall) / 5488 (Playwright), and shows the `crew ping` result.
2. `docs/PLAN.md` §3 (owner decisions) and §5 (Den Life), `docs/ARCHITECTURE.md`, ADRs 0001–0007,
   the kit's public API (`contract.ts`, `patches.ts`, `channels.ts`, `micro.ts`, `daily.ts`,
   `events.ts`, `store/`), and the Den (`hall/src/den/*`). Den Life extends what is there; it does
   not rebuild it.
3. `docs/media/hero/NOTES.md`: the approved Den, including the owner's two review rounds. Keep
   every approved element (sticky note on the rail, the cat, the Counter unit, the coat hanger).
4. `research/dossiers/*.md` §5 (Variations) of each game: how many variations each original has.
   You need the counts for the channel design (§3.6). Read only; nothing from there enters the repo.

## 1. Goal

Woodgrain '88 has 30 games. Den Life is what makes people come back to the collection as a whole:
a daily reason to switch the console on, goals per game that are always visible, a jacket of
patches that shows who you are as a player, a room that grows with you, couch nights with a
friend, and a cast of neighbourhood kids to beat. Everything is earned by playing. Nothing is
bought. The games themselves stay faithful to their originals (CLAUDE.md rule 11); Den Life sits on
top and never changes a game's rules.

No real game is playable yet, so Den Life is built and proven with test fixtures (§9) and a
dev-only showcase profile (§9) that fills the room so it can be seen, judged and photographed.

## 2. Owner decisions this prompt implements (2026-10-26)

1. Every original variation of every game is open from the first play, as on the cartridge. Only
   **Remix channels** (new rule sets we design per game) are earned.
2. The console's two **difficulty switches** work as on the original: left switch for the left
   player, right switch for the right player, **A = hard, B = easy**. Patches earned on A are sewn
   in gold thread.
3. Six **Neighbourhood Kids** are the bot cast of every game.
4. **The Den grows**: trophies, posters and lights earned by play.
5. Chips and credits in Table 21 and Lucky Reels belong to those games only. There is no
   collection-wide currency.

## 3. Systems

All rules are data-driven and unit-tested. You design every public API and data shape; the crew
implements engines and tests behind your interfaces (§11).

### 3.1 Power Cycle of the day

- Uses the kit's `powerCycleOfTheDay` and `dailySeed`. Extend it to also pick the day's **channel**
  (any original variation or an open Remix channel; deterministic per day).
- One daily run per game per day counts for the daily score (later runs are practice and say so).
- **Share line**, plain text, no personal data, copied with one click, e.g.
  `Woodgrain '88 #12 · Tank Duel ch.7 · 3–1 · 🟩🟩🟥🟩`. Each game supplies its emoji summary
  through the existing result/share hooks; define the contract for it (max 12 emoji).
- The calendar on the Den wall shows today's game, its channel and whether you have played it.

### 3.2 Streak and the calendar

- A day counts when any run finishes (any game, any mode).
- One automatic **snow day** per ISO week covers a single missed day; a second miss leaves a gap.
  A gap is just an empty square: no "streak lost" message, no countdown, no nagging copy.
- Calendar page per month on the wall: ticked days, snow-day flakes, the current streak and the
  best streak in the corner. Clicking it opens a month view with flip-back to earlier months.
- Edge cases tested: UTC day boundary, DST, device clock moving backwards (never award future days),
  first-ever day, long absences.

### 3.3 Patches

- Every game will ship 3–5 patches: **Club**, **Pro**, **Legend** and one **secret** (the kit's
  tiers). Thresholds are published in the game's details and on the jacket.
- Gold thread: earned with that seat's difficulty switch on A. An Amateur patch turns gold when the
  goal is met again on A (the kit already models this; keep it).
- Patch art is code-drawn embroidery: each game's patches share its emblem and accent, tiers differ
  in shape (round Club, shield Pro, star-edged Legend, hidden-stitch secret), thread texture is
  procedural (satin fill, border stitches, a slight puff), gold thread shimmers subtly (none under
  reduced motion). Define a patch-art generator in the kit that every game feeds with data, so 120+
  patches stay consistent.
- Earning a patch: in the results screen it is "stitched" in a short animation (needle passes,
  thread fills); in the Den the jacket on the door gets a tiny highlight until you look at it.

### 3.4 The Jacket

- Opening the jacket on the door shows it full screen: a denim jacket (front and back, flip with
  one click) with stitched seams, pockets, collar, rivets; procedural denim texture; light and dark
  designs (by night the desk lamp lights it).
- **Drag and drop** patches from a patch drawer (filter by game, family, tier, gold) onto the
  jacket. Patches snap to free spots, can be rotated in 15° steps and layered; dropping on another
  patch swaps. Keyboard alternative: select a patch, arrow keys to move, R to rotate, Enter to sew.
  Undo/redo. An "Auto-arrange" button for people who just want it to look good.
- Locked patches show as a dashed outline with their goal; secret ones as "?" with a hint.
- **Export** the jacket as an SVG card (display name optional) and copy to clipboard.

### 3.5 The difficulty switches (Pro switch)

- The two switches on the Den console are real toggles (click, drag, or keys `[` and `]`), each
  labelled for its seat, A/B. Their positions persist and are passed to games per seat
  (`GameContext`: replace the single `proSwitch` with per-seat `difficulty: { left: 'A' | 'B',
  right: 'A' | 'B' }`; amend ADR-0002 and update the fixture).
- Games decide what A means, as their originals did (the dossiers record it per game). The game's
  details panel shows one line per switch: "A: …  B: …".
- In-game, the pause menu shows the switch positions; changing them mid-run applies from the next
  round (games declare whether a live change is allowed).

### 3.6 Channels: every original variation, plus Remix

- Raise `MAX_CHANNELS` to fit the largest original (the dossiers will show up to about 27–30
  variations); choose a safe limit (e.g. 64) and justify it.
- Channels get a `kind: 'original' | 'remix'`, an optional `group` (games with many variations group
  them, e.g. Tank Duel: Tanks · Tank-Pong · Invisible · Biplanes · Jets) and the original variation
  number(s) they correspond to (`originalGame?: number[]`) so the details panel can say "Game 14 on
  the cartridge".
- Unlock rule: originals always open; each Remix channel names the patch that opens it.
- **Channel picker** (game menu and details): the TV dial. A chunky rotary dial and a channel strip
  grouped by `group`, number pad entry (type 1–4–Enter like a 1988 remote), arrow keys, and a
  "Surprise me" button. It must stay fast and readable for 30 channels.

### 3.7 Power Cycle Run

- Five games picked at random (or the day's seeded run), each started with one of its
  micro-challenges (kit `micro`), 45 seconds each, one goal line on screen.
- Between games the **power switch flips by itself**: the room dims, the CRT collapses, snow, the
  next cartridge label slides into the console, the Counter flips, the goal card drops in. This is
  Den Life's signature moment; make it as good as the Den's power switch, a little faster each
  round (round 5 is frantic and funny). Reduced motion: quick cross-fades.
- Score: passes × time bonus; a results card with five mini-slates and a share line
  (`Woodgrain '88 Run #12 · ✅✅❌✅✅ · 4/5`). Records per mode (free run and daily run).
- Starting it: hold POWER for a second (with a fill ring on the lever), or the "Power Cycle Run"
  chip in the top bar. Until at least five playable games declare micro-challenges, the chip shows
  "Opens when five games are on the shelf" and only tests use it (fixtures, §9).

### 3.8 Versus Night

- Two players on one machine (two keyboard halves or two gamepads; kit two-seat input). Pick player
  names (free text, kit validation), best of 3 or 5, and the game pool: random among playable games
  whose manifest says `versus: 'local' | 'local+bot'`, or hand-picked.
- A missing second player is filled by a Neighbourhood Kid of your choice.
- The **chalkboard** propped against the TV stand keeps the score in chalk tallies; between games
  the next game is drawn like a raffle (cartridges shuffle on the shelf and one lifts out). The
  series winner gets a chalk crown and a small victory animation; a Rematch button keeps names.
- Versus results go to stats per seat and per pair of names (a local "rivalry" record).

### 3.9 The Neighbourhood Kids

Six bot personalities shared by every game. A game maps the same personality parameters onto its
own AI, so "Dee" feels like Dee in Tank Duel and in Disc Duel.

| Kid | Style | Parameters (0–1, design and document them) |
|---|---|---|
| **Dee** | Aggressive, fast, takes risks | aggression high, caution low, reaction fast, error medium |
| **Moss** | Careful, defensive, punishes mistakes | aggression low, caution high, error low |
| **Pip** | Chaotic, unpredictable, sometimes brilliant | randomness high, error high, streaky |
| **Grandpa Lou** | Slow but almost never wrong | reaction slow, error very low, patience high |
| **Rosa** | Tricky: bluffs, baits, feints | deception high, adaptivity medium |
| **Benny** | The copycat: learns your habits during a match | adaptivity high, mirrors the player |

- Kit module `kids`: the roster, parameters, display names, short bios in our own words, and a
  helper games use to turn parameters into their AI settings (reaction delay, error rate, risk
  appetite, adaptivity window). Games may add their own interpretation; the module documents
  intent with examples.
- Code-drawn **avatars**: 1988 school-photo style portraits (distinct faces, hair, clothes,
  expressions for win/lose), light and dark aware. No real people, no trademarks.
- **The corkboard** on the Den wall: six Polaroids pinned with thumbtacks. Clicking opens the Kids
  view: bios, your record against each across games, and the **Block Ladder**.
- **Block Ladder**: beat each kid once in any game to climb a rung (Pip → Benny → Dee → Rosa → Moss
  → Grandpa Lou); the top rung is "Block champion" with a patch of its own and a ribbon on the
  corkboard. Beating a kid on A difficulty is shown separately.

### 3.10 The Counter

- Lamps 1–30 light when the game's **first patch** is earned (change from "played"; migrate
  existing progress by counting no lamps until a patch exists). Lamps 31–32 keep 00a's rule
  (finishing a run with the alternate cartridge version).
- All 32 lit: the Counter plays a one-time celebration (lamps chase, a mechanical bell) and a
  "32 in 1" plaque appears on it.

### 3.11 The Den grows

Earned room changes, all code-drawn, all reversible by "Forget my data", all defined as data
(`hall/src/den/growth.ts`) with anchors from the existing scene graph:

| Earned by | What appears |
|---|---|
| Any Legend patch | A small trophy for that game on the Label Wall's short rows (game emblem on the plinth) |
| A Club patch in every playable game of a family | That family's poster on the wall (Duels, Brain, Sports, Arcade), each its own 1980s poster style |
| Streak 7 / 30 / 100 | Paper chain on the window / string lights along the shelves / a neon "ON AIR" sign |
| Block champion | Ribbon on the corkboard |
| 10 Versus Night series | A second beanbag (the cat moves to it) |
| All 32 lamps | The "32 in 1" plaque, and the TV gets a woodgrain remote on top |

New items fade in the first time with a small sparkle and a one-line toast ("A trophy for Tank
Duel"). The room must still look composed with everything earned: plan the anchors so nothing
crowds the TV, the Counter or the labels.

### 3.12 Records and the Den's top bar

- Records page: personal bests per game, channel and mode, Run records, Versus rivalries, Block
  Ladder, streaks, patches x/y, gold count, lamps x/32.
- Top bar: add the "Power Cycle Run" and "Versus Night" chips (keep the order clean; a compact
  overflow at 1280 px).

## 4. Interaction rules

Drag and drop wherever objects move (patches, chalkboard names, cartridges in Versus pick mode),
each with click and keyboard alternatives. Feedback within one frame. Illegal actions: a gentle
shake and a one-line reason, never a modal. Navigation standard everywhere (Game menu / Back to the
Hall; Escape closes overlays back to the Den).

## 5. Screens (new or changed)

1. Den with calendar, corkboard, chalkboard, switches, growth items, run/versus chips.
2. Calendar month view. 3. Jacket (front/back, drawer, export). 4. Patch detail popover.
5. Kids view and Block Ladder. 6. Versus Night setup → series → series results.
7. Power Cycle Run intro → five rounds with transitions → results.
8. Channel picker (TV dial) in game menu and details. 9. Records page (extended).
10. Results screen additions: patch stitched, lamp lit, growth toast, share line.

Every screen designed in light and dark, at 1280×720 and 1920×1080, small screens not broken.

## 6. Art direction — "Den Life"

Everything belongs to the same 1988 rec room as the approved Den: warm walnut, mustard, burnt orange
and teal by day; lamp pool and TV glow by night. New textures (denim, embroidery, chalk, cork,
Polaroid paper, posters) are procedural and rendered with care: a patch must look stitched up close,
chalk must look dusty, Polaroids must have their white borders and slight curl. Typography stays the
Den's (Fraunces, Atkinson Hyperlegible Next, Big Shoulders Display, Patrick Hand). Sound: synthesised
needle stitches, chalk squeaks, thumbtack clicks, a mechanical bell; quiet by default. 60 fps at
1920×1080; growth items must not cost frame time when idle (cache static layers).

## 7. Settings

Add: show/hide growth items (some players like a clean room), share line includes display name
(off by default), Versus default series length, Run sound intensity. Keep everything from 00/00a.

## 8. Controls (new)

| Action | Mouse | Keyboard |
|---|---|---|
| Flip left / right difficulty switch | Click or drag the switch | `[` / `]` |
| Start Power Cycle Run | Hold POWER 1 s, or the chip | Hold `P` 1 s |
| Open calendar / jacket / corkboard / chalkboard | Click it | Tab to it, Enter |
| Channel picker | Dial, strip, number pad | Arrows, digits + Enter, `S` = surprise |
| Jacket | Drag patches | Select, arrows, `R` rotate, Enter sew, Ctrl+Z / Ctrl+Y |

## 9. Engineering and tests

- Kit modules (new or extended): `streak`, `kids`, `versus` (series state machine), `run` (Power
  Cycle Run scheduler on `micro`), `channels` (kinds, groups, unlock), `patches` (+ art generator
  data), `growth` rules in the Hall data layer, contract amendments (difficulty per seat, emoji
  summary, channel kinds). Store schema migration to v3 with tests (export → import round trip).
- **Fixtures (test-only, never in the registry or the build; assert it):** keep the paddle game;
  add a turn-based fixture (a tiny board game with a bot that reads Kid parameters) and a
  single-player fixture with three micro-challenges, so Versus Night, the Kids, the Run (with
  fixtures registered as five virtual games in tests), patches and channels are proven end to end.
- **Showcase profile (dev only):** `pnpm dev` with `?showcase=full|mid|new` loads a generated profile
  (patches across all 30 games, gold ones, streak 34, Block Ladder at rung 4, 12 Versus series, 27
  lamps) so every growth item and screen can be seen. Excluded from production builds (assert it).
- Unit tests for every rule above; Playwright flows: jacket drag and drop + keyboard sewing +
  export; calendar month view; switches persist and reach the fixture; channel dial by number pad;
  Versus Night full best-of-3 with a Kid filling seat 2; Power Cycle Run with fixtures through five
  transitions; growth items appear and "Forget my data" clears them; navigation; no console errors;
  axe by day and night; frame-time budget for the grown Den.

## 10. Documentation

`docs/den-life.md` (player-facing: every system explained, with the patch tiers and growth table),
ADR-0008 Den Life (data model, rules, why), ADR-0002 amendment (difficulty, emoji summary, channel
kinds), `docs/ARCHITECTURE.md` updates with Mermaid diagrams (streak, versus and run state machines;
growth data flow), and a **game author's guide** `docs/guides/den-life-for-games.md`: what each game
prompt must supply (patches, Remix channels, micro-challenges, emoji summary, difficulty meaning,
Kid mapping, versus support) with a worked example on the fixture. Update the docs templates so
every game's HOW-TO-PLAY has a Den Life section. PROGRESS once.

## 11. Delegation (lead vs crew)

| You (lead) | Crew (Gemini via `pnpm crew`) |
|---|---|
| All APIs, data shapes, ADRs, contract amendments | `streak`, `versus`, `run`, `kids` engines to your interfaces, with tests |
| Every visual: jacket, patches, calendar, corkboard, Polaroids, chalkboard, posters, trophies, lights, dial, Run transitions | Store migration v3 and its tests |
| Animation, sound, the Run's signature transition | Fixtures (turn-based, micro), showcase profile generator |
| Hero frames and critique loops | Playwright specs, axe runs, docs drafts (`den-life.md`, guide) |
| Review of every crew diff, final integration | Growth rule tests, channel picker keyboard logic |

Keep orders small with exact signatures and test lists; use the ledger.

## 12. Staged workflow

1. **APIs and data** — contract amendments, kit interfaces, growth data, store v3 plan; ADR drafts.
2. **Engines** — crew builds streak, versus, run, kids, migration; you review; tests green.
3. **Fixtures and showcase** — the two new fixtures, showcase profile, wiring through the Hall.
4. **Hero frames — OWNER CHECKPOINT.** Live screens at 1920×1080: (a) the Jacket full of patches,
   front, by day; (b) the grown Den by night (showcase=full: trophies, posters, string lights,
   corkboard ribbon, plaque, second beanbag with the cat); (c) Versus Night mid-series on the
   chalkboard, by day; (d) a Power Cycle Run transition mid-snow with the goal card, by night;
   (e) the Kids view with Polaroids and the Block Ladder, by day; plus the opposite appearance of
   (a) and (b). At least five critique rounds: Does each texture convince up close? Is the grown Den
   still composed, or crowded? Would a 14-year-old want to fill that jacket? Is the Run transition
   thrilling? Save to `docs/media/hero/den-life/` with notes, then **STOP and wait for the owner.**
5. **Complete the screens** after approval: every screen in §5, both appearances, both sizes;
   three critique rounds.
6. **Sound and feel** — stitches, chalk, tacks, bells; the Run's acceleration.
7. **Docs** — §10.
8. **Final check** — `pnpm lint`, `typecheck`, `test`, `check`, `build`, `e2e`; showcase excluded
   from the build; fresh profile clean; `crew status` clean.

## 13. When you finish

Report: what you built; contract and kit API changes (for game prompts); the channel limit chosen
and the variation counts per game from the dossiers (one table); Kid parameter definitions; test
results; frame times for the grown Den; the crew ledger rows and your honest view of the savings;
deviations and known gaps; exact commands (including showcase URLs). No commits.
