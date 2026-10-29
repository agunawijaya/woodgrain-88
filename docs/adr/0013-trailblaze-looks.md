# ADR-0013 — Trailblaze: four looks over one rig

- Status: accepted (prompt 04)
- Date: 2026-10-29
- Code: `games/trailblaze/src/look/` (the shared rig), `games/trailblaze/src/looks/<look>/` (Neon
  Grid, Toy Trains, Mummy's Wrap, Ice Trail)

## Context

Trailblaze ships four looks that the player can switch between, even mid-match. Each needs its own
riders, trails, arena, crash, watcher and sound, in a light and a dark version. The rules, timing
and controls must not care which look is on. The owner's art review asked for three things every
look must do: trails that read as solid walls, turns that curve the way the rider would move (a
bike leans through a bend, a mummy turns as a person walking does), and a crash with its own
character. The full board (684 cells) must stay cheap.

## Decisions

- **One rig, four sets of parts.** `look/trail-rig.ts` turns match events into motion:
  - which cell is being crossed and how far along;
  - when a crossing becomes laid trail;
  - when a crash plays, and where.

  A look only supplies parts (`LookParts`):
  - its world;
  - its trail pieces (`TrailPieces`: add, remove, the tail being drawn);
  - its rider figures (`RiderFigure`: ride, crash, reset);
  - its crash and trap effects;
  - its colours for the Remix walls and lanes.

  All four looks share the timing, the curves and the event mapping, so they behave identically.

- **Crossings are curves.** A rider crosses each cell along a quadratic curve from the edge it came
  in by, through the centre, to the edge it leaves by. Trails are built the same way: a
  cross-section swept along the curve (`look/sweep.ts`, `look/swept-trail.ts`). A straight cell and
  a right-angle turn are shared instanced pieces; other turns are approximated.
- **The picture runs one step behind the rules.** A rider crosses a cell during the step after the
  rules moved it, so the curve can follow the turn the rules have just applied. Rules, input and AI
  are not affected. The cost is about one cell of visual lag: 0.3 s at the starting speed, 0.06 s
  at top speed. NOTES.md keeps this as an open question for the feel pass.
- **A view can be swapped mid-match.** `MatchSession.setView` draws a new view up to where the match
  stands, from the round's trail as laid. Changing look or appearance builds a new view, and
  nothing in the match restarts.
- **Light and dark are designed separately.** Each look builds its materials and lighting for one
  appearance; switching appearance builds the view again rather than tinting it.
- **Remix pieces are shared.** Shrinking walls and boost lanes are the same shapes in every look,
  coloured by the look (`look/remix-pieces.ts`). Ghost Trails is a rig rule: trail older than the
  limit is taken out of the picture and stays in the rules.
- **The Chase camera moves the world, not the camera.** The arena package's table camera is fixed,
  so `look/chase-camera.ts` slides the view under it and tightens the framing.

## Consequences

- A fifth look means one new folder of parts; the rig, the session and the tests are untouched.
- Four Way needs four rider figures and four trail styles per look. The rig and the parts take a
  list of seats, not a pair.
- The visual lag is a deliberate trade for curves. If the feel pass finds it too much, the rig can
  start a curve as soon as a turn is latched, before the step, without touching the rules.
- A full board (684 cells) holds 60 fps at 1080p on a laptop RTX 4060 in every look. On an
  integrated Intel GPU the stage itself, not the trails, limits it to 15–24 fps on High (NOTES.md,
  Performance), so the quality setting is the lever there.
