---
id: arena-core-tests
kind: tests
model: gemini-3.8-flash-high
fence:
  - packages/arena/tests/camera.test.ts
  - packages/arena/tests/shake.test.ts
  - packages/arena/tests/budget.test.ts
  - packages/arena/tests/particles.test.ts
  - packages/arena/tests/ribbon.test.ts
acceptance:
  - pnpm exec vitest run --project arena packages/arena/tests/camera.test.ts packages/arena/tests/shake.test.ts packages/arena/tests/budget.test.ts packages/arena/tests/particles.test.ts packages/arena/tests/ribbon.test.ts
  - pnpm exec eslint packages/arena/tests/camera.test.ts packages/arena/tests/shake.test.ts packages/arena/tests/budget.test.ts packages/arena/tests/particles.test.ts packages/arena/tests/ribbon.test.ts
  - pnpm exec prettier --ignore-path .gitignore --check packages/arena/tests/camera.test.ts packages/arena/tests/shake.test.ts packages/arena/tests/budget.test.ts packages/arena/tests/particles.test.ts packages/arena/tests/ribbon.test.ts
reads:
  - packages/arena/src/camera.ts
  - packages/arena/src/shake.ts
  - packages/arena/src/budget.ts
  - packages/arena/src/particles.ts
  - packages/arena/src/ribbon.ts
  - packages/arena/src/lighting.ts
  - packages/arena/src/stage.ts
  - packages/arena/tests/noise.test.ts
---

## Goal

Unit tests for five modules of `packages/arena` (the shared three.js tabletop toolkit) that the lead
wrote. Tests only: do not change any file under `packages/arena/src/`. If you believe a module has a
bug, write the test that shows it, mark it `it.fails(...)` with a one-line comment saying what is
wrong, and list it in your report's open questions.

## Context

- Vitest runs this package in Node (`environment: 'node'`, no DOM, no WebGL). three.js maths and
  object classes (`OrthographicCamera`, `Vector3`, `Color`, `Mesh`, `ShaderMaterial`,
  `InstancedBufferGeometry`) work in Node; nothing here may create a `WebGLRenderer`.
- `particles.ts` and `ribbon.ts` need a `LightPalette` (from `lighting.ts`, a plain object with
  `keyDirection: Vector3`, `key: Color`, `ambient: Color`) and a camera: build both by hand. Call
  `camera.updateMatrixWorld()` after positioning a camera.
- Read the existing `packages/arena/tests/noise.test.ts` for the house test style.

## Tests required

`camera.test.ts` (`frameTable`, `unitsPerPixel`):

- after framing, all four ground corners (±width/2, 0, ±depth/2) and the far corners raised to `height`
  project inside NDC [-1, 1] on both axes, for aspects 16/9, 4/3 and 9/16;
- fairness: the left and right ground corners project to x values that mirror each other (to 1e-9);
- with `topInset` 0.15, every framed point projects below NDC y = 1 − 2 · 0.15 (it stays out of the
  inset) and the content still fits;
- the camera looks at the origin from the tilt angle: its world direction's elevation equals the tilt
  (to 1e-6) for tilts 55 and 65;
- a wider margin makes the frustum larger; `unitsPerPixel` halves when the viewport height doubles.

`shake.test.ts` (`createCameraShake`):

- no trauma gives a zero offset; trauma is capped at 1; it drains by `recovery` per second;
- offsets never exceed `maxOffset` / `maxRoll`; the shake grows with trauma squared (compare the
  largest offset over many small steps at trauma 0.5 and 1: the ratio is near 1/4);
- disabled: `addTrauma` does nothing and `setEnabled(false)` clears existing trauma;
- two shakes with the same calls produce the same offsets (deterministic).

`budget.test.ts` (`createFrameBudget`):

- the first 30 frames are ignored;
- a window of slow frames (95th percentile over `limitMs`) drops high → medium and returns it once;
  a second slow window drops medium → low; low never drops further;
- fast frames never change quality, and the budget never steps back up after a drop;
- `stats` reports median and p95 of the current partial window.

`particles.test.ts` (`createParticleField`):

- `emit` raises `count`; particles die when their life is over; `clear` empties the field;
- capacity is respected (emits beyond it are ignored);
- a particle with `lift: -10` and `bounce: 0.5` dropped from y = 1 never goes below 0 and bounces;
- after `update`, `mesh.geometry` is an `InstancedBufferGeometry` whose `instanceCount` equals
  `count`, and its `iPosition` attribute holds the live particles' positions (for 'glow', in emit
  order);
- smoke is sorted back to front: with the camera looking down -z, a particle further from the camera
  is uploaded before a nearer one;
- `setGlowSources` with five sources keeps only the first four (check the material uniforms of a
  smoke field: `glowPositions` has four entries, the fifth source is ignored) and an empty list sets
  every strength (`w`) to 0.

`ribbon.test.ts` (`createRibbon`):

- `push` adds points; points closer than 0.12 to the head only move the head;
- `maxPoints` drops the oldest points;
- after `update` past `fade` seconds the ribbon is empty (draw range count 0);
- `setPath` with three points and `update(0, camera)` gives a draw range of 2 segments × 6 indices;
- each pair of vertices straddles its point: the midpoint of vertices 2i and 2i+1 equals point i, and
  the strip is perpendicular to the path in screen space (dot of the offset with the path direction
  is ~0 for a straight path seen from above);
- `opacity` scales the material's `alpha` uniform.

## Out of scope

Anything needing WebGL (`stage.ts`, `post.ts`, `ground-paint.ts` flushing, `effects.ts`), and any
change to source files.

## Style

TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`). Deterministic tests,
named after the behaviour they prove. No `any`, no non-null assertions (use a small helper that
throws when a value is missing), no commented-out code. Prettier: single quotes, width 100, trailing
commas. Import with `.ts` extensions.
