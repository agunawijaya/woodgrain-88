# Prompt 02 — Tank Duel (inspired by "Combat", Atari, 1977; cartridge slot 21)

> Run in Claude Code from `E:\Projects\Atari-2600\32-in-one`, AFTER prompt 01 (Den Life) is done
> and committed. Runs alone (it creates `packages/arena` and is the kit owner of its wave).
> Recommended: Opus 5.5, effort **xhigh**. Long session; stages in §10.
> **Owner checkpoint:** stage 1 ends with hero frames; STOP and wait for the owner's approval.
> You lead a Gemini crew via `pnpm crew` (`docs/team/PROTOCOL.md`); run `pnpm crew ping` first.
> This is the pilot game of the collection: what you set up here (arena package, Kid AI mapping,
> game folder conventions) is copied by every later game. Do it properly.

## 0. Read first

1. `CLAUDE.md`, `AGENTS.md`, `.claude/skills/retro-reborn-builder/SKILL.md`, `docs/ARCHITECTURE.md`,
   ADRs (0002 contract with its amendments, 0008 Den Life), the kit's public API, `docs/templates/`,
   and `docs/guides/den-life-for-games.md` (written by prompt 01: what every game must supply).
   First reply: hard rules in five lines, this prompt's name, "kit owner: me (`packages/kit` and the
   new `packages/arena`)", ports (game dev 4520, Playwright 5520; Hall 4488), `crew ping` result.
2. How a game integrates: the placeholder `hall/src/data/coming-soon/tank-duel.ts`, `BASE_ENTRIES`
   and its lazy `load`, the fake fixtures under `hall/tests/fixtures/`, results, share, pause items,
   difficulty per seat, channels with kinds and groups, Kids, micro-challenges, emoji summary.
3. **Reference (read-only, never copy into the repo):** `research/dossiers/21-paint-tanks.md`
   (verified behaviour; the file keeps its old name) and `src/21_Combat.asm` when you need to check
   something. Describe behaviour in your own words in NOTES.md. Never copy the original's arena or
   maze layouts, sprite shapes, colour tables or sound tables: our arenas are designed by us.
4. This whole prompt; §14 (integration) overrides earlier sections where they differ.

Trademark: `inspiredBy.originalTitle` "Combat", `uiTitle` "the 1977 tank duel". Never "Combat",
"Atari" or "Activision" in UI, code identifiers or copy outside credits/About.

## 1. The pitch

The 1977 pack-in duel: two tanks (or biplanes, or jets), one screen, ricochets and guided shots,
27 variations behind one SELECT switch. It never had a computer opponent: alone, the other tank
just sat there. Tank Duel keeps every variation and adds the Neighbourhood Kids as rivals with real
personalities, in a living miniature diorama with real explosions.

- **Tagline:** "Tanks, jets and biplanes. Ricochets, cover and big explosions."
- **Teaser:** "27 classic duels on one cartridge, rebuilt as a tabletop battlefield. Bank shells off
  the walls, curl guided shots round corners, hide in the clouds, and finally take on a computer
  rival who plays like a person."
- Family duels · players 1–2 (versus local + Kid bots) · session 3–10 min.

## 2. What the original does (verify each point; record in NOTES.md)

From the dossier, all confirmed by the lead in prompt 00 or to be confirmed by you:

- 27 variations: tanks 1–14 (guided/straight, open/simple maze/complex maze, bouncing, billiard,
  invisible), biplanes 15–20 (guided, straight, machine gun, clouds/clear, 2v2, giant bomber vs 3),
  jets 21–27 (guided/straight, clouds/clear, 2v2, 1 vs 3). Use the dossier's §5 table as the
  behavioural spec for the 27 original channels.
- One point per hit; one projectile per player in the air; guided shots follow the vehicle's
  turning; machine guns fire short fast bursts; no friendly fire.
- Hit: the victim spins about 2.5 s and is shoved back along the shot's direction in the first
  frames; both shots are cleared; the clock keeps running.
- Round: about 2 min 44 s; the score blinks during the last ~20 s; at the end everything freezes.
- Tanks rotate in 16 steps, drive forward only, get pushed back off walls and the other tank and
  slide free when wedged. Aircraft fly constantly; jets have afterburner/brake, biplanes throttle.
- Invisible tanks show when firing, bumping or spinning.
- Billiard: a shot scores only after at least one bounce.
- Difficulty switch A is a **handicap**: shorter shot range (about 5/8) and slower aircraft.
- Hooks to verify and use: the shooter twitches one rotation step on every scoring hit; each
  bounce raises the ricochet ping's pitch; the two players' explosions have slightly different
  pitches; the 32-in-1 biplane wiring swaps turn and throttle axes; after 32 bounces a billiard
  shot briefly cannot score.
- No computer opponent exists. Confirm and state it in ABOUT.md.

## 3. Game design

### 3.1 Modes

| Mode | What it is |
|---|---|
| **Versus** | Two humans, one machine (split keyboard or two gamepads) |
| **Vs a Kid** | You against one of the six Neighbourhood Kids (any channel) |
| **Daily** | The Power Cycle of the day when it lands on Tank Duel: seeded channel and Kid |
| **Challenge link** | Kit challenge links (channel, seed, score to beat) |
| **Micro-challenges** | For the Power Cycle Run (§3.6) |

Scoring rule chosen in the game menu: **Timed round** (original, ~2:44, last-20-s warning) or
**First to 10**.

### 3.2 Channels

- **27 original channels**, kind `original`, `originalGame: [n]`, grouped: Tanks (1–9), Invisible
  Tanks (10–14), Biplanes (15–20), Jets (21–27). Titles are ours and descriptive ("Guided · Simple
  maze", "Billiard · Complex maze", "Giant bomber vs three"), max 24 characters.
- **4 Remix channels**, kind `remix`, each opened by a patch:
  - **Ricochet Royale** — only bank shots score; each bounce before the hit adds a point (1 bounce =
    1, 3 bounces = 3); bouncing shells, open arena with angled bumpers.
  - **Blackout** — both tanks invisible all the time; a radar sweep every 5 s shows positions for
    0.6 s; firing still reveals you.
  - **Ace Duel** — jets with an afterburner fuel gauge that refills while cruising; guided shots.
  - **Last Tank** — one hit ends the round; rounds of 30 s; first to 5 rounds.
- Arenas: our own designs for "open", "simple maze" and "complex maze" equivalents (same purpose:
  open field, light cover, dense cover), plus a bumper arena for Ricochet Royale. Symmetric for
  fairness, readable at a glance, tested with bots (§9). Sky channels: our own cloud formations.

### 3.3 The Neighbourhood Kids as tank commanders

Map the kit `kids` parameters onto one shared Tank Duel AI (no cheating: bots see what a player
sees, including invisible tanks only when revealed; they get the same handicaps from their switch):

- Dee: rushes, fires early, chases. Moss: holds cover, waits for clean shots, retreats when low on
  angle. Pip: erratic routes, wild guided curls, occasional genius banks. Grandpa Lou: slow turns,
  near-perfect aim and bank geometry. Rosa: baits with curved guided shots, feints direction
  changes, ambushes from cover. Benny: learns the player's habits over the match (favourite lanes,
  turn direction) and mirrors or cuts them off.
- The AI computes bank-shot solutions in billiard modes (one and two bounces), leads moving targets,
  and handles aircraft (constant motion, afterburner use). Personality changes choices, timing and
  error, never hidden information.
- Balance targets (seeded bot-vs-bot simulations, recorded in NOTES.md and locked as tests with
  tolerances): on channel "Guided · Simple maze", Grandpa Lou beats Pip 70–85% of matches; Dee vs
  Moss 40–60% either way; a scripted "novice human" bot beats Pip 35–55%; matches on timed rounds
  end with a combined score of 6–20 for 90% of seeds; no channel produces a stalemate (0–0) in more
  than 5% of bot-vs-bot rounds.

### 3.4 Difficulty switches

Faithful: A shortens that seat's shot range to about 5/8 and slows its aircraft (biplanes one tier,
jets two tiers); tanks unaffected. The details panel shows "A: shorter shots, slower aircraft ·
B: full range". Patches earned on A are gold.

### 3.5 Patches (kit tiers)

| Tier | Patch | Goal |
|---|---|---|
| Club | Rookie Commander | Win a match against any Kid |
| Club | Ricochet | Score 10 hits with shots that bounced (any channel) |
| Pro | Bank Manager | Score 10 hits in billiard channels (opens Ricochet Royale) |
| Pro | Ghost | Win an invisible-tank channel against a Kid (opens Blackout) |
| Pro | Top Gun | Win 3 jet channels against Kids (opens Ace Duel) |
| Legend | Grandpa's Respect | Beat Grandpa Lou on an invisible maze channel with your switch on A (opens Last Tank) |
| Secret | Lone Wolf | Win "One jet vs three" as the lone jet |

### 3.6 Micro-challenges (45 s each)

"Hit 3 times" (Guided · Open), "Land a bank shot" (Bouncing · Open), "Survive invisible" (no hits
taken, Invisible maze), "Down a biplane" (Biplane clouds), "Jet duel: 2 hits" (Jets clear).

### 3.7 Share and emoji summary

One square per point in order (🟩 you, 🟥 opponent), max 12, then the final score:
`Woodgrain '88 #12 · Tank Duel ch.7 · 🟩🟩🟥🟩 · 3–1`.

### 3.8 Settings (per game)

Scoring rule (timed / first to 10) · **Cartridge wiring** (off by default: "the 32-in-1 cartridge
swapped the biplane's turn and throttle; turn on to fly it that way") · aim assist line for bank
shots in practice only (never in daily/challenge/versus ranked) · camera shake · explosion
intensity (full / reduced) · colour-blind-safe team colours.

## 4. Interaction

- Seat 1: WASD (A/D turn, W forward / afterburner, S brake) + Space fire. Seat 2: arrows + Enter.
  Gamepads: left stick or d-pad, A/Cross fire. Biplane controls follow the standard scheme unless
  "Cartridge wiring" is on.
- Turning feels like 16 steps (keep the rhythm of the original's step rotation) but rendered with a
  quick ease between steps so it looks smooth.
- Feedback within one frame for every input; a fired shell appears from the muzzle on that frame.
- Mouse only for menus. Escape pauses.

## 5. Screens

1. **Game menu** (title screen) with "← Back to the Hall": the diorama idles behind (demo),
   mode buttons (Versus, Vs a Kid, Daily, Practice), channel dial (kit picker), scoring rule,
   opponent picker (Kid Polaroids), switch A/B per seat, How to play, Settings, Records.
2. **Pre-match**: both commanders' cards (name or Kid portrait, switch position, colour), channel
   title and the original game number, "Ready" per seat (press fire).
3. **Match**: diorama full screen; HUD: two big score plates on the top edge in team colours, the
   round clock as a burning fuse between them (sparks faster in the last 20 s, the plates pulse like
   the original's blink), a bank combo tag near a scoring shot ("BANK ×3"), pause button with Esc.
4. **Pause**: Resume · Change channel · How to play · Settings · Game menu · Back to the Hall.
5. **Results**: final score plates, a key-moment replay of the best hit (3–5 s, the bank path traced),
   patches stitched, Play again (R) · Game menu · Back to the Hall (H); Rematch in Versus.
6. **How to play** (tutorial under 90 s): drive, turn, fire, guided curl, bank shot, invisible reveal,
   aircraft; playable steps in a small practice arena.
7. **Records**: per channel and mode, Kid records, best bank chain.

## 6. Art direction — "Tabletop Front"

A miniature battlefield on a table, seen from above at a slight tilt (about 55–65° from horizontal,
orthographic or a long lens so distances read fairly; both seats must see the whole arena with equal
clarity — no perspective advantage).

- **Rendering:** three.js (lazy-loaded with the game, never in the Hall bundle), physically based
  materials, one key light plus ambient, real-time soft shadows, all geometry and textures procedural
  (zero raster: noise-based sand, grass, concrete; generated normal detail). This becomes
  `packages/arena` (§14).
- **Tanks:** low-poly but finely modelled miniatures (hull, turret, barrel, tracks with moving tread
  texture, antenna), team colours as painted miniatures (olive vs desert, each with a bright team
  trim for readability; colour-blind-safe alternative). Track marks stay in the sand and fade
  slowly. Dust puffs when driving and bumping.
- **Aircraft:** biplanes with spinning props and wing struts, jets with afterburner glow; shadows on
  the ground below them so height reads; clouds as soft volumetric-looking puffs (layered sprites
  drawn procedurally) that planes can hide in.
- **Shells:** bright tracers with a short trail; guided shells leave a curving smoke ribbon; bounce
  sparks with a ping whose pitch rises per bounce (the original's hook); machine guns as short
  tracer bursts.
- **Signature moment — the bank-shot kill:** the shell's glowing path stays visible for a moment,
  each bounce lighting a spark and a rising ping; on impact: a muzzle-bright flash, a fireball with
  rolling smoke, debris bits, a short camera shake (setting), the victim tank spinning wildly as in
  1977 and shoved back, scorch mark on the ground, and the shooter's tank twitching one step from the
  recoil (the original's hook). The score plate slams up. This is the README hero shot.
- **Light (day):** a bright tabletop under daylight, warm sand, crisp shadows, clear sky for air
  channels. **Dark (night):** the table under a single desk-lamp-like spotlight and moonlight blue
  fill, headlights on tanks, muzzle flashes and explosions lighting the arena, tracers glowing. Both
  designed, never inverted; readability first (vehicles always stand out from the ground).
- **Arenas** look like crafted terrain boards: sandbags, concrete walls, low hedges, ruins; walls
  that bounce shells look solid and are clearly marked. Invisible tanks: a faint heat shimmer only
  when the rules reveal them (nothing that leaks position otherwise — add a test).
- **Sound (WebAudio, synthesised):** engine hum per tank (pitch with speed), turret whine, shell
  thump, ricochet ping with rising pitch, explosion rumble with slightly different pitches per side
  (the hook), prop drone, jet roar, machine-gun rattle, a short fanfare for the winner. A stereo pan
  by position. Quiet by default, mixable in settings.
- **Performance:** 60 fps at 1920×1080 on a mid-range laptop with two vehicles, 8 shells, smoke and
  clouds; 2v2 and 1v3 channels included. Reduced motion: no shake, shorter smoke, explosion as a
  bright pop and scorch only.
- `demo(seed)`: two Kids duelling on a rotating set of channels, silent, cheap, pauses off-screen,
  drawn in the given appearance. The Den TV shows it through the kit's `crt`.

## 7. Settings — see §3.8. ## 8. Controls table — in HOW-TO-PLAY (seat 1, seat 2, gamepad).

## 9. Engineering and tests

- **Pure engine** (`games/tank-duel/src/engine/`, no DOM, no three.js): vehicles, headings (16
  steps), movement and wrap rules, shells (straight, guided, machine gun, bounce state machine with
  corner handling, billiard rule, bounce counter), collisions, invisibility, hit-spin and knockback,
  round clock, scoring rules, handicaps, squadrons. Fixed timestep from the kit loop, seeded RNG.
- **Arena data** as our own designs (JSON or TS), validated by tests (symmetry, enclosed borders
  where required, no unreachable pockets, spawn safety: no shot lines between spawns at round start).
- **AI** in its own module using the kit `kids` parameters; bank-shot solver tested on fixed scenes.
- **Simulations** (crew): bot-vs-bot across all 31 channels × 6 Kids, seeded; balance targets §3.3;
  record in NOTES.md and lock as tests.
- **Rule tests** for every behaviour in §2, including the hooks (recoil step, pitch per bounce,
  32-bounce billiard gap, cartridge wiring).
- **Playwright** (game-scoped config, port 5520): versus with two keyboard seats, vs a Kid on a
  tank, a biplane and a jet channel, channel dial by number, pause/resume, results paths, tutorial,
  keyboard-only menus, a micro-challenge run, daily mode, challenge link round trip, reduced motion.
  Screenshots 1280×720 and 1920×1080, light and dark: menu, pre-match, match (tank maze, invisible,
  biplanes in clouds, jets 2v2), bank-shot kill mid-explosion, results, tutorial.

## 10. Staged workflow

1. **Hero frames — OWNER CHECKPOINT.** Build enough of the arena package and renderer to show live
   scenes (not mockups) at 1920×1080: (a) a tank duel on a maze arena by day, a bank shell
   mid-flight with its path; (b) the bank-shot kill mid-explosion by night; (c) biplanes in clouds by
   day; plus (a) by night and (c) by night. At least five critique rounds: are the miniatures
   beautiful up close and readable from afar? Do day and night both work? Is the explosion
   thrilling? Would it be the README hero? Save to `games/tank-duel/docs/media/hero/` with notes;
   **STOP and wait for the owner.**
2. **Engine + arenas + AI + simulations** (crew-heavy, you review) → NOTES.md.
3. **Wireframe play** with full input for both seats and all vehicle classes.
4. **Art pass** across all channels, both appearances.
5. **Modes, channels, patches, micro-challenges, daily, tutorial, settings.**
6. **Sound and feel** (step-rotation rhythm, recoil, ping pitch, shake, hit-stop of 60 ms on kills).
7. **Critique loop** (≥3 rounds, both appearances, both sizes).
8. **Hall integration, docs, final checks** (§14).

## 11. Documentation

`games/tank-duel/docs/`: ABOUT (brochure; the 1977 game, its 27 variations, the missing computer
opponent, the 32-in-1 biplane wiring), HOW-TO-PLAY (both seats, gamepad, every vehicle, channels
table with original game numbers, Remix, patches, Den Life section), ARCHITECTURE (engine state
machines, bounce state machine, AI, renderer, where every visual and sound lives and how to change
it), CHANGES-FROM-ORIGINAL, NOTES (verified behaviour in our words, simulations, tuning). ADRs:
`packages/arena` design, Tank Duel rendering. Mermaid only. README row via `pnpm docs:games`.

## 12. Content rules

Faithful to the original (CLAUDE.md rule 11): vehicles shoot and explode; no people shown, no gore.
Our own words for all copy; Kid lines (taunts on win/lose, short and friendly-cheeky) written fresh.

## 13. When you finish

Report: what you built; verified facts and hook verdicts; balance numbers vs targets; performance
numbers (fps, memory after 10 minutes, bundle sizes: Hall unchanged, game chunk, arena chunk);
`packages/arena` API summary for later games; kit changes; crew ledger rows; deviations and gaps;
commands to run and test. Update `docs/PROGRESS.md` once. No commits.

## 14. Hall integration and `packages/arena`

- Replace the placeholder: the real manifest lives in `games/tank-duel/`; remove
  `hall/src/data/coming-soon/tank-duel.ts` and give the entry its lazy `load`. Status `playable`,
  `players: '1-2P'`, `versus: 'local+bot'`, channels (31), supports daily/challenge links/micro,
  events declared, label art refined to the game's identity.
- Results with `presentation: 'game'`, share with the emoji summary, pause items, difficulty per seat,
  Kids as seats, daily numbering from the kit, records keyed by channel.
- **`packages/arena`** (you own it; ADR): the shared three.js diorama toolkit for later duel and
  arcade games — renderer setup with light/dark lighting rigs, orthographic tilted camera with fair
  framing, procedural ground materials, shadow setup, particle systems (dust, smoke, sparks, fire),
  explosion and scorch effects, tracer and trail ribbons, cloud puffs, camera shake honouring
  settings, performance budget helpers, disposal. Game-specific models stay in the game. Keep it out
  of the Hall bundle (assert in `pnpm check`).
- Shared files only at the very end: re-read before editing, change only your line (registry,
  README via the docs script, PROGRESS, CREDITS row if needed).
