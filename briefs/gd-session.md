# Brief: Gravity Duel session, controls and play page

For: **engineer** (Sonnet subagent). From: the lead (prompt 05, stage 3).

## Goal

The glue between Gravity Duel's engine, whoever flies each seat (a person on keys or a pad, a
Neighbourhood Kid, nobody) and a look's 3D view. Then a dev play page that runs a whole match in
any look, any of the 17 variations, with both control schemes. That page is the bench for the art
pass and, later, the page the end-to-end tests drive.

## Read first

- `games/gravity-duel/docs/NOTES.md`; `src/engine/types.ts`, `match.ts`, `physics.ts`,
  `variations.ts`.
- `src/ai/pilot.ts` (`createKidPilot`: `hear(events, match)`, `controls(match)`).
- `src/look/look.ts` (the view contract: `SceneFrame`, `ShipPose`, `MissilePose`, `PodPose`,
  `ViewMoment`, `SpaceView`), `src/look/field.ts`, `src/look/looks.ts`, `src/look/seats.ts`,
  `src/look/space-rig.ts`, and `src/dev/hero.ts` (how a look is staged and driven).
- Trailblaze's `src/session/controls.ts`, `src/session/match-session.ts` and `src/dev/play.ts`,
  as the shape to follow. Do not import from Trailblaze.
- Kit: `packages/kit/src/input.ts`, `sticks.ts` (`digitalStick`, `heldOrTapped`), `loop.ts`.
- `AGENTS.md` for the code standards.

## Write (and only these)

- `games/gravity-duel/src/session/controls.ts`
- `games/gravity-duel/src/session/match-session.ts`
- `games/gravity-duel/src/session/frame.ts`
- `games/gravity-duel/src/dev/play.ts` and `games/gravity-duel/play.html`
- `games/gravity-duel/tests/session/*.test.ts`

Do not change the engine, the AI, the looks or the look contract. If something there blocks you,
stop and say so in your report.

## 1. `session/frame.ts`: engine → picture

- `toTable(x, y)`: engine subpixels to table units, `X = x / 256 / 5 − 16` and
  `Z = y / 256 / 5 − 9` (the field is 32 × 18 units, centred).
- `headingRadians(heading)`: `heading × π / 8`. Engine headings and look headings both run
  counter-clockwise from +x seen from above, so no flip is needed.
- `sceneFrame(match, alpha, cloak)`: builds a `SceneFrame`.
  - **Ships:** null when not present. Position interpolated `prev → current` by `alpha` (0–1),
    except when the body `wrapped` this tick, which snaps to current. Heading from the engine;
    `thrusting` from the ship; `cloak` from the given per-seat values.
  - **Missiles:** duels only, null when not live. Interpolated the same way, heading from the
    velocity (`atan2(−vy, vx)`).
  - **Pods:** docking only, null when not live. Interpolated; `tumble` = `match.tick × 0.04 +
index × 1.3` radians.
- `CloakFader`: per seat, eases a value toward 1 when cloaked and toward 0 when not, over
  0.25 s of real time (instant with reduced motion). The looks draw the shimmer from it.

Tests: unit conversion at the corners and the centre; interpolation; no glide across a wrap;
missile heading from velocity; pods only in docking; the fader's timing.

## 2. `session/controls.ts`: keys and pads → `Controls`

Seats and keys follow Trailblaze and the kit's rule. A lone player keeps the arrows, so:

- engine seat 0 (orange, starts top left) is flown by **kit player 2** on the left of the
  keyboard (WASD side);
- engine seat 1 (blue, starts bottom right) by **kit player 1** (arrows side);
- a lone player flies seat 1.

**Classic scheme** (as 1978):

| Engine control | Kit player 2 (seat 0)    | Kit player 1 (seat 1)          | Pad                         |
| -------------- | ------------------------ | ------------------------------ | --------------------------- |
| left / right   | `left` / `right` (A / D) | `left` / `right` (arrows)      | stick or d-pad left / right |
| thrust         | `up` (W)                 | `up` (↑)                       | stick or d-pad up           |
| cloak          | `down` (S)               | `down` (↓)                     | stick down, or B (`alt`)    |
| fire           | `fire` (Space)           | `fire` (Enter), and Right Ctrl | A (`fire`)                  |

- Taps between ticks still count: use `heldOrTapped` for every control, so a quick tap turns one
  step, toggles the cloak or fires.
- The engine decides whether a cloak pull counts as "on its own"; just report what is held.
- Add Right Ctrl as a fire key for seat 1 through the kit's bindings mechanism, if it allows a
  game to extend bindings. Otherwise leave it out and say so.

**Modern scheme** (point where you want to face):

- The stick or keys give a direction; the wanted heading is the nearest of the 16 to it
  (`atan2(−axis.y, axis.x)`, as the kit's axis points down the screen).
- Each tick, `left` or `right` is held toward that heading the short way round, and nothing once
  it is reached or when the stick is centred. The engine's cadence (instant first step, then one
  every 8 ticks) applies unchanged, so the turning rate is the cartridge's.
- Thrust, fire and cloak:
  - keyboard: Left Shift / Right Shift thrust, Space / Enter fire, Q / Right Ctrl cloak (seat 0 /
    seat 1);
  - pad: A thrust, B fire, Y cloak.

  Map them with custom kit actions if the kit allows (`thrust`, `cloak`). If the kit's binding
  table cannot take custom actions per game, read the extra keys through the same input
  controller in the smallest clean way, and explain the choice.

Poll the kit input once per engine tick, however many seats read it, exactly as Trailblaze's
`createPlayerControls` does.

Tests: each scheme's mapping from a fake `InputFrame`; Modern turns the short way and stops when
facing the wanted heading; centred stick turns nothing; taps count; one poll per tick.

## 3. `session/match-session.ts`

```ts
export interface SeatDriver {
  hear?(events: readonly MatchEvent[], match: Readonly<Match>): void;
  controls(match: Readonly<Match>): Controls;
}

export interface SessionStats {
  /** Who scored each point, in order (for the share line and the results). */
  readonly points: readonly Seat[];
  /** Per seat. */
  readonly shotsFired: readonly [number, number];
  readonly hits: readonly [number, number];
  readonly fuelUsed: readonly [number, number]; // whole segments burned (thrust, cloak)
  readonly docks: readonly [number, number];
  readonly starCrashes: readonly [number, number];
  /** The largest |turned| (radians) of any missile that scored, per seat. */
  readonly bestBend: readonly [number, number];
}

export interface MatchSessionOptions {
  readonly setup: MatchSetup;
  readonly drivers: readonly [SeatDriver, SeatDriver];
  readonly view?: SpaceView;
  readonly reducedMotion?: boolean;
  /** Called for every engine event as it happens, after the view has been told. */
  readonly onEvent?: (event: MatchEvent, match: Readonly<Match>) => void;
  readonly maxTicksPerAdvance?: number; // default 10
}

export interface MatchSession {
  readonly match: Readonly<Match>;
  readonly stats: SessionStats;
  /** Real seconds: whole 20 ms ticks, the remainder carried; then the view is shown at the remainder. */
  advance(seconds: number): void;
  /** Swap in another view (look or appearance change), drawn as the match stands. */
  setView(next: SpaceView): void;
  readonly over: boolean;
  dispose(): void;
}
```

- **Fixed step.** `advance` runs whole ticks: drivers' `controls`, then `stepMatch`, then every
  driver `hear`s the new events, then dispatch. After the ticks, `view.show(sceneFrame(match,
alpha, cloak))` with `alpha = accumulator / tick`, so the picture is never more than one tick
  behind the engine.
- **Events to the view**, as `ViewMoment`s at the right spot on the table:
  - `hit` (at the victim);
  - `self-hit` with `exploded` (at the ship);
  - `star-crash` (at the point between the star and where the ship touched it: use the ship's
    `prev` position, since the engine has already moved it home);
  - `cloak-burnout` → `burnout`;
  - `swallowed` (at the missile's last position);
  - `refuelled` (at the starbase);
  - `docked` (at the pod);
  - `fired` (at the ship).
- **Stats** as above. Fuel used: count segments lost, from the ships' `fuel` going down.
- `setView` disposes the old view and shows the new one immediately.

Tests: whole ticks and the carried remainder; the per-advance cap; events reach the view as the
right moments; stats count correctly in a scripted duel; drivers hear every event once.

## 4. `dev/play.ts` and `play.html`: the bench

Like Trailblaze's play page:

- **Query parameters:**
  - `?look=deep|brass|paper|whirl` (default deep);
  - `?appearance=light|dark`;
  - `?variation=1..17`;
  - `?left=` and `?right=` set to `person`, `kid:<id>` or `idle` (default: left a person, right
    Rosa);
  - `?scheme=classic|modern`;
  - `?target=10|5`, `?switches=BB`, `?quality=high|medium|low`, `?seed=<text>`.
- **Keys:** P pauses, R starts a fresh match.
- A plain text strip (scores, fuel and ammo as numbers, clock), enough to play; the real HUD
  comes later.
- Stage the look as `hero.ts` does (`createLookStage`, `look.createView` with the variation's
  centre and edges, seat colours), and drive `stage.render` / `view.update` every animation frame.
- Expose `window.__gravityDuel = { match, session }` for tests and the lead's checks.

## Standards

- Run `pnpm exec vitest run --root games/gravity-duel tests/session`,
  `pnpm exec eslint games/gravity-duel/src/session games/gravity-duel/src/dev/play.ts
games/gravity-duel/tests/session`, `pnpm exec prettier --check` on the same, and
  `pnpm exec tsc -p games/gravity-duel/tsconfig.json`, until they pass.
- Start the dev server only if you need to look (port 4523, `pnpm --filter
@woodgrain-88/gravity-duel dev`), and stop it when you are done.
- No git. Report: files, tests, what you could not do cleanly, and anything in the engine, AI or
  look contract that looked wrong.
