---
id: tb-controller
kind: plumbing
model: gemini-3.8-flash-high
fence:
  - games/trailblaze/src/app/**
  - games/trailblaze/src/module.ts
  - games/trailblaze/src/screens/**
  - games/trailblaze/src/ui/**
  - games/trailblaze/tests/app/**
  - games/trailblaze/tests/screens/**
acceptance:
  - pnpm exec vitest run --project trailblaze games/trailblaze/tests
  - pnpm exec eslint games/trailblaze/src games/trailblaze/tests
  - pnpm exec prettier --check games/trailblaze/src games/trailblaze/tests
  - pnpm exec tsc -p games/trailblaze/tsconfig.json
reads:
  - games/hot-and-cold/src/app/controller.ts
  - games/hot-and-cold/src/module.ts
  - games/hot-and-cold/src/app/settings.ts
  - games/hot-and-cold/tests
  - games/trailblaze/src/manifest.ts
  - games/trailblaze/src/channels.ts
  - games/trailblaze/src/demo/demo.ts
  - games/trailblaze/src/dev/play.ts
  - games/trailblaze/src/session/match-session.ts
  - games/trailblaze/src/session/controls.ts
  - games/trailblaze/src/look/look.ts
  - games/trailblaze/src/look/looks.ts
  - games/trailblaze/src/look/chase-camera.ts
  - games/trailblaze/src/look/seats.ts
  - games/trailblaze/src/audio/match-sound.ts
  - games/trailblaze/src/ai/kid.ts
  - games/trailblaze/src/ai/computer-1977.ts
  - games/trailblaze/src/progress
  - games/trailblaze/src/doodle
  - games/trailblaze/src/app/settings.ts
  - games/trailblaze/src/app/save.ts
  - packages/kit/src/contract.ts
  - packages/kit/src/run.ts
  - packages/kit/src/share.ts
---

## Goal

The controller that makes Trailblaze a game in the Hall: `mountTrailblaze(host, context)` and
`src/module.ts`. Port Hot & Cold's `app/controller.ts` and `module.ts`: the same structure, the
same use of the kit's `GameContext` (loops, pause, settings, save, records, `reportResult`,
`share`, `setView`, `setPauseItems`, `emit`), the same run handling (free play, daily, challenge,
micro), and the same tests' approach. Then change what this order says. `src/dev/play.ts` already
runs a whole match end to end (session, look, view, controls, Kids, Computer 1977, Chase camera):
use it as the reference for the play part.

This order is the core: menu, pre-match, play, results, settings, progress, sound and runs, for
the duel channels 1–12. A second order (`tb-controller-extras`) adds the pause items, Doodle,
"How Rosa saw it" and Four Way, so leave clear seams for them (a `startMatch(plan)` function, a
results builder that takes optional extra panels) and do not stub them out with placeholders.

## Flow

1. **Game menu** (`screens/menu.ts`) over a live demo duel in the chosen look: two Kids (the
   picked opponent against Moss, or Rosa against Moss when the picked one is Moss) riding the
   selected channel, silent, no HUD. Changing the look rebuilds the stage behind the menu.
2. **Pre-match** cards, then Enter or Space, 3-2-1 (`setCount`), then play.
3. **Play**: a `MatchSession` with the look's view, `createPlayerControls(context.input)` for the
   people, `createKidRider` for a Kid, `createComputer1977(lookaheadFor(switch))` as the left
   seat's pilot on channels 2 and 4. People: one person rides the right rider (arrows); two people
   split the keyboard (left rider WASD, right rider arrows). The HUD shows tallies, speed pips and
   each person's queued turn (the rider's `latched` heading until the step takes it).
   The loop is `context.createLoop({ hz: 50, update: session.advance(dt), render })`.
4. **Point moments** come from the session's events through the view (already done by the
   session); the HUD ticks the scorer's tally and shows a short message for a trap.
5. **Results** (`screens/results.ts`) when the match is over (after the freeze holds for 1.2 s):
   score line, longest ride, cells per rider, traps, patches, "How Rosa saw it", Play again (R),
   Game menu, Back to the Hall (H), Share. `reportResult` with `presentation: 'game'`, the
   player's score, and the emoji summary from `progress/share.ts`. Leave the "How Rosa saw it"
   panel out for now (the screen hides it when it gets no frames).

## Details

- **Switches** are the console's: read `context.difficulty.get()` when a match starts and map
  left/right to engine seats 0/1. Remove `switches` from `TrailblazeSettings` (and its tests), and
  make the menu's switch row display-only text, as Tank Duel's menu shows it.
- **Settings** (`createTrailblazeSettings` on the kit store Hot & Cold uses): look, match length
  (the session's `target`), colour-blind (`seatColours('colour-blind')` for the views, HUD and
  results), reduced effects (and always when `prefers-reduced-motion`), camera. Camera Chase
  applies only with exactly one person riding; otherwise Overhead.
- **Progress**: feed every session event and the match to `createProgressTracker`, `emit` what it
  drains. Record the finished match with `recordMatch` and write the save.
- **Sound**: `src/audio/` is ready. Create one `createMatchSound(context.audio, look)` per match,
  feed it every session event with the match, call `countdown(n)` at each pre-match count (0 for
  go), `setLook` on a look change, and `quiet()` on pause, results and leaving.
- **Runs**: daily and challenge use the run's channel and seed against the Kid the run names (or
  Rosa); micro-challenges start their channel directly, alone or against Dee as the challenge says,
  and end when the kit's micro run ends.
- `module.ts`: `manifest`, `TRAILBLAZE_PATCHES`, `TRAILBLAZE_MICRO_CHALLENGES`, `howToPlay`
  (goal: "Steer a rider that never stops. Every cell it leaves becomes a wall: make your rival hit
  one first." controls from the manifest, tips below), `mount: mountTrailblaze`,
  `demo: createTrailblazeDemo`. Tips, exactly:
  - "Turn early at speed: the faster it gets, the more cells pass before your hands react."
  - "Cut across your rival a few cells ahead of their bike, never right in front of it."
  - "Claim the big side first, then fill your own space tightly along the walls."
  - "On wraparound channels the edges are open: a rival can come at you from behind."
  - "Switch A makes turning straight back crash you; switch B ignores it."

## Tests required (`tests/app/`, happy-dom; fake context as Hot & Cold's controller tests use)

- Mount shows the menu; Escape asks to go back to the Hall.
- A vs-Kid match on channel 1 runs to its end with a scripted person (idle) and reports one result
  with `presentation: 'game'` and the share line.
- Computer 1977 pilots the left rider on channel 2; the console's switch A gives it lookahead 6.
- Settings: match length 5 ends a match at 5; colour-blind changes the HUD colours.
- `leaveCheck` is 'would-lose-progress' mid-match and 'safe' on the menu.

Rendering in tests: stub `createLookStage`/views as Hot & Cold's tests stub its looks; no WebGL.

## Out of scope

The engine, the session, the looks and views, the sound palettes in `src/audio/`, and the Hall's
own files. If a module
outside the fence needs a change, say so in the report.
