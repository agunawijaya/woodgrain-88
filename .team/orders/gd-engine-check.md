---
id: gd-engine-check
kind: engine
member: deepseek-pro
fence:
  - games/gravity-duel/tests/hooks.test.ts
  - games/gravity-duel/docs/engine-check.md
acceptance:
  - pnpm exec vitest run --root games/gravity-duel tests/hooks.test.ts
  - pnpm exec eslint games/gravity-duel/tests/hooks.test.ts
  - pnpm exec prettier --check games/gravity-duel/tests/hooks.test.ts games/gravity-duel/docs/engine-check.md
reads:
  - research/dossiers/16-gravity-duel.md
  - games/gravity-duel/docs/NOTES.md
  - games/gravity-duel/src/engine/types.ts
  - games/gravity-duel/src/engine/physics.ts
  - games/gravity-duel/src/engine/match.ts
  - games/gravity-duel/src/engine/variations.ts
  - games/gravity-duel/tests/helpers.ts
---

## Goal

An independent check of Gravity Duel's engine against the verified behaviour. You did not write
this engine: read it fresh, as a reviewer. Produce two things:

- `tests/hooks.test.ts`: one test per hook and per surprising rule below, each driving the real
  engine (`createMatch`, `stepMatch`, with the builders in `tests/helpers.ts`) and proving the
  behaviour end to end, not by calling internals.
- `docs/engine-check.md`: a short Markdown report, in plain English:
  - every place where the engine and NOTES.md (or the dossier, where NOTES.md is silent) disagree;
  - anything the engine does that neither describes;
  - one line per hook with your verdict.

## What to check

NOTES.md is the specification and wins over the dossier where they differ (it corrects the
gravity law, adds the speed fold and the dead controls while cloaked). The engine also makes a
few decisions of its own, listed under NOTES.md "Engine decisions". Those are intended: note them
only if the code does not do what they say.

Hooks and rules to prove with a test each:

1. **The starbase speed check that can never fire.** A ship hitting the starbase at top speed (63
   units on an axis) refuels, rearms, goes home at rest and does not explode; the `refuelled`
   event reports its speed.
2. **Cloak fuel-out suicide.** Cloaking on the last segment blows the ship up and scores for the
   rival; so does the last segment burning away while cloaked; thrusting the last segment away
   does not.
3. **Mutual reload.** One empty ship stays empty while its rival still has missiles; both refill
   when a missile's countdown ends with both empty.
4. **Ships pass through each other.** Two ships on the same spot do nothing to each other.
5. **The speed fold.** A ship at 60 units firing straight ahead launches a missile that moves
   slower than the ship.
6. **Cloaked ships cannot steer, thrust or fire**, and their missile in flight cannot hit or be
   swallowed until they uncloak.
7. **A hit does not reload early.** After a hit, the next shot still waits the full 128 ticks
   from the last firing.
8. **The spinning victim.** Spins 64 ticks one step a tick, cannot be scored on again meanwhile,
   but can still thrust and fire.
9. **Self-hit.** Harmless for 8 ticks; then on switch A it explodes and the rival scores, on B
   the missile is just taken back.
10. **Gravity's rhythm.** Each body is pulled exactly once every 8 ticks, on odd ticks, in the
    order ship 0, ship 1, shot 0, shot 1.
11. **Docking tolerance.** On B a dock needs a whole-unit difference under 16; on A at most 1.
12. **Match end.** Ten points end it at once; the clock ends it after 35,840 ticks with a warning
    1,024 ticks before.

## Rules for you

- Do not change any file outside the fence: no engine changes. A test that exposes a real bug
  should fail; put `it.fails` on it with a comment naming the bug, and describe the bug in the
  report. The lead fixes the engine.
- Tests are deterministic (seeded, no wall clock), each named for the behaviour it proves.
- Write the report in plain English, short sentences, no filler.

## Out of scope

Kids, sessions, rendering, Remix rules.
