# Brief: Trailblaze polish dossier (read-only)

For: qa-scout. Prompt: `prompts/04a-trailblaze-polish.md` (read §1 for what the director will fix).
References: `docs/adr/0013-*.md`, `games/trailblaze/docs/NOTES.md`,
`games/trailblaze/docs/ARCHITECTURE.md`.

Read only. Edit nothing, run no dev server, change no git state. Write the dossier to
`briefs/tb-polish-dossier.report.md` and reply with a short summary and the path.

Cite `file:line` for every claim. Separate what you read from what you infer.

## What to map

1. **Riders, per look** (`games/trailblaze/src/looks/<look>/`, `src/look/`):
   - where each rider's model is built (file, function), its current size in world units next to
     the cell size, and what parts it has (body, head, bike, wheels, linen, skates, steam);
   - how a rider is placed and turned each frame (the function the session calls, what it is
     given: cell, heading, a progress fraction?);
   - any existing lean, shuffle, push, breath, wheel spin or steam animation, and where.
2. **Trails**: where each look builds a trail segment, its material (colour per seat?), and for
   the Mummy look how the bandage is made (geometry, material, any texture or pattern).
3. **Crashes, per look**: the function that draws a crash, every effect it fires (flashes, bloom,
   particles, light flash and its intensity, camera shake) and its duration. Quote the Mummy
   crash's code path in full detail: what makes the white flash.
4. **Camera**: where the overhead camera and the Chase camera are set up and updated, how a point
   (crash) and the restart are sequenced in the session (timings), and whether reduced motion is
   already passed to the view.
5. **The step and the picture**: how the engine's tick relates to what is drawn. Does the view
   draw riders at the engine's current cell, the previous one, or interpolate? Where are inputs
   read relative to the engine step and the render? Quote the NOTES passage on "one cell behind".
6. **Hero page**: `src/dev/` page(s) that render hero frames: URL options, scenes, how a crash
   moment or a time offset is chosen, and how `docs/media/hero/` frames were produced (see
   `games/trailblaze/docs/media/hero/NOTES.md`).
7. **Pre-match cards and the menu demo**: where they draw riders (if at all), and how the Den TV
   demo (`src/demo/`) frames the field.
8. **Results**: where the title score, the share line and "Cells claimed" are built, and why the
   title and share disagree (quote both code paths).
9. **Solo Doodle start chevrons**: where they are drawn and what decides which seats get them.

Keep it factual and compact: tables and bullet lists, no prose essays.
