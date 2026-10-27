# Hot & Cold hero frames: notes

These are live renders from the game's own looks (`games/hot-and-cold/hero.html`, dev server on
port 4521), captured at 1920 × 1080. They are not mockups:

- the board comes from the real generator, arranged so the story's squares hold the clues it
  needs, with the 1978 composition kept (1 flag, 8 bombs, 27 distances, the rest arrows);
- the explorers act the story out through the same field view a match will drive;
- every clue shown is computed by the engine, flag first;
- the time steps are fixed, so a frame comes out the same every time.

## The six frames

| File                         | Scene                                                                                                                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `polar-hunt-day.png`         | (a) Polar Expedition, mid-hunt by day, in a race. Orange has walked the top rows and is probing a hot 2. Blue hit a bomb (the crater), rode the sled home, and is closing in from below.                         |
| `polar-capture-night.png`    | (b) Polar Expedition, the capture by night. The flag bursts out of the snow and unfurls under the aurora, a flare bursts overhead, a red hand flare burns at the flag's foot, and confetti flies.                |
| `tabletop-hunt-day.png`      | (a) Tabletop Board, the same mid-hunt, caught as the hot 2's tile turns over. The orange pawn hops in place.                                                                                                     |
| `tabletop-capture-night.png` | (b) Tabletop Board, the capture under one lamp. The flag tile shows its gold star, a pennant springs up on a brass pin, and a ripple of tiles jumps outward from the find.                                       |
| `radar-hunt-day.png`         | (a) Radar Room, the same mid-hunt on a daylight light-panel console. It shows the seven-segment ranges, the bearings, the static burst, track history, and the range square pulsing out from the newest reading. |
| `radar-capture-night.png`    | (b) Radar Room, the lock by night. The reticle closes on the target and pings roll across the phosphor while the sweep turns.                                                                                    |

`companions/` holds the other appearance of each scene (mid-hunt by night, capture by day), for
comparison. Every look is designed for both.

Re-take any frame with `http://localhost:4521/hero.html?look=polar|tabletop|radar&scene=hunt|capture&appearance=light|dark`.
Further options:

- `&t=0.3` moves the moment later;
- `&measure=1` reports frame times;
- `&bloom=`, `&sun=`, `&hemi=`, `&key=` and `&exposure=` are tuning knobs.

## How the three looks differ

|           | Polar Expedition (default)                                                                                                                                                                           | Tabletop Board                                                                                                                                                                                       | Radar Room                                                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| World     | A surveyed snowfield: pillows of snow between survey stakes and a rope. Each team's pyramid tent, loaded sled, skis and lantern stand by its home corner. A painted sky with ice ridges sits behind. | An oak tray with a felt inlay on a planked oak table. Wooden tiles have teal backs with gold rings, brass corners and enamel home discs. A notepad, an hourglass and a score pegboard lie around it. | A flat plotting display under glass in a steel console. Columns are lettered A–I and rows numbered 1–7, with range rings. Each seat has a lamp, a dial, knobs and switches. |
| Explorers | Round figures in team parkas: fur ruff, goggles, a pack, and a pennant whip. By night they carry lanterns.                                                                                           | Lacquered wooden pawns in pith helmets. They hop from tile to tile.                                                                                                                                  | Blips: a diamond for seat 1, a triangle for seat 2. Each leaves a fading track history.                                                                                     |
| Distance  | An ice slab with a carved numeral glowing along a thermal ramp, from white-hot 1 to icy 8.                                                                                                           | A painted numeral on cream, in warm-to-cool inks.                                                                                                                                                    | A seven-segment readout, and a square range ring pulsing out to exactly that distance.                                                                                      |
| Arrow     | A painted marker arrow planted on two pegs. It has a reflective stripe that glows at night.                                                                                                          | A painted navy arrow on the tile.                                                                                                                                                                    | A vector bearing in a small ring.                                                                                                                                           |
| Bomb      | A fire-and-snow blast, a scorched crater, and a sled ride home along its own runner tracks.                                                                                                          | A cartoon puff with an ink outline. The pawn is bounced home spinning.                                                                                                                               | A burst of static. The blip snaps home, leaving a streak.                                                                                                                   |
| Flag      | The flag bursts out of the snow and unfurls. Confetti flies, and at night there is a flare and a hand flare.                                                                                         | The gold star tile, a pennant on a pin, confetti, gold sparkles and a ripple of jumping tiles.                                                                                                       | A closing target lock, a "LOCK" tag and rolling pings.                                                                                                                      |
| Day       | A crisp low sun, blue shadows and glittering snow, under a sky band with distant ridges.                                                                                                             | Warm afternoon light on oak and felt.                                                                                                                                                                | A sunlight-readable light panel in pale greens and greys.                                                                                                                   |
| Night     | The moon casts the shadows. The aurora hangs over the ridges, and tents and lanterns glow.                                                                                                           | One lamp pools over the board. The room falls away into shadow, and the brass catches the light.                                                                                                     | Deep green phosphor on black. Everything brightens as the sweep passes and leaves an afterglow.                                                                             |

The field geometry is the same in all three: square (column, row) sits at the same table position,
and the home corners are the same. Only the camera and the dressing differ.

## Critique rounds

### Polar Expedition (7 rounds)

1. **Washed out to milk.** The lit snow sat above the bloom threshold, so bloom laid a veil over the
   whole frame.
   - The look now lights the snow low and exposes it up at the end. The stage gained a
     per-appearance `exposure` for this.
   - Bloom only catches emissive glows now.
2. **The sky band was hidden.** The far snow bank rose past the top of the frame.
   - The bank is now a low lip, and the tilt is 46°, which leaves a band for the ridges and the sky.
3. **Tents and pillows.** The dome tents read as eggs from above, and the A-frames as flat
   triangles.
   - Replaced them with the classic polar pyramid tent: four flat faces, crossed poles and a snow
     valance.
   - Pillows got a softer dome.
4. **No scorch, no footprints.** Ground paint ignored instancing (an arena bug), and a dug pillow
   still covered its square.
   - Fixed both; prints and craters now show.
   - A low winter sun gives long blue shadows, and soft shade lies in the grooves.
5. **Night was lavender.** The flare's red point light washed the whole field pink.
   - Removed that light; the burst lights itself.
   - The aurora gained folds and rays, and the distant ridges were sharpened.
6. **Celebration.** Added confetti and, at night, a red hand flare at the flag's foot.
7. **Day contrast.** A deeper ice for the slabs and a firmer carved edge, so the white-hot 1 still
   reads by day.

### Tabletop Board (4 rounds)

1. **Table and numerals.** The table grain looked like sand dunes, and Fraunces's figures made the
   3 and 4 easy to misread.
   - Straight-grained planked oak replaces the old grain.
   - The numerals are now Atkinson Hyperlegible.
   - The notepad was dulled so it no longer blooms.
2. **Night was a dim day.** The lamp now pools narrowly (new night-mood `lampAngle` and
   `lampPenumbra`), the room falls away and the vignette deepens.
3. **Capture.** Added a bigger pennant, gold sparkles and a ripple of jumping tiles.
   - Fixed a bug where a jumping tile left its painted back behind.
4. **Glare and the star.** A satin varnish on the tile backs stops the lamp's glare across the near
   rows.
   - The gold star glows a little but is not blown out.
   - The pawns went a size up.

### Radar Room (3 rounds)

1. **Pings and bearings.** Expanding pings thickened as they grew, so they now live in the display
   shader with a constant width. The bearing rings bloomed into blobs and were calmed down.
2. **Day was veiled.** The cover glass reflected the room over the whole display.
   - The glass is now nearly invisible.
   - The inks are darker, and the range-square pulses are thinner and quicker.
3. **The lock** is a size larger.

## Numbers

Frame time at 1920 × 1080 with the full finish (MSAA, bloom, grade), on the owner's desktop GPU,
over 300 frames after each moment:

| Look     | Scene          | Frame median / 95th | Main thread median / 95th |
| -------- | -------------- | ------------------- | ------------------------- |
| Polar    | capture, night | 16.7 / 16.8 ms      | 1.2 / 2.1 ms              |
| Polar    | hunt, day      | 16.7 / 16.8 ms      | 1.2 / 2.3 ms              |
| Tabletop | capture, night | 16.7 / 16.7 ms      | 1.1 / 2.1 ms              |
| Tabletop | hunt, day      | 16.7 / 16.7 ms      | 1.0 / 1.5 ms              |
| Radar    | capture, night | 16.7 / 16.7 ms      | 0.8 / 1.2 ms              |
| Radar    | hunt, day      | 16.7 / 16.8 ms      | 0.8 / 1.4 ms              |

All six hold a vsync-locked 60 fps. A mid-range laptop has not been measured yet.

## Open for the owner

- **No HUD in these frames.** Scores, checks, timer and turn indicator arrive with wireframe play.
  In Polar the sky band at the top is kept free for them.
- **Tabletop's capture is the quietest of the three.** The pennant is small at this scale, as a
  board-game pin would be. It could grow, or the camera could ease in at the capture.
- **The explorers are small at full-field framing** (about 80 px tall at 1080p). The field has to
  show all 63 squares at once, so they read by colour, shape and pennant rather than by face.
- **Radar** shows the range square only as a short pulse after a reading. The possibility fog is a
  separate setting, kept for later stages.
- **Colour-blind clue colours** have a ramp ready in `look/heat.ts` (and a seat palette in
  `look/seats.ts`), but no setting uses them yet.
