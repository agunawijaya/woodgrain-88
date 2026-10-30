# Brief: Gravity Duel, the game around the match

For: **engineer** (Sonnet subagent). From: the lead (prompt 05, stage 5). Continues
`briefs/gd-session.md` (the session, controls and play page must be done first).

## Goal

Everything around a match, so Gravity Duel plays inside the Hall like Trailblaze does:

- the game module and manifest;
- the controller;
- the game menu, the pre-match cards and the HUD;
- pause, results with "How the Kid flew it", How to play, records and settings;
- the demo for the Hall's attract mode;
- daily, challenge-link and micro-challenge runs.

Mirror Trailblaze's structure and behaviour (read its `src/app/`, `src/screens/`, `src/ui/`,
`src/demo/`, `src/module.ts`, `src/manifest.ts`). Do not import from Trailblaze. Pieces that are
truly shared (and not game-specific) belong in the kit or `packages/arena`, but **do not change
`packages/` yourself**. List them in your report as candidates and the lead lifts them.

## Read first

- `prompts/05-gravity-duel.md` §3–§5 and §14 (the design: modes, settings, Kids, screens, Hall
  integration). `AGENTS.md` (navigation standard, rules). `CLAUDE.md` hard rules.
- The game so far:
  - `src/engine/*`, `src/ai/pilot.ts`, `src/session/*`, `src/channels.ts`, `src/progress/*`;
  - `src/audio/*` (`createMatchSound`);
  - `src/look/*` (`LOOK_IDS`, `lookById`, `createLookStage`, `seatColours`);
  - `docs/NOTES.md`.
- Kit: `contract.ts` (`GameModule`, `GameContext`, `GameManifest`, `GameResult`), `daily.ts`,
  `share.ts` (challenge links), `micro.ts`, `kids.ts` (`KIDS`, `kidPortraitSvg`), `kids/mode.ts`.

## Write (and only these)

`games/gravity-duel/src/` → `manifest.ts`, `module.ts`, `app/**`, `screens/**`, `ui/**`,
`demo/**`, `dev/game.ts`, `dev/fake-*.ts`, `dev/screens.ts`, `dev/demo.ts`; their HTML entry pages
in `games/gravity-duel/`; `games/gravity-duel/tests/{app,screens,ui,demo}/**`;
`games/gravity-duel/package.json` (exports `./manifest` and `./module`, scripts as Trailblaze's).
Nothing in `hall/`, `packages/` or other games: the lead does the Hall integration at the end.

## The design, by screen

All copy below is the lead's; use it word for word (fix only obvious typos, and say so). Fonts,
colours, spacing and the light/dark treatment follow Trailblaze's screens (`screens/style.ts`):
make Gravity Duel's own `style.ts` with its own accent:

- day `#6a4fa0`, night `#c3a9ff` (from the Hall's placeholder);
- AA contrast in both appearances.

### Manifest (`manifest.ts`)

| Field            | Value                                 |
| ---------------- | ------------------------------------- |
| `id`             | `'gravity-duel'`                      |
| `slot`           | 16                                    |
| `title`          | `'Gravity Duel'`                      |
| `tagline`        | `'No brakes in space.'`               |
| `teaser`         | the prompt's §1 teaser, word for word |
| `family`         | `'duels'`                             |
| `players`        | `'1–2P'`                              |
| `versus`         | `'local+bot'`                         |
| `sessionMinutes` | `[3, 8]`                              |
| `status`         | `'playable'`                          |
| `scoreOrder`     | `'higher'`                            |

- `accent`, `emblem` and `label`: as in `hall/src/data/coming-soon/gravity-duel.ts`.
- `inspiredBy`: `{ originalTitle: 'Space War', uiTitle: 'the 1978 orbital duel', publisher:
'Atari', year: 1978, cartridgeSlots: [16] }`.
- `channels` and `events` come from `channels.ts` and `progress/events.ts`.
- `supports`: daily, challenge links, micro-challenges.
- **Controls:**
  - seat 1 (arrows): "turn" (← →), "thrust" (↑), "cloak" (↓ on its own), "fire" (Enter or
    Right Ctrl);
  - seat 2 (WASD): A/D turn, W thrust, S cloak, Space fire;
  - Modern scheme rows as in `briefs/gd-session.md`.
- **Difficulty:** left/right A "Duels: your own missile can blow you up. Docking: match speeds
  almost exactly"; B "Duels: your own missile is harmless. Docking: a close match will do".
  `liveChange: false`.

### Game menu (`screens/menu.ts`)

Behind the menu, two Kids (Rosa and Moss) duel on the selected channel in the selected look,
silently. Use the session with two Kid drivers; restart the match when it ends.

- **Top left:** "← Back to the Hall" (Escape there returns to the Hall).
- **Mode tabs:** Duel · Docking race · Solo docking. A mode shows only its group's channels on the
  dial, plus the Remix group (Remix channels are duels; show them under Duel, locked ones with
  their patch named).
- **Channel dial:** like Trailblaze's. Each channel shows its cartridge number ("Game 4"), title,
  description and icons from `channelFacts`:
  - edges: bounce walls / wraparound;
  - centre: star / starbase / beacon / none;
  - gravity on;
  - cloak on;
  - pods: own / shared.

  Draw the icons as small inline SVGs of your own.

- **Opponent picker** (not in Solo docking): the six Kids as Polaroids (`kidPortraitSvg`) with
  their one-line style below, plus "A friend" (two people on one keyboard or two pads):
  - Grandpa Lou: "Calm, frugal with fuel, leads his shots well, turns late."
  - Moss: "Keeps her distance, cloaks when threatened, loves the starbase."
  - Rosa: "Hunts you down and slings shots round the star."
  - Benny: "Copies your moves, a beat later."
  - Dee: "Full thrust everywhere. The star gets her a lot."
  - Pip: "Wanders, wastes missiles, then bends a perfect one round the sun."
- **Look switcher:** Deep Space · Brass Orrery · Paper Sky · Whirlpool (saved per player).
- **Controls:** Classic · Modern, with one line each:
  - Classic: "Turn, thrust and drift, as in 1978."
  - Modern: "Point where you want to face; the ship turns there at the old rate."
- **Switches:** A/B for each seat, labelled with the manifest's difficulty lines for the chosen
  mode.
- **Match length:** Cartridge (10 points or the 12-minute clock) · Short (5 points or 4 minutes).
- **Links:** How to play, Settings, Records.

### Pre-match cards (`screens/prematch.ts`)

As Trailblaze's: each seat's ship up close in the chosen look, its name, who flies it (the
player, "A friend", or the Kid) and its keys. Ship names per look:

| Look         | Orange (engine seat 0, WASD) | Blue (engine seat 1, arrows) |
| ------------ | ---------------------------- | ---------------------------- |
| Deep Space   | Lance                        | Crescent                     |
| Brass Orrery | Clipper                      | Beetle                       |
| Paper Sky    | Zip                          | Bubble                       |
| Whirlpool    | Minnow                       | Puffer                       |

For the portraits, render the look's ship figure offscreen once per card, as Trailblaze's
`look/rider-portrait.ts` does. You may add `src/look/ship-portrait.ts`; it is the one look file
you may create. Then a 3-2-1-go countdown with `MatchSound.countdown`.

### Play: the HUD (`ui/hud.ts`)

Over the 3D stage:

- each seat's score;
- each seat's fuel and missile bars (8 segments each, duels only), styled per look (a CSS class
  per look is enough):
  - Deep: thin glowing segments;
  - Brass: enamel lozenges in brass frames;
  - Paper: crayon boxes;
  - Whirl: round porthole dots;
- the match clock (m:ss), which blinks for its last 1,024 ticks;
- in docking, each seat's docks instead of bars;
- a pause button with an "Esc" hint.

The HUD reads the match each frame; it never decides anything.

**Hit moment:** on a hit, a short camera nudge toward the victim (about 0.25 s, a few percent of
the framing). Never with reduced motion, and it never hides any part of the field.

### Cameras and the guide (already written by the lead; wire them, do not rewrite)

- `src/look/cameras.ts`:
  - `createFollowCamera(stage, () => view.root, look.framing, shipAt)` for Follow;
  - `createHitNudge(stage, () => view.root, look.framing)` for the hit nudge (Overhead only, never
    with reduced motion).

  Call `update(dt)` every frame after `view.show`, and `release()` when leaving play or switching
  camera.

- **Trajectory guide.** When it is on for a person's seat, compute each frame (or every few
  ticks):
  - `coastPath(ship, 150, rules, SHIP_RADIUS, 6)` for where the ship drifts;
  - `missilePath(ship, ship.heading, rules, 4)` for where a missile would fly.

  Both come from `src/ai/forecast.ts`. Convert them with `toTable` and pass them as
  `SceneFrame.guides[seat]`; the looks draw the dots.

### Pause (Esc)

Resume · Look · Controls · Camera · How to play · Settings · Game menu · Back to the Hall. Confirm
before leaving a match in progress.

### Results (`screens/results.ts`)

`presentation: 'game'`.

- **Content:**
  - the winner banner per seat (versus) or "N docks" (solo);
  - the score line with the point symbols (`progress/share.ts`);
  - per seat: shots, hits, accuracy, fuel segments used, docks, star crashes (from
    `SessionStats`);
  - patches stitched this match;
  - "How Lou flew it" (see below).
- **Buttons:** Play again (R) (Rematch (R) in versus) · Game menu · Back to the Hall (H). Share
  copies the share line.

### "How the Kid flew it" (`app/kid-replay.ts` + a panel in results)

When a Kid played, keep a rolling record of the last 4 seconds of the match: the session's
`SceneFrame`s at 25 per second, and the Kid's `PilotMoment`s (`createKidPilot(...).moments`).

When the Kid was hit or scored, the panel shows a strip of 6 small frames from the last 3 seconds
before that hit, drawn as a 2D canvas sketch (ships, missiles, the centre). On top of each frame:

- the Kid's planned shot as a dotted aim line (`moment.shot.heading` from the ship);
- the Kid's believed fuel ("thought 3 segments left", against the true count).

Collapsible, closed by default. Show the latest such moment of the match.

### How to play (`screens/tutorial.ts`)

Interactive, at most 90 seconds, seven short steps on the real engine, the player flying seat 1.
Each step has a one-line instruction and advances when done (or on Enter):

1. "Turn: ← and →." Done after turning a half circle.
2. "Thrust: ↑. You keep drifting after you let go." Done after moving 20 steps.
3. "To stop, turn round and thrust the other way." Done when speed drops under 3 units after
   having been over 10.
4. "Fire: Enter. Your missile adds your own speed." Done after a shot.
5. "The star pulls everything, missiles too. Bend a shot round it." Variation 4, a still target
   ship behind the star; done on a hit, or after three tries.
6. "Pull ↓ on its own to cloak. Cloaking costs fuel, and you cannot steer while hidden." Done
   after cloaking and uncloaking.
7. "Docking: touch the pod with your speed matched." Variation 14; done on a dock.

### Records (`screens/records.ts`)

As Trailblaze's. Keyed per channel, opponent, controls scheme and Kid setting (Human/Sharp):

- best margin of victory;
- fastest win;
- most docks (solo).

Records never count runs played with the trajectory guide on (see Settings).

### Settings (`app/settings.ts`, `screens/settings-sheet.ts`)

Saved per player, as Trailblaze's:

- Look; Controls (Classic/Modern); Match length.
- **Trajectory guide** (off by default). The guide itself is drawn by the lead's look code; you
  only read and pass on the setting. Disabled, with a one-line reason, in Daily, challenge links
  and micro-challenges: "Daily, challenge and record runs are flown without the guide."
- Ship colours: Standard / Colour-blind safe (`seatColours('colour-blind')`).
- Reduced effects.
- Camera: Overhead / Follow. Follow is offered only to a lone player; Overhead is forced in Daily
  and records.

### Runs from the Hall

- **Daily:** the kit's daily numbering and seed. The seed picks one of `game-4`, `game-5`,
  `game-8` and `game-14`, and a Kid (not Pip) for duels and races. Overhead camera, no guide.
- **Challenge links:** encode channel, seed, opponent and controls scheme with the kit's
  challenge helpers.
- **Micro-challenges:** from `progress/micro.ts`; the run's clock is the kit's.
- **Results:** `reportResult` with `winnerSeat` in versus, `won` against a Kid, score, the share
  line through `withKidsMark`, and `kids: 'sharp'` when the Kids were Sharp.

### Demo (`demo/demo.ts`)

`demo(seed)`: Rosa against Moss on `game-4`, Deep Space, silent. It pauses off screen, draws in
the appearance given, and loops matches.

## Tests

Mirror Trailblaze's app and screen tests:

- **manifest:** passes `validateManifest`;
- **controller:** wires a duel, a Kid match, a solo docking run, daily, challenge and micro runs;
- **menu:** modes filter the dial, locked Remix channels show their patch, the opponent picker
  hides in solo;
- **results:** order and keys; the share line; the Kid replay panel's data;
- **settings:** the guide is disabled in daily, challenge and micro runs;
- **HUD:** reflects fuel, ammo and the clock blink;
- **demo:** starts and stops cleanly.

## Standards

Small focused modules, clear names, comments that explain why, no dead code; strict TypeScript,
ESLint and Prettier clean; light and dark designed; `:focus-visible`; keyboard-only play; reduced
motion. Run the game's tests, ESLint, Prettier and `pnpm exec tsc -p
games/gravity-duel/tsconfig.json` until they pass. No git. Report what you built, the tests,
anything you could not finish, and the kit or arena candidates.
