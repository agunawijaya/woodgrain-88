# Brief: Gravity Duel controller, module, dev harnesses and app tests

For: **engineer** (Sonnet subagent). From: the lead (prompt 05, stage 5). The last piece of
`briefs/gd-app.md`: every screen and helper exists; what is missing is the controller that wires
them into a game, the game module, the dev harnesses and the tests.

## Read first

- `briefs/gd-app.md`: the design for every screen, settings, runs and results. It is still the
  specification.
- `AGENTS.md` (navigation standard), `CLAUDE.md` (hard rules).
- **Trailblaze's version of exactly this work, as the model to follow** (do not import from it):
  `games/trailblaze/src/app/controller.ts`, `src/module.ts`, `src/dev/game.ts`,
  `src/dev/fake-context.ts`, `src/dev/fake-chrome.ts`, `src/dev/screens.ts`, `src/dev/demo.ts`,
  `game.html`, `screens.html`, `demo.html`, and its `tests/app/*`, `tests/screens/*`.
- **Gravity Duel's existing modules** (read their exports; wire them, do not rewrite them):

  | Area                  | Files                                                                                                                 |
  | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
  | Engine                | `src/engine/*` (match, physics, types, variations)                                                                    |
  | Kid pilot             | `src/ai/pilot.ts` (`createKidPilot`, `moments`); guide forecasts in `src/ai/forecast.ts` (`coastPath`, `missilePath`) |
  | Session               | `src/session/match-session.ts`, `controls.ts`, `frame.ts`                                                             |
  | Looks                 | `src/look/looks.ts`, `look.ts`, `seats.ts`, `cameras.ts`, `ship-portrait.ts`                                          |
  | Sound                 | `src/audio/match-sound.ts`                                                                                            |
  | Progress              | `src/progress/*` (events, patches, micro, share, tracker)                                                             |
  | Channels and manifest | `src/channels.ts`, `src/manifest.ts`                                                                                  |
  | App helpers           | `src/app/settings.ts`, `save.ts`, `kid-replay.ts`                                                                     |
  | Screens               | `src/screens/*` (menu, prematch, results, tutorial, records, settings-sheet, sheet, style)                            |
  | HUD and demo          | `src/ui/hud.ts`, `src/demo/demo.ts`                                                                                   |

- `src/dev/play.ts` shows a working stage, view, session and frame loop. Note these lines: the
  light rig is updated every frame, and only the old view root (never `scene.clear()`) is removed
  when a match restarts.

## Write

- `games/gravity-duel/src/app/controller.ts`: `mountGravityDuel(host, context)`, as Trailblaze's
  `mountTrailblaze`. Split it into small modules under `src/app/` if it grows past about 500
  lines.
- `games/gravity-duel/src/module.ts`: the `GameModule`. It holds the manifest, patches,
  micro-challenges, how-to-play, `mount` and `demo`, with this how-to-play text:
  - goal: "Turn, thrust and drift. Hit your rival with missiles the star can bend, or dock with
    the drifting pods.";
  - tips (the first five in `docs/HOW-TO-PLAY.md` "Tips").
- `games/gravity-duel/src/dev/game.ts`, `dev/fake-context.ts`, `dev/fake-chrome.ts`,
  `dev/screens.ts`, `dev/demo.ts`, and the HTML pages `game.html`, `screens.html`, `demo.html`.
- Tests: `games/gravity-duel/tests/app/*.test.ts`, `tests/screens/*.test.ts`,
  `tests/ui/*.test.ts`, `tests/demo/*.test.ts`, covering what `briefs/gd-app.md` §Tests lists.
- Small changes in existing Gravity Duel files are allowed only where the wiring needs them. For
  example, add an `onTick?: (match) => void` option to `createMatchSession`, called once after
  each engine tick, so the controller can run `tracker.observe(match)` and the Kid replay's watch
  per tick. Keep such changes minimal and say what you changed.

Do not touch `packages/`, `hall/`, other games, the engine's rules, the AI or the looks' art.

## Wiring notes from the lead

1. **The frame loop.** Every animation frame:
   1. `session.advance(seconds)`, with seconds never negative;
   2. the camera move's `update` (Follow or hit nudge);
   3. `stage.lights.update(seconds)`;
   4. `stage.render()`;
   5. `hud.update(...)`;
   6. `sound.follow(match)`.

   Use the context's loop if Trailblaze does; follow its pattern for pausing off screen.

2. **Engine events** (session `onEvent`) feed `sound.hear`, `tracker.hear`, the hit nudge (on
   `hit`, at the victim) and the HUD. Per tick (`onTick`): `tracker.observe(match)`, then drain
   the tracker's events into `context.emit` (or however Trailblaze reports Den Life events), and
   feed the Kid replay.
3. **Remix channels.**
   - Pass `remix: channel.rules.remix?.id` in `ViewOptions`.
   - The Remix engine (`src/engine/remix.ts`) is still being written by another crew member. If it
     exists when you get there, set `SceneFrame.remix` from it in `session/frame.ts`:
     - `binaryStars(tick)` gives `stars`;
     - `cometAt(match)` gives `comet`, with `heading` from its travel;
     - `beltRocks(tick)` gives `rocks`;
     - convert with `toTable` and radii ÷ 5 to table units.
   - If it does not exist, leave it out and say so.
4. **The trajectory guide** (setting on, a person's seat, not in Daily, challenge or micro runs):
   `coastPath(ship, 150, rules, SHIP_WALL_MARGIN, 6)` and `missilePath(ship, ship.heading, rules,
4)`, converted with `toTable`, as `SceneFrame.guides[seat]`. Computing it every 3 ticks is
   enough.
5. **Seats.**
   - Engine seat 0 (orange) is kit player 2 on WASD; engine seat 1 (blue) is kit player 1 on the
     arrows.
   - A lone player flies seat 1, and a Kid takes seat 0.
   - Results report `winnerSeat` in the kit's numbering (seat 1 = kit player 1).
6. **Demo.** Already written; `module.demo` uses it.
7. **Reduced motion** turns on reduced effects, forces the cloak fade to snap, and disables the
   hit nudge.

## Standards

Small focused modules, clear names, comments that explain why, no dead code, strict TypeScript,
ESLint and Prettier clean, light and dark, keyboard-only play, `:focus-visible`. Run:

- `pnpm exec vitest run --root games/gravity-duel`;
- `pnpm exec eslint games/gravity-duel`;
- `pnpm exec prettier --check games/gravity-duel`;
- `pnpm exec tsc -p games/gravity-duel/tsconfig.json`.

All must pass. The dev server on port 4523 belongs to the lead: use it, never start or stop
servers. No git.

Report: files written or changed, tests, anything unfinished, kit or arena candidates.
