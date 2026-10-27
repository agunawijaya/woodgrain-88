# Tank Duel hero frames: notes

Live renders from the game's own boards, models and effects (`games/tank-duel/hero.html`, dev
server on port 4520), each simulated in fixed steps up to its moment and captured at 1920 × 1080.
They are not mockups: the same code draws the match.

| File             | Scene                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `duel-day.png`   | (a) Old Quarter by day: the olive tank's bank shell has just bounced off a concrete pillar and is on its way to the desert tank behind cover; its path glows. |
| `duel-night.png` | (a) by night, under the desk lamp with a moonlit fill; headlights on.                                                                                         |
| `kill-night.png` | (b) the bank-shot kill, 0.3 s after impact: fireball, sparks, debris, dust ring, the victim spinning, the shooter's one-step recoil.                          |
| `kill-day.png`   | (b) by day, for comparison.                                                                                                                                   |
| `sky-day.png`    | (c) biplanes over the countryside among the Cloud Banks: orange fires a machine-gun burst, blue hides in a cloud.                                             |
| `sky-night.png`  | (c) by night.                                                                                                                                                 |

Re-take any frame with `http://localhost:4520/hero.html?scene=duel|kill|sky&appearance=light|dark`
(`&t=0.5` moves the moment later; `&measure=1` reports frame times).

## Critique rounds

### Round 1: first render

- The 60° tilt read as a flat map. Lowered to 55° (the low end of the brief), so walls show their
  faces.
- The light was flat: the sky fill was so strong that the shadows were faint. Halved the fill.
- The concrete was styrofoam-white, the sand looked like speckled paper, the table was orange and the
  team trim was invisible.
- The shell clipped the corner of a ruin instead of the pillar I meant, because the shooter was one
  unit off. Moved it.

### Round 2: close crop at 1:1

- The sand ripples looked like water. Broke them up with noise.
- The concrete was plain. Added weathering in the shader: grime at the foot, lighter top edges and a
  different tone per block. Also chipped block corners in the geometry.
- Added drybrushing to the miniature paint: every chamfer catches a lighter tone, as on a
  hand-painted figure.
- Fender stripes and a bigger roof chevron make the team colours read from across the table.

### Round 3: "clean but not stunning"

- Moved to a late-afternoon sun: warm, low and long-shadowed, with a cool sky fill so shadows read
  blue on warm sand.
- Tighter framing.
- Packed-earth patches break up the sand.
- Grass and concrete chips at the feet of the walls, and never in open ground, so decor is never
  mistaken for cover.
- A soft contact shadow under each tank.

### Round 4: every wall was the same sugar cube

- Gave the Old Quarter its character without changing the layout's shape:
  - ruined brick walls for the L-shapes and the central keep;
  - sandbag walls in front of the spawns;
  - concrete for the pillars and the perimeter.
- Desaturated the brick.

### Round 5: night and the kill

- Night looked like dusk. The lamp is now a narrower pool, the moon a stronger blue fill, the
  ambient darker, and smoke is lit by fire rather than by the lamp.
- The explosion was a white blob. Two changes:
  - Flames are now self-lit puffs sorted together with the smoke, so overlapping fire never adds up
    to white.
  - The blast is about twice a tank's size, with a small white-hot core for bloom, dark smoke from
    the first instant, a rising column, a dust ring thrown out along the ground, and the victim
    burning while it spins (2.5 s, as in 1977).

### Round 6: the sky

- The clouds were missing: long-lived particles never finished fading in. Fade-in is now measured in
  seconds and can be zero. That also fixed the invisible shell head in round 2 and makes tracers
  appear on the frame they are fired.
- The countryside was at the wrong scale: giant trees, so nothing felt high. Rescaled it as a
  far-below miniature with smaller fields, fine hedges and small trees and farms.
- Added the following:
  - a gentle warp so the hedgerows wander;
  - haze between the planes and the fields;
  - tilt-shift focus at flying height;
  - dark, cool clouds by night.

### Round 7: polish

- Narrower, warmer headlight pools.
- Final captures.

## Numbers

- **Frame time** at 1920 × 1080 with the full finish (MSAA, bloom, tilt-shift, grade), on the
  owner's desktop GPU: median 16.7 ms and 95th percentile 16.8 ms (vsync-locked 60 fps) for every
  scene.
- **Main thread:** 0.8–1.8 ms per frame.
- **JS heap:** 31–47 MB.
- A mid-range laptop has not been measured yet.

## Open for the owner

- No HUD in these frames (score plates and fuse clock come with wireframe play).
- Jets are not modelled yet.
- The countryside is deliberately stylised: a patchwork quilt of fields.
- At full-board scale the tanks are small, as the 1977 board demands. They read by their stripes,
  chevron and shadow.
