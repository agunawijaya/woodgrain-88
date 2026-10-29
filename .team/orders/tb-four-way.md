---
id: tb-four-way
kind: engine
model: gemini-3.8-flash-high
fence:
  - games/trailblaze/src/engine/**
  - games/trailblaze/src/session/**
  - games/trailblaze/src/ai/kid.ts
  - games/trailblaze/src/sim/**
  - games/trailblaze/src/progress/tracker.ts
  - games/trailblaze/scripts/**
  - games/trailblaze/tests/engine/**
  - games/trailblaze/tests/session/**
  - games/trailblaze/tests/ai/**
  - games/trailblaze/tests/sim/**
  - games/trailblaze/tests/progress/**
acceptance:
  - pnpm exec vitest run --project trailblaze games/trailblaze/tests
  - pnpm exec eslint games/trailblaze/src games/trailblaze/tests games/trailblaze/scripts
  - pnpm exec prettier --check games/trailblaze/src games/trailblaze/tests games/trailblaze/scripts
  - pnpm exec tsc -p games/trailblaze/tsconfig.json
reads:
  - games/trailblaze/src/engine/types.ts
  - games/trailblaze/src/look/look.ts
  - games/trailblaze/src/look/trail-rig.ts
  - games/trailblaze/src/channels.ts
  - games/trailblaze/docs/NOTES.md
  - games/trailblaze/tests/ai/fixtures/duel-decisions.json
---

## Goal

Four Way, our fifth Remix: four riders, one from each corner, last one riding scores. The engine,
session, Kid rider, simulations and progress tracker must take up to four riders. **Duels must
behave exactly as today**: every existing test keeps passing, and the duel balance numbers do not
move (the Kid's choices in a duel must be the same as before, seed for seed).

The lead has already changed the contract in `engine/types.ts` (read it first):

- `Seat` is `0 | 1 | 2 | 3`. `SEATS` stays `[0, 1]` (the duel); `FOUR_WAY_SEATS` is `[0, 1, 2, 3]`.
- `MatchSetup.players` is `1 | 2 | 4`; `switches` and `pilots` are arrays with one entry per
  riding seat.
- `Match.riders` is a `readonly Rider[]` with one rider per riding seat (at least two, as today,
  so a solo match still has an idle seat 1).
- The `over` event's `scores` is a `readonly number[]`.

The views (`src/look`, `src/looks`), the dev pages, audio and Computer 1977 are the lead's and
already take the new contract: `ViewOptions.seats` is a list of colours (four in Four Way, from
`fourWayColours` in `look/seats.ts`), `players` may be 4, and a view places, moves and crashes any
seat. Do not edit them. Right now `tsc` fails only inside your fence (about 240 errors, most of them
`match.riders[seat]` now being possibly undefined, and 2-tuples that became lists): fix them all.
`stepMatch` should take `readonly Stick[]`, one per seat.

## Rules (engine)

1. **Starts** (`grid.ts`, export `FOUR_WAY_START`), symmetric under a half turn so every corner is
   alike: seat 0 at column 5, row 4, heading right; seat 1 at column 34, row 15, heading left; seat 2
   at column 34, row 4, heading down; seat 3 at column 5, row 15, heading up. Duels keep `START`.
2. Every rider moves, lays trail and crashes exactly as in a duel; still no rider-to-rider check.
3. **A crash does not end a Four Way round.** The crashed rider stops where it is (its trail stays)
   and the others ride on. The round ends on the step where at most one rider is still riding:
   - exactly one: that rider scores one point (a `crash` event for the step's crashes, then a
     `point` event for the survivor);
   - none (the last riders crashed together): nobody scores.
     Then the normal crash pause and a new round, or the match is over when someone reaches the
     target (the board freezes as on the cartridge's last point). Duels keep their own scoring.
4. The speed-up schedule, Remix rules (fading, shrinking, boost lanes) and steering work as in a
   duel. Shrinking walls can crash several riders on one tick; apply rule 3.
5. `winner` is the seat with the most points when the match ends; on a tie at the top, null.

## Session

- `drivers` becomes `readonly SeatDriver[]`, one per riding seat; each driver hears every tick.
- The view mapping is unchanged, extended to all riding seats (`placeRider` for each).
- Stats: `cellsLaid` per riding seat (`readonly number[]`); `points` records the scorer's seat, or
  `'both'` only in a duel (in Four Way a round where nobody scores records nothing).
- `spotTraps`: a rider is trapped when its reachable space is a sealed pocket of at most
  `TRAP_POCKET` cells holding no other riding rider's head; the seal is a cell laid this step by
  any other rider (else the nearest other rider's head).

## Kid rider (`ai/kid.ts`)

- Its "rival" is the **nearest riding opponent** by Chebyshev distance (wrapping on wraparound),
  chosen afresh at each decision; ties go to the lower seat. In a duel this is always the one other
  seat, so duel behaviour is unchanged.
- `keepClearOfRival` marks every riding opponent within awareness, not only the rival.
- Noticing turns: the Kid can notice a turn by any opponent (each turn goes through
  `reflex.notices`), and mirrors only its current rival's.
- Keep the module's style, names and comments; do not retune any constant.

## Simulations and progress

- `sim/duel.ts` keeps duels as they are; add `playFourWay({ seats: readonly Contender[] (4), seed,
target? })` returning the winner (or null), scores and rounds. Computer 1977 is not offered in
  Four Way (reject it with an error).
- `progress/tracker.ts`: in Four Way, `point-won` when the player's rider is the survivor,
  `point-lost` when another rider is; `match-won`/`match-lost` from `winner`; the duel-only
  fields (`boxedIn`, `trappedDee`, `ghostPass`) are computed against whichever rider the trap or
  pass involved, and stay 0 when unsure.

## Tests required

- Engine (`tests/engine/four-way*.test.ts`): starts; a crash leaves the others riding; the last
  survivor scores and the round ends on that step; two last riders crashing together score
  nobody; the target ends the match and freezes the board; the winner with a tie at the top is
  null; shrinking walls crashing two riders at once.
- Session: four drivers all asked each tick; `placeRider` for all four; traps in Four Way.
- Kid: nearest-rival choice (including a tie and wraparound); and duel behaviour unchanged: the
  lead recorded `tests/ai/fixtures/duel-decisions.json` before this order (Moss on seat 0 against
  Dee on seat 1, variation 3, the seeds in the file, Kids hearing every tick for 2000 ticks or
  until the match ends). Replay that duel and compare the first 30 `decided` entries of each Kid
  (`at`, `action`, `delayMs`) with the file. Never edit the fixture.
- Sims: `playFourWay` with four Kids finishes and is deterministic by seed.
- Every existing test passes untouched, except type-only edits where a 2-tuple became an array.

Keep new tests under 10 s.

## Out of scope

Views and looks, screens, the controller, channels (Four Way's channel already exists), Computer
1977's code, and anything outside the fence.
