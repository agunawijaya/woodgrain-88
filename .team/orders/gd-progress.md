---
id: gd-progress
kind: plumbing
member: agy-flash
fence:
  - games/gravity-duel/src/progress/events.ts
  - games/gravity-duel/src/progress/patches.ts
  - games/gravity-duel/src/progress/micro.ts
  - games/gravity-duel/src/progress/share.ts
  - games/gravity-duel/src/progress/tracker.ts
  - games/gravity-duel/tests/progress/events.test.ts
  - games/gravity-duel/tests/progress/share.test.ts
  - games/gravity-duel/tests/progress/tracker.test.ts
acceptance:
  - pnpm exec vitest run --root games/gravity-duel tests/progress
  - pnpm exec eslint games/gravity-duel/src/progress games/gravity-duel/tests/progress
  - pnpm exec prettier --check games/gravity-duel/src/progress games/gravity-duel/tests/progress
reads:
  - games/gravity-duel/src/engine/types.ts
  - games/gravity-duel/src/channels.ts
  - games/trailblaze/src/progress/events.ts
  - games/trailblaze/src/progress/patches.ts
  - games/trailblaze/src/progress/micro.ts
  - games/trailblaze/src/progress/share.ts
  - games/trailblaze/src/progress/tracker.ts
  - packages/kit/src/patches.ts
  - packages/kit/src/micro.ts
  - packages/kit/src/events.ts
---

## Goal

Gravity Duel's progress modules: the Den Life events it declares, its eight patches, four
micro-challenges, the share line, and a tracker that turns a match's engine events into those
Den Life events. Follow Trailblaze's progress modules for shape and style (read them), but write
Gravity Duel's own content exactly as given below. Do not import anything from Trailblaze.

## Context

- Gravity Duel is a two-ship duel with momentum and a star in the middle, plus docking races.
  `src/engine/types.ts` has the match shape (`Match`, `Ship`, `Shot`, `MatchEvent`, `Seat`,
  `TICKS_PER_SECOND`, `SUBPIXELS`, `CENTRE_X`, `CENTRE_Y`). `src/channels.ts` has the channels
  (`GravityChannel`, ids `game-1` … `game-17` and four Remix ids).
- The player is one seat (0 or 1). Points are `scored` events.
- **A missile hit** is a `hit` event with `shooter`, `victim` and `turned`: the radians the
  star bent the missile, signed.
- **A cloak** is a `cloak` event with `on`.
- **A dock** is a `docked` event.
- **A starbase visit** is a `refuelled` event with `speed`: the whole speed units, |vx| + |vy|,
  the ship came in at.

## Interface to implement

```ts
// events.ts
export const GRAVITY_EVENTS: readonly GameEventSchema[];
export function pointWonEvent(facts: {
  bend: number;
  afterCloak: boolean;
  frugal: boolean;
}): GameEvent;
export function pointLostEvent(): GameEvent;
export function dockEvent(facts: { inMatch: number; switchA: boolean }): GameEvent;
export function nearStarEvent(seconds: number): GameEvent;
export function refuelEvent(speed: number): GameEvent;
export function matchWonEvent(facts: {
  duel: boolean;
  vsKid: boolean;
  fuelLeft: number;
  louOrbit: boolean;
  kid: string;
}): GameEvent;
export function matchLostEvent(kid: string): GameEvent;

// patches.ts
export const GRAVITY_PATCHES: readonly PatchDef[];

// micro.ts
export const GRAVITY_MICRO_CHALLENGES: readonly MicroChallengeDef[];

// share.ts
/** One symbol per point from the player's side; more than MAX_SUMMARY_EMOJI keeps the last ones after "…". */
export function pointSymbols(points: readonly Seat[], playerSeat: Seat): string;
/** "Gravity Duel · 🟦🟥🟦🟦 · 10–7", the player's score first. */
export function shareLine(points: readonly Seat[], playerSeat: Seat): string;
/** Solo docking: "Gravity Duel · 7 docks" (1 dock: "1 dock"). */
export function soloShareLine(docks: number): string;

// tracker.ts
export interface MatchCircumstances {
  readonly channel: GravityChannel;
  /** The player's seat; null when nobody is a person (a Kids-only demo). */
  readonly playerSeat: Seat | null;
  readonly rival:
    | { readonly kind: 'kid'; readonly kid: KidId }
    | { readonly kind: 'person' }
    | { readonly kind: 'nobody' };
  readonly switches: readonly [SwitchPosition, SwitchPosition];
}
export interface ProgressTracker {
  /** Every engine event, in order, with the match as it stands after the tick. */
  hear(event: MatchEvent, match: Readonly<Match>): void;
  /** Called once after every engine tick, after its events were heard. */
  observe(match: Readonly<Match>): void;
  /** Den Life events produced since the last call, oldest first. */
  drain(): GameEvent[];
}
export function createProgressTracker(circumstances: MatchCircumstances): ProgressTracker;
```

## Behaviour and edge cases

**Events** (`GRAVITY_EVENTS`; every field a 'number' unless marked):

| type         | description (write it as one plain sentence)     | fields                                                                              |
| ------------ | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `point-won`  | The player scores a point.                       | `bend` (degrees, whole, 0 if not a missile hit), `afterCloak` (1/0), `frugal` (1/0) |
| `point-lost` | The rival scores a point.                        | none                                                                                |
| `dock`       | The player docks with a pod.                     | `inMatch` (docks so far this match, this one included), `switchA` (1/0)             |
| `near-star`  | A stretch of flying close to the star has ended. | `seconds` (whole seconds of the stretch)                                            |
| `refuel`     | The player's ship touched the starbase.          | `speed`                                                                             |
| `match-won`  | The player wins a match.                         | `duel` (1/0), `vsKid` (1/0), `fuelLeft`, `louOrbit` (1/0), `kid` ('string')         |
| `match-lost` | The player loses a match.                        | `kid` ('string')                                                                    |

Factories turn booleans into 1/0, and `bend` into whole degrees (`Math.round(Math.abs(rad) × 180 / π)`).

**Patches** (`GRAVITY_PATCHES`), exactly these ids, tiers, titles and descriptions:

| id              | tier   | title         | description                                                                                                | goal                           |
| --------------- | ------ | ------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `first-contact` | club   | First Contact | Win any duel.                                                                                              | max `match-won.duel` ≥ 1       |
| `soft-touch`    | club   | Soft Touch    | Dock five pods in one match.                                                                               | max `dock.inMatch` ≥ 5         |
| `ghost-kill`    | pro    | Ghost Kill    | Score within a second of dropping your cloak. Opens Asteroid Belt.                                         | max `point-won.afterCloak` ≥ 1 |
| `fuel-miser`    | pro    | Fuel Miser    | Win a duel with six or more fuel segments left. Opens Last Fuel.                                           | max `match-won.fuelLeft` ≥ 6   |
| `soft-dock`     | pro    | Soft Dock     | Dock ten times with your switch on A. Opens Comet.                                                         | sum `dock.switchA` ≥ 10        |
| `lous-orbit`    | legend | Lou's Orbit   | Beat Grandpa Lou on The Star · Wraparound with your switch on A. Opens Binary Stars.                       | max `match-won.louOrbit` ≥ 1   |
| `slingshot`     | secret | Slingshot     | Hit your rival with a missile the star bent through at least 90°. (hint: Aim where the star will send it.) | max `point-won.bend` ≥ 90      |
| `hot-landing`   | secret | Hot Landing   | Hit the starbase at top speed and live. (hint: The station never checks your speed.)                       | max `refuel.speed` ≥ 56        |

**Micro-challenges** (`GRAVITY_MICRO_CHALLENGES`, 45 seconds each):

| id            | channel   | title            | goal line                                   | pass                         |
| ------------- | --------- | ---------------- | ------------------------------------------- | ---------------------------- |
| `dock-three`  | `game-14` | Three docks      | Dock 3 pods                                 | count `dock` ≥ 3             |
| `star-point`  | `game-4`  | Round the star   | Score once with the star in play            | count `point-won` ≥ 1        |
| `star-sitter` | `game-4`  | Close to the sun | Fly 30 s close to the star without crashing | max `near-star.seconds` ≥ 30 |
| `light-touch` | `game-1`  | Light touch      | Win a point with 5 s of thrust or less      | sum `point-won.frugal` ≥ 1   |

**Share:** 🟦 for the player's points and 🟥 for the rival's, in order; `MAX_SUMMARY_EMOJI` from
the kit caps the symbols (keep the last ones after "…", as Trailblaze does). The score is the
player's first, with an en dash: `10–7`.

**Tracker** (from the player's side; with `playerSeat` null it produces nothing):

1. `scored` for the player gives one `point-won`; for the rival, one `point-lost`. Its fields
   come from what happened this tick:
   - `bend` is from the player's `hit` event in the same tick, if any;
   - `afterCloak` is 1 when the player's last `cloak` event with `on: false` was at most 50
     ticks (one second) before this tick;
   - `frugal` is 1 when the player has thrust on at most 250 ticks (five seconds) so far this
     match, counting a tick when the player's ship has `thrusting` true in `observe`.

   Hear every event of a tick before deciding, then emit in `observe`: a `hit` and its `scored`
   arrive in the same tick, but not always in that order.

2. `docked` for the player gives `dock` with `inMatch` (the player's docks so far this match) and
   `switchA` (the player's switch is 'A').
3. **Near the star**, on channels whose centre is the star, in `observe`:
   - A stretch runs while the player's ship is present, not cloaked, and within 20 steps of the
     middle (`CENTRE_X`, `CENTRE_Y`; subpixels divided by `SUBPIXELS`).
   - When a stretch ends (the ship moves out, crashes into the star, or the match ends), emit
     `near-star` with its whole seconds if at least 1.
4. `refuelled` for the player gives `refuel` with the event's `speed`.
5. **The match ending**: `over` with the player's seat as winner gives `match-won`; with the
   rival as winner gives `match-lost`; a draw gives neither.
   - `duel` is 1 when the channel's mode is 'duel'.
   - `vsKid` is 1 against a Kid.
   - `fuelLeft` is the player's `fuel` in a duel, else 0.
   - `louOrbit` is 1 when the rival is the Kid 'lou', the channel is `game-5` and the player's
     switch is 'A'.
   - `kid` is the Kid's id or ''.
6. `drain` returns the queued events and empties the queue.

## Tests required

- `events.test.ts`:
  - the schemas declare every field the patches and micro-challenges read, checked with the
    kit's `validatePatches` (or the game-definition validator the kit offers for events and
    patches together);
  - factories turn booleans into 1/0 and radians into whole degrees.
- `share.test.ts`:
  - the symbols run from the player's side;
  - the line has the player's score first;
  - long matches keep the last symbols after "…";
  - the solo line says "dock" or "docks".
- `tracker.test.ts`, driving the tracker with hand-built events and a minimal hand-built `Match`
  (only the fields the tracker reads):
  - a player's point and a rival's point;
  - `bend` from a hit in the same tick, whichever order the events came in;
  - `afterCloak` within and beyond 50 ticks;
  - `frugal` at 250 and at 251 thrust ticks;
  - dock counting and switch A;
  - a near-star stretch ending by moving away, by a star crash, and by the match ending;
  - refuel speed;
  - match won with Lou's Orbit;
  - match lost;
  - nothing at all for a Kids-only demo.

## A known gap

The game's engine is still being written: `src/engine/match.ts` does not exist yet, so a
typecheck of the whole project reports errors in `src/dev/wire.ts`. That is expected; do not try
to fix it, and do not import `match.ts`. Your files only need `types.ts` and `channels.ts`.

## Out of scope

The session, the controller, the screens, the records screen and the Hall. Do not change
`types.ts`, `channels.ts` or anything outside the fence.
