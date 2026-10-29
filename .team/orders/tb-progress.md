---
id: tb-progress
kind: engine
model: gemini-3.8-flash-high
fence:
  - games/trailblaze/src/channels.ts
  - games/trailblaze/src/progress/**
  - games/trailblaze/tests/channels.test.ts
  - games/trailblaze/tests/progress/**
acceptance:
  - pnpm exec vitest run --project trailblaze games/trailblaze/tests/channels.test.ts games/trailblaze/tests/progress
  - pnpm exec eslint games/trailblaze/src/channels.ts games/trailblaze/src/progress games/trailblaze/tests/channels.test.ts games/trailblaze/tests/progress
  - pnpm exec prettier --check games/trailblaze/src/channels.ts games/trailblaze/src/progress games/trailblaze/tests/channels.test.ts games/trailblaze/tests/progress
  - pnpm exec tsc -p games/trailblaze/tsconfig.json
reads:
  - games/trailblaze/src/engine/types.ts
  - games/trailblaze/src/engine/variations.ts
  - games/trailblaze/src/engine/grid.ts
  - games/trailblaze/src/session/match-session.ts
  - games/trailblaze/src/session/trap.ts
  - games/hot-and-cold/src/channels.ts
  - games/hot-and-cold/src/progress/events.ts
  - games/hot-and-cold/src/progress/patches.ts
  - games/hot-and-cold/src/progress/micro.ts
  - games/hot-and-cold/src/progress/tracker.ts
  - packages/kit/src/channels.ts
  - packages/kit/src/patches.ts
  - packages/kit/src/micro.ts
  - packages/kit/src/events.ts
  - packages/kit/src/share.ts
---

## Goal

Trailblaze's channels, patches, micro-challenges, Den Life events and share line: the pure logic
the menus, results screen and the Hall read. Hot & Cold already has the same five pieces
(`src/channels.ts`, `src/progress/*.ts`); follow its structure, naming and comment style closely.
No DOM, no storage, no randomness.

## 1. Channels — `src/channels.ts`

```ts
export interface TrailblazeChannel {
  readonly def: ChannelDef; // from the kit
  readonly rules: VariationRules; // remix rules included
  /** 4 only for Four Way; every other channel is a duel. */
  readonly riders: 2 | 4;
}
export const CHANNELS: readonly TrailblazeChannel[];
export function channelById(id: string): TrailblazeChannel | undefined;
/** The four facts every channel shows as icons. */
export interface ChannelFacts {
  readonly speed: 'constant' | 'speed-up';
  readonly edges: 'bordered' | 'wraparound';
  readonly steering: 4 | 8;
  readonly fire: 'none' | 'gaps' | 'erase';
}
export function channelFacts(channel: TrailblazeChannel): ChannelFacts;
```

The 14 originals, in cartridge order, id `game-<n>`, `kind: 'original'`, `originalGame: [n]`,
rules from `variationRules(n)`. Use exactly these titles, groups and descriptions:

| n   | Title                   | Group      | Description                                                        |
| --- | ----------------------- | ---------- | ------------------------------------------------------------------ |
| 1   | Classic                 | Bordered   | Two riders, solid walls, a steady pace. First to ten.              |
| 2   | Classic vs Computer     | Bordered   | The old machine takes the left rider. Steady pace, solid walls.    |
| 3   | Speed-Up                | Bordered   | The pace climbs every five seconds until the arena is a blur.      |
| 4   | Speed-Up vs Computer    | Bordered   | The old machine at a climbing pace.                                |
| 5   | Eight Ways              | Bordered   | Diagonals open up: cut corners and slip between trails.            |
| 6   | Eight Ways · Speed-Up   | Bordered   | Diagonals and a climbing pace.                                     |
| 7   | Eight Ways · Gaps       | Bordered   | Hold fire to leave holes in your trail. Diagonals, climbing pace.  |
| 8   | Wraparound              | Wraparound | No walls at the edges: ride off one side and in at the other.      |
| 9   | Wrap · Speed-Up         | Wraparound | Open edges at a climbing pace.                                     |
| 10  | Wrap · Eight Ways       | Wraparound | Open edges and diagonals at a steady pace.                         |
| 11  | Wrap · Eight · Speed-Up | Wraparound | Open edges, diagonals and a climbing pace.                         |
| 12  | Wrap · Eight · Gaps     | Wraparound | Everything at once: open edges, diagonals, gaps, a climbing pace.  |
| 13  | Doodle                  | Doodle     | Draw with your trail; hold fire to rub it out. No walls, no score. |
| 14  | Doodle · Eight Ways     | Doodle     | Draw in eight directions; hold fire to rub it out.                 |

Then the five Remix channels, `kind: 'remix'`, group `Remix`, each built on variation 1's rules
(`{ ...variationRules(1), remix: {...} }`) unless the table says otherwise. Durations in ticks
(50 per second):

| id              | Title           | unlockedBy      | Rules                     | Description                                                                 |
| --------------- | --------------- | --------------- | ------------------------- | --------------------------------------------------------------------------- |
| fading-trails   | Fading Trails   | boxed-in        | `fadeAfter: 400`          | Trails melt away eight seconds after you lay them.                          |
| shrinking-arena | Shrinking Arena | clean-sweep     | `shrinkEvery: 300`        | The walls close in one cell every six seconds.                              |
| boost-lanes     | Boost Lanes     | old-machine     | `boostLanes: BOOST_LANES` | Glowing lanes on the floor double your speed while you ride them.           |
| four-way        | Four Way        | faster-than-lou | variation 1, `riders: 4`  | Four riders, one from each corner. Last one riding scores.                  |
| ghost-trails    | Ghost Trails    | faster-than-lou | `ghostAfter: 150`         | Trails turn invisible after three seconds but stay solid. Ride from memory. |

`BOOST_LANES` (export it): four straight lanes, our own layout, symmetric about the arena's centre
so neither start side is favoured: rows 5 and 14, columns 8 to 31 inclusive; and columns 13 and
26, rows 8 to 11 inclusive. As `Cell[]` via `cellAt` from `engine/grid.ts`, no duplicates.

Every `def` must pass the kit's channel validation (title ≤ 24 characters, description ≤ 90,
group ≤ 20). `channelFacts` reads `rules`.

## 2. Events — `src/progress/events.ts`

What the game tells Den Life about **the player's rider** (the person; in a two-person match, the
right rider, engine seat 1). Declare `TRAILBLAZE_EVENTS: readonly GameEventSchema[]` and one small
builder function per event, as Hot & Cold does:

| type              | fields                                                                                                                                                                                                                                       | when                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `point-won`       | `pocket` (trap pocket size, 0 if not a trap), `boxedIn` (1 when the pocket is 1–10 cells), `trappedDee` (1 when won by a trap of any size against Dee), `ghostPass` (1/0), `wraparound` (1/0)                                                | the player's rider takes a point alone                                                  |
| `point-lost`      | —                                                                                                                                                                                                                                            | the rival takes a point alone                                                           |
| `ride`            | `seconds`, `speedUpSeconds` (= seconds on a speed-up channel, else 0), `topSpeedSeconds`                                                                                                                                                     | after each point: how long the player rode in it, and how long of that at the top speed |
| `solo-cells`      | `cells`                                                                                                                                                                                                                                      | riding alone, after each point: cells laid in it                                        |
| `match-won`       | `vsKid` (1/0), `shutout` (1/0, a 10–0 or 5–0 against a Kid), `computerOnA` (1/0, beat Computer 1977 whose switch was A), `louEightSpeedOnPlayerA` (1/0, beat Lou in an 8-way speed-up channel with the player's switch on A), `kid` (string) | the player wins a match                                                                 |
| `match-lost`      | `kid` (string)                                                                                                                                                                                                                               | the player loses a match                                                                |
| `doodle-exported` | `filledPercent` (0–100, share of open cells drawn)                                                                                                                                                                                           | the player exports a Doodle                                                             |

## 3. Patches — `src/progress/patches.ts`

`TRAILBLAZE_PATCHES: readonly PatchDef[]`, measured from the events above:

| id              | tier   | title           | description                                                                                               | goal                                                                             |
| --------------- | ------ | --------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| first-wall      | club   | First Wall      | Win a match against anyone.                                                                               | count `match-won` ≥ 1                                                            |
| long-ride       | club   | Long Ride       | Ride 60 seconds in one point on a speed-up channel.                                                       | max `ride.speedUpSeconds` ≥ 60                                                   |
| boxed-in        | pro    | Boxed In        | Win a point by shutting a rival in ten cells or fewer. Opens Fading Trails.                               | max `point-won.boxedIn` ≥ 1                                                      |
| clean-sweep     | pro    | Clean Sweep     | Win a match against a Kid without losing a point. Opens Shrinking Arena.                                  | max `match-won.shutout` ≥ 1                                                      |
| old-machine     | pro    | Old Machine     | Beat Computer 1977 with its switch on A. Opens Boost Lanes.                                               | max `match-won.computerOnA` ≥ 1                                                  |
| faster-than-lou | legend | Faster Than Lou | Beat Grandpa Lou in an eight-way speed-up channel with your switch on A. Opens Four Way and Ghost Trails. | max `match-won.louEightSpeedOnPlayerA` ≥ 1                                       |
| ghost-rider     | secret | Ghost Rider     | Win a point within a second of riding straight through your rival.                                        | max `point-won.ghostPass` ≥ 1; hint: "The old riders never quite touched."       |
| fine-art        | secret | Fine Art        | Export a Doodle that covers half the board.                                                               | max `doodle-exported.filledPercent` ≥ 50; hint: "Some trails are worth keeping." |

The kit's metrics read one numeric field, which is why the events carry derived fields such as
`boxedIn` and `speedUpSeconds`.

## 4. Micro-challenges — `src/progress/micro.ts`

`TRAILBLAZE_MICRO_CHALLENGES: readonly MicroChallengeDef[]`, 45 seconds each:

| id           | channel | title                | goal                         | pass                            |
| ------------ | ------- | -------------------- | ---------------------------- | ------------------------------- |
| top-speed-30 | game-3  | Hold on at top speed | Ride 30 seconds at top speed | max `ride.topSpeedSeconds` ≥ 30 |
| trap-dee     | game-1  | Box Dee in           | Shut Dee in a pocket once    | sum `point-won.trappedDee` ≥ 1  |
| fill-300     | game-1  | Fill 300 cells       | Lay 300 cells riding alone   | sum `solo-cells.cells` ≥ 300    |
| wrap-point   | game-8  | Win at the edges     | Win a point in wraparound    | sum `point-won.wraparound` ≥ 1  |

Validate them with the kit's validator in a test.

## 5. Tracker — `src/progress/tracker.ts`

Turns a running session into those events, as Hot & Cold's tracker does:

```ts
export interface MatchCircumstances {
  readonly channel: TrailblazeChannel;
  /** The player's rider; null when nobody is a person (a Kids-only demo). */
  readonly playerSeat: Seat | null;
  /** Who rides against the player. */
  readonly rival:
    | { readonly kind: 'kid'; readonly kid: KidId }
    | { readonly kind: 'computer' }
    | { readonly kind: 'person' }
    | { readonly kind: 'nobody' };
  readonly switches: readonly [SwitchPosition, SwitchPosition];
}
export interface ProgressTracker {
  /** Every session event, in order, with the match as it stands after it. */
  hear(event: SessionEvent, match: Readonly<Match>): void;
  /** Events produced since the last call, oldest first. */
  drain(): GameEvent[];
}
export function createProgressTracker(circumstances: MatchCircumstances): ProgressTracker;
```

- A point is decided by a `crash` event (`crashes` lists who crashed): if only the rival crashed,
  the player won the point; a crash of both is neither won nor lost.
- `pocket`: the size of the latest `trap` event this round whose `seat` is the rival, else 0.
- `ghostPass`: in a `step`, the two riders' moves swap cells (`a.from === b.to && b.from === a.to`)
  or end on the same cell; remember the tick, and a point the player wins within 50 ticks of it
  counts.
- `ride`: running ticks of the round until the player's rider crashed or the round ended, in
  seconds; `topSpeedSeconds` counts ticks while `match.stepPeriod === 3`.
- `match-won` / `match-lost` on the `over` event from `match.winner` (nothing for a tie or solo).
- Nothing is produced when `playerSeat` is null.

## 6. Share line — `src/progress/share.ts`

```ts
/** One symbol per point from the player's side: 🟦 the player, 🟥 the rival, ⬜ both crashed. */
export function pointSymbols(points: readonly PointTaker[], playerSeat: Seat): string;
/** `Trailblaze · 🟦🟦🟥⬜🟦 · 10–6`, the player's score first. The Hall adds the collection prefix. */
export function shareLine(points: readonly PointTaker[], playerSeat: Seat): string;
```

Use the kit's `MAX_SUMMARY_EMOJI`: when there are more points than that, keep the last ones and
start the symbols with `…`. Check with `emojiSummary` in a test that the kit can read the line back.

## Tests required

- `tests/channels.test.ts`: 19 channels; ids unique and as listed; every def passes the kit's
  validation; facts for 1, 7, 12, 13; every Remix `unlockedBy` names a patch in
  `TRAILBLAZE_PATCHES`; `BOOST_LANES` is symmetric under a 180° turn about the centre and has no
  duplicates.
- `tests/progress/`: patches validate with the kit and each opens what its description says;
  micro-challenges validate; the tracker, fed scripted session events (build them by hand or by
  running `createMatchSession` with scripted drivers), produces: a point won by a trap of 9 cells
  (boxedIn), a point lost, a shared crash (no event), ghostPass on a swap 30 ticks before the point
  and not 80 ticks before, ride seconds and top-speed seconds, match-won with each flag, nothing
  for `playerSeat: null`; the share line for 10–6 and for a long match with `…`.

Keep the suite under 5 s.

## Out of scope

Screens, storage, the Hall, sound, the engine's Remix rules (another order implements them; you only
declare them), and anything outside the fence.
