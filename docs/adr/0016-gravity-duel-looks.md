# ADR-0016 — Gravity Duel: four looks over one space rig

- Status: accepted (prompt 05)
- Date: 2026-10-30
- Code:
  - `games/gravity-duel/src/look/`: the contract, the space rig, cameras, the keeper;
  - `games/gravity-duel/src/looks/<look>/`: Deep Space, Brass Orrery, Paper Sky, Whirlpool.

## Context

Gravity Duel ships four looks the player can switch between. Each has light and dark versions,
and each must draw:

- two ships that read from overhead, told apart by outline as well as colour;
- missiles and their trails, with the bank shot as the signature moment;
- the star, the starbase or the beacon;
- docking pods;
- the cloak's shimmer;
- the Remix bodies;
- a burst for every kind of explosion.

The physics and timing must not care which look is on: a ship at (x, z) sits at the same spot on
the table in all four.

## Decisions

- **One contract, one rig.** `look/look.ts` is the contract:
  - each frame the session hands the view a `SceneFrame`: poses for ships, missiles, pods, guides
    and Remix bodies, interpolated between ticks, never across a wrap;
  - the match's moments arrive as `ViewMoment`s at a spot on the table.

  `look/space-rig.ts` does what every look does the same way:
  - places figures;
  - lays and releases trails;
  - spins a hit ship for the cartridge's 64 frames;
  - fades a cloaking ship;
  - draws the trajectory guide's dots.

  A look only supplies parts (`LookParts`): its world, ships, missiles, trails, pods, burst, and
  optional handlers for moments and Remix bodies.

- **Explosions are one moment family.** A missile hit, a self-hit on switch A, a star crash and a
  cloak burnout all burst and spin the ship. The rest (fired, swallowed, refuelled, docked) are
  each look's own small effects.
- **The middle is part of the look's world:**
  - the star is lethal and looks it (a living star, a filament bulb, a smiling sun, a vortex's
    eye);
  - the beacon is harmless and looks it (a violet gyroscope, a lodestone, a magnet, a lighthouse
    rock);
  - the starbase looks like home (a ring station, a gear hub, a moon with a door, a supply buoy).
- **Sizes follow readability, then the rules.**
  - Ships are drawn 2.5–2.9 units long on a 32-unit field (a twelfth of it), pods about 1.5 times
    their touching circle.
  - The engine's touching circles follow the drawings (ship 4 steps, the middle 5), and ships
    bounce 6 steps from the walls so a nose meets the quay instead of poking through it.
- **Cameras never move.** `look/cameras.ts` shrinks the framing and slides the world instead, for
  Follow and for the hit nudge, as Trailblaze's chase does.
- **Night glow without NaNs.** The arena's glow ribbon raised `1 − fade` to a power; at a fully
  faded tail, interpolation could take the base a hair below zero. On Direct3D that is a NaN, and
  the bloom spread it over whole frames, so the screen went black for half a second after shots
  at night. The shader now clamps the base. The same fix went into the arena's explosion ring.

## Consequences

- A fifth look means one folder: its world, its ships and its moments. Nothing in the session or
  the engine changes.
- Paper Sky boils its drawings at eight frames a second. Its frame index must never go negative:
  a material first compiled without its map keeps rendering without it.
- The looks draw no HUD; the bars' style per look lives in the HUD's CSS.
