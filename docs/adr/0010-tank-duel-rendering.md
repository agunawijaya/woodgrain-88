# ADR-0010 — Tank Duel rendering

- Status: accepted (prompt 02; the owner approved the hero frames on 2026-10-26)
- Date: 2026-10-26
- Code: `games/tank-duel/src/render/*`, `games/tank-duel/src/session/match-session.ts`,
  `games/tank-duel/src/ui/hud.ts`, `games/tank-duel/src/screens/*`

## Context

The 1977 duel drew two blocky vehicles on a flat field. Tank Duel shows the same rules as a living
miniature diorama. That has to stay fair and readable:

- both seats see the whole board with equal clarity;
- a hidden vehicle leaves no trace;
- a hit is the most exciting thing on screen.

It also has to hold 60 fps at 1080p on a mid-range laptop.

## Decisions

### The engine is the truth; the view follows it

- `createMatchView` turns engine states and events into the scene.
- **Between steps:**
  - vehicles are eased between the last two states;
  - headings ease towards each new sixteenth step, so turning keeps the 1977 rhythm without
    juddering;
  - a vehicle that wrapped round the sky is not eased across the board.
- **Events become effects.** A shot gives a muzzle flash and a barrel kick, a bounce gives sparks,
  a scoring bank shot gives its glowing path, and a hit gives an explosion, scorch, spin and the
  shooter's twitch.

### Nothing hidden reaches the screen

- The view draws a vehicle only when `isRevealed` says the rules allow it. An invisible tank draws
  no model, no shadow, no dust and no tread marks, and makes no sound.
- A test holds the view to this, and the AI perceives through the same function.

### One stage per visit, one view per match

- **Stage.** The controller creates one arena stage when the game mounts. The menu's idle duel,
  the pre-match table, the match and the results replay all draw on it.
- **View.** Each match builds its own view (board, models, effects) and disposes it afterwards. An
  appearance change rebuilds the view and swaps the stage's light rig.
- **Den TV.** Its picture is a separate low-quality stage at the TV's size, with a fixed picture
  size and a readable drawing buffer for the CRT to copy.

### Models are code

- Each vehicle is built from primitives and lathe profiles with a drybrush paint shader. The tank
  has a hull, turret, barrel, tracks with moving treads, and an antenna; the biplane has struts and
  a spinning propeller; the jet has afterburner glow; the bomber is a big twin-engined biplane with a glazed nose.
- **Team colours.** Each tank is painted olive or desert with a bright team trim, orange or sky
  blue, which stays distinct for common colour blindness. A colour-blind-safe pair is a setting.
- **Aircraft paint** is matt, so the table's reflections never wash the team colour out from
  above.

### Screens are DOM over the canvas

- **HUD and screens.** The HUD (enamel score plates and a burning-fuse clock) and every screen are
  plain DOM layered over the stage. They are styled with shared `--td-*` tokens and designed
  separately for light and dark. That keeps text crisp, accessible, focusable and translatable.
- **Hall chrome.** The score plates keep clear of the Hall's pause button. The screens start below
  its Back and channel controls.

### The replay

- `session/replay.ts` keeps the last few seconds of states and turns the best hit into a clip:
  most bounces first, seat 1 preferred.
- The results screen loops the clip on the same view, so the explosion and the bank path replay
  exactly as they happened.

## Consequences

- Rules can change without touching the view, and the view can change without touching the rules.
- Any number of matches can run headless for the balance work.
- The look depends on WebGL. The game is playable at the low quality tier, but needs a GPU; the
  Hall itself does not.
