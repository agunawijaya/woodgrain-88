# Brief: Trailblaze crash camera push

For: engineer. Prompt: `prompts/04a-trailblaze-polish.md` §1.1, third bullet. The design below is
the director's and is final; if the code makes any part impossible, stop and report the question.
References: `CLAUDE.md`, `games/trailblaze/docs/ARCHITECTURE.md`, `games/trailblaze/src/look/chase-camera.ts`
(the model: the table camera cannot move, so the world slides under it and the framing shrinks).

Stay inside: `games/trailblaze/src/look/crash-push.ts` (new), `games/trailblaze/src/app/controller.ts`,
`games/trailblaze/src/dev/hero.ts`, `games/trailblaze/tests/crash-push.test.ts` (new). Another
session edits `games/trailblaze/src/looks/**`, `src/look/trail-rig.ts` and the riders at the same
time: do not touch them. In `controller.ts`, do not touch the Kid-rider lines (`driverFor`'s
`createKidRider` call, the results' `kids` / `withKidsMark`, `recordMatch`'s `memory`). Do not
commit or touch the git index.

## What the player sees

On every point, the picture pushes toward the crash: it eases in over 0.6 s, holds while the crash
plays, and eases back to the whole board before the next round starts. The board stays sharp and
fully readable: this is a framing move only, no blur, no tilt, no shake.

## `look/crash-push.ts`

- `pushWeight(seconds: number): number`, pure and exported: how far in the push is, `seconds` after
  the crash.
  - 0 → 0.6 s: eases from 0 to 1 (ease-in-out cubic);
  - 0.6 → 3.4 s: 1;
  - 3.4 → 4.2 s: eases from 1 back to 0 (ease-in-out cubic);
  - after 4.2 s: 0. The shorter crash pause is `SHORT_CRASH_PAUSE_TICKS / TICKS_PER_SECOND`
    (4.48 s), so the board is whole again before any restart.
- `PUSH_ZOOM = 1.5`: at full weight the framing is the overhead framing divided by 1.5 (width,
  depth and height, as Chase does with its zoom); in between, divide by `1 + (PUSH_ZOOM - 1) * w`.
- `createCrashPush(stage, currentView: () => TrailView, framing: TableFraming): CrashPush` with:
  - `start(seats: readonly Seat[])`: called on a crash. The focus is the crashed rider's drawn
    position (`view.riderPosition`), sampled now. Two or more riders at once: the midpoint of
    them, at a zoom of 1.25 rather than 1.5 so both stay in the picture. Clamp the focus as Chase
    does, using the full-weight zoom, so the board's edge never moves inside the picture's edge. A
    crash during a push carries on from the current weight and focus, with no jump.
  - `update(dt)`: once a frame; sets the framing and `view.root.position = -focus * w`.
  - `release()`: back to the overhead framing and the root at the origin.

## Wiring (`app/controller.ts`)

- A push exists for a ride only when the overhead camera shows the match: not with Chase (it is
  already close), not behind the menu, and never with reduced motion or reduced effects (the same
  flag the views get: `settings.get().reducedEffects || context.settings.reducedMotion()`).
- Start it from the session's crash events (the existing event hook), update it in `tick(dt)` after
  `session.advance`, and release it everywhere Chase is released or rebuilt (end of ride, camera
  or look change, view rebuild). A look change mid-push must leave no offset on the new view.
- The final point: the push may simply play; the results come after the freeze.

## Hero page (`src/dev/hero.ts`)

- On the `trap` scene, run the same push from the crash, driven by the page's own fixed ticks, so a
  `t` offset shows it at any moment. `&push=0` turns it off (for the old framing).
- Report, per look, the `t` at which the push is at its closest (weight 1 just reached) for the
  trap scene, given each look's reaction delay.

## Tests (`tests/crash-push.test.ts`)

`pushWeight`: 0 at 0, 1 from 0.6 to 3.4 s, 0 from 4.2 s, never outside 0–1, rising then falling,
and 0 before the short crash pause ends. The clamp keeps the framed area inside the board for a
crash in each corner.

## Checks

`pnpm exec tsc -p games/trailblaze`, `pnpm exec vitest run --project trailblaze`, `pnpm exec eslint`
and `pnpm exec prettier --check` on every file you touched. If tsc fails in `src/looks/**` or
`src/look/trail-rig.ts`, that is the other session's work in progress: report it, do not fix it.

Report back: files changed (one line each), the checks and their key output, the per-look `t`
values, anything not done, and any question you stopped at.
