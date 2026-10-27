# ADR-0009 — The arena package (`packages/arena`)

- Status: accepted (prompt 02)
- Date: 2026-10-26
- Code: `packages/arena/src/*`; first user `games/tank-duel/src/render/*`

## Context

Tank Duel is the collection's first 3D game. It is also the pilot for the other duel and arcade
games, which will want the same tabletop look:

- a painted miniature world on a table, seen from a fair, tilted camera;
- warm by day and lamp-lit by night;
- real shadows, smoke, sparks and explosions;
- marks that stay on the ground.

Without a shared toolkit each game would rebuild the renderer, the lights and the effects, and
they would drift apart. three.js is large (about 600 kB minified), so whatever we share must never
reach the Hall's bundle. Rule 4 forbids raster assets, so every surface is made in code.

## Decisions

### A toolkit package, not an engine

`packages/arena` is a set of functions on top of three.js 0.186. It owns no game loop, no rules
and no models. A game creates a stage, builds its own board and models on `stage.scene`, and calls
`render()` from its kit loop. Game-specific meshes (tanks, planes, boards) stay in the game.

### The stage

`createStage` sets up the whole rendering pipeline:

- **Renderer.** sRGB output, ACES tone mapping and PCF soft shadows. Shadow maps are 4096, 2048 or
  1024 by quality, and the device pixel ratio is capped.
- **Camera.** A fixed orthographic camera at a 55–65° tilt (`frameTable`), sized so the whole board
  fits any aspect ratio with a strip kept free for score plates. Orthographic means no perspective
  advantage for either seat. `elevation` frames a flying layer for aircraft.
- **Lighting rig.** `createLightRig` has two designed rigs:
  - by day, a low golden-hour sun with a cool sky fill;
  - by night, a desk-lamp spot and blue moonlight, plus a pool of four flash lights that explosions
    and muzzle flashes borrow.

  `aimSun()` lets a game choose where the long shadows fall.

- **Post-processing** (`createPostChain`): bloom for anything hotter than white, a gentle
  tilt-shift band that sells the miniature scale, a finishing grade, and output. Low quality skips
  it.
- **Odds and ends.** `setShake`, a fixed `size` for a canvas that is never laid out (the Den TV
  copies it through the CRT), and `preserveDrawingBuffer` for capture.

### Surfaces from code

- `noise.ts` (gradient, cellular, fbm, ridged) and `heightmap.ts` (blur, normals, paint) build
  surfaces from code.
- `textures.ts` bakes recipes into colour, normal and roughness maps: sand, brick, concrete,
  burlap and table wood.
- `weathering.ts` adds dust and edge wear to any material, and `uv.ts` projects box UVs.
- No image file is loaded.

### Marks, particles and effects

- **Ground paint** (`createGroundPaint`): a render target over the board where stamps accumulate,
  with a channel each for soot, track marks, contact shadow and glowing embers. The board's ground
  material samples it, so scorch marks and treads stay for the match at no per-frame cost.
- **Particles** (`createParticleField`):
  - "smoke" fields are depth-sorted, lit and can carry `heat` for flame;
  - "glow" fields are additive and can stretch along their motion;
  - each particle can fade in.
- **Ribbons** (`createRibbon`): camera-facing strips for tracers, guided-shell smoke and the
  lingering path of a bank shot. Each point remembers its age, so tails fade by themselves.
- **Effects** (`createEffects`): an explosion with a flash, fireball, rolling smoke, debris, a dust
  ring, a hot core and a scorch, plus burning wrecks, ricochet sparks and dust puffs.
  - Full and reduced intensities; reduced is a bright pop and a scorch, used for reduced motion.
  - Explosions add trauma to a `createCameraShake`, whose shake grows with the square of trauma and
    turns off with the player's setting.

### Budget and disposal

`createFrameBudget` watches frame times, so a game can drop quality on slow machines.
`disposeTree` and `disposeMaterial` free GPU memory when a view is rebuilt (an appearance change,
the next match).

### Kept out of the Hall

- The Hall never imports the package. A game module that uses it is loaded lazily from the
  registry, so three.js and the arena ship in that game's chunk.
- `pnpm check` asserts that the Hall's entry script, and everything `index.html` preloads, contain
  no three.js.

## Consequences

- Every later diorama game starts with the same camera, light, effects and look, and spends its
  effort on its own models and rules.
- A change to the arena changes every game that uses it. Its API is small and documented in
  `src/index.ts`, and its tests cover the pure parts (noise, heightmaps, budget, shake, UVs).
- three.js upgrades happen in one place.
