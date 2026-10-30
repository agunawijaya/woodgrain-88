# Gravity Duel hero frames: notes

Live renders of the four looks (`games/gravity-duel/hero.html`, dev server on port 4523), captured
at 1920 × 1080. They are the real looks, ships and effects, played by a **stand-in for the engine**
(`src/dev/orbits.ts`): bodies under a pull toward the star that weakens with distance, thrust, and
bouncing walls. The cartridge's own fixed-step physics comes in stage 2; these frames only judge the
art. The scenes run in fixed 20 ms ticks (the cartridge's frame), so a frame comes out the same
every time.

Each missile in these frames was chosen by search, not placed by hand: the hero page tries launch
headings a quarter degree apart, rejects any flight that touches a wall or comes within the star's
glow, and keeps the one that swings round the star the way the scene asks (about 95° for the duel
shot in flight, about 150° for the bank shot). In the bank shot, blue drifts so that it is exactly
where the missile comes out when it does.

## The frames

| File                   | Scene                                                                                                                                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deep-duel-light.png`  | (a) Deep Space by day, mid-duel round the star: blue's missile is halfway round the sun toward orange, orange swings in with its engine lit, its own earlier shot still curling away top right. |
| `deep-bank-dark.png`   | (b) Deep Space by night, the bank shot: orange's tracer arcs over the star and bursts on blue's Crescent.                                                                                       |
| `brass-duel-light.png` | (a) The Brass Orrery by day: the Clipper and the Beetle among the orrery's rings, sunlight from the study window across the board.                                                              |
| `brass-bank-dark.png`  | (b) The Brass Orrery by night: the pellet's bright wire bends round the filament bulb into the Beetle; gold sparks and loose cogs.                                                              |
| `paper-duel-light.png` | (a) Paper Sky by day: Zip and Bubble round the smiling sun, pencil lines behind the dashes.                                                                                                     |
| `paper-bank-dark.png`  | (b) Paper Sky by night under the desk torch: the glow-in-the-dark line bends round the sun and a zigzag starburst hits Bubble.                                                                  |
| `whirl-duel-light.png` | (a) The Whirlpool by day: Minnow and Puffer circling the vortex in a walled harbour, torpedo wakes curving with the current.                                                                    |
| `whirl-bank-dark.png`  | (b) The Whirlpool by night: the torpedo's wake bends round the glowing eye into Puffer; the subs' beams on the water.                                                                           |

Re-take any frame with
`http://localhost:4523/hero.html?look=deep|brass|paper|whirl&scene=duel|bank&appearance=light|dark`.
`&t=0.3` moves the moment later; `&zoom=4&at=x,z` looks closer at one spot.

## How the four looks differ

|                   | Deep Space (default)                                                                                                                                  | Brass Orrery                                                                                                                                         | Paper Sky                                                                                                                            | Whirlpool                                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| World             | Night: black space, a violet and teal nebula, stars. Day: a planetarium dome with the house lights up, its star chart printed in navy                 | A walnut desk, a blue enamel board engraved like a clock face, a brass rail                                                                          | Graph paper; the field's edge pencilled in                                                                                           | Turquoise water with sunlight caustics (dark water by night); stone quays                                                           |
| The pull          | A lens round the star that draws the background stars inward, and a slow ripple; by day the chart's rings                                             | The orrery's brass rings turning on their arms, each with a bead of a planet                                                                         | A pencil spiral winding in to the sun                                                                                                | The current itself: the water turns faster near the eye, foam drawn into a spiral                                                   |
| The deadly middle | A living star: churning plasma, a breathing corona, flares off its limb; by day a crisp yellow sun with drawn rays                                    | A filament bulb in a brass socket, the filament flickering                                                                                           | A smiling crayon sun whose lines boil                                                                                                | The vortex's dark eye in its ring of foam (glowing by night)                                                                        |
| Ships             | Lance: long dart, delta wings, one engine. Crescent: crescent wing round a short pod, two engines. Metal by night, painted with an ink outline by day | Clipper: a brass hull with an enamel deck and a gear on its mast. Beetle: a brass dome with enamel wing cases over two gears. Candle-flame thrusters | Zip: a thin rocket with swept fins. Bubble: a fat round rocket with a big window and stripes. Cut-outs on the page; scribbled flames | Minnow: a cigar with a conning tower and periscope. Puffer: round, a glass dome, two side propellers. Surfaced, in a collar of foam |
| Missiles          | Tracers; long ribbons of light by night, deep-coloured lines by day                                                                                   | Brass pellets leaving a thin bright wire                                                                                                             | Pencil dashes leaving a pencil line (glow-in-the-dark by night)                                                                      | Torpedoes trailing bubbles and a pale wake                                                                                          |
| A hit             | A flash in the shooter's colour, a ring, sparks, tumbling hull shards                                                                                 | Gold sparks, a puff of steam, little cogs flying loose                                                                                               | A zigzag starburst and doodled stars                                                                                                 | A plume of spray and a ring of foam                                                                                                 |
| Night             | Black space, glowing engines                                                                                                                          | The desk lamp's warm pool                                                                                                                            | The desk torch's pool; glow-in-the-dark crayon                                                                                       | Dark water, the subs' beams, bioluminescence                                                                                        |

In every look the two ships differ in outline as well as colour, and are drawn 2.5 to 2.9 units
long on a field 32 wide (about a twelfth of it), big enough to read their shape from the couch. All
designs are our own.

## Critique rounds

- **Deep Space (six rounds).** The first day frame washed out (white hulls on a pale sky, a star
  like an orange marble, glow trails that vanished); the first night bank shot bent only 45°
  because the search counted wall bounces as turning, and its hit was the tank game's white
  fireball over the victim. Fixed: a stronger stand-in pull and a search that refuses wall
  bounces; a burst of our own for space (flash, ring, sparks, shards, no smoke column); by day
  painted hulls with an ink outline, a crisp sun with drawn rays, deep-coloured trail lines and the
  star chart's rings; a bigger, hotter flash for the signature moment.
- **Paper Sky (four rounds).** Rockets too small, the spiral too dark, pencil lines too faint; the
  first night was lit like day, then the torch blew the middle out. Fixed: bigger cut-outs, a
  lighter spiral, bolder lines, our own torch at a quarter of the strength, glow-in-the-dark lines
  by night.
- **Brass Orrery (four rounds).** By night the desk lamp's highlight on the glossy enamel hid the
  Clipper, and the bulb's halo was too big; by day the light was flat. Fixed: satin enamel by
  night, the lamp moved, a smaller halo, bigger craft, thicker wire; by day sunlight through the
  study window laid across the board (strong at first, now a soft warm wash).
- **Whirlpool (four rounds).** The foam spiral was heavy solid bands, then broke into blocky dashes
  (noise aliasing on the twisted coordinates); the bioluminescence was square. Fixed: thin
  smooth streaks varied on the untwisted sea, round motes, bigger subs.

## The art pass after approval (stage 4)

- **Whirlpool:** the quays now have dressed stones, iron bollards and a wet band edged in foam.
- **Deep Space by day:** a hit now paints a disc in the shooter's colour over the hull, with an ink
  line round the shock ring.
- **Every look** now draws:
  - the starbase, the docking pods and the gravity beacon;
  - the cloak's shimmer;
  - the trajectory guide's dots;
  - the Remix bodies;
  - a small effect of its own for a shot, a swallow, a homecoming and a dock.

  Designs are in ADR-0016.

- **Brass Orrery:** the bulb now has a brass rim and a window's glint on the glass and a thicker
  filament, so from overhead it reads as a glass bulb by day; by night it is meant to blaze.
