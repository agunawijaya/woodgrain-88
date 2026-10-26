# The Den — hero frames (owner checkpoint, prompt 00 stage 6)

Live screens from the running Hall (`pnpm dev`, port 4488), captured at 1920×1080 with Chromium on the GPU.
Recaptured at the end of prompt 00 after the owner's fixes and two label colours raised to AA.
Nothing here is a mockup: every pixel is drawn by code (SVG room, WebGL CRT, canvas slates).

These frames predate prompt 00a and stay as approved. Since then five games have new names (Big
Top Cannon, Shore Battery, Tank Duel, Lucky Reels, Quickdraw) and the two "hidden reskins" became
cartridge versions you choose, with Counter places 31 and 32; current screens are in
`docs/media/screens/`.

| Frame | File | What it shows |
|---|---|---|
| a | `a-den-day.png` | The Den by day |
| b | `b-den-night.png` | The Den by night, the TV tinting the room |
| c | `c-power-switch-night.png` | The power switch mid-snow, by night |
| d | `d-label-focus-day.png` | A label focused from the keyboard, with its game card, by day |
| e | `e-label-wall-list-day.png` | The Label Wall list view, by day |

## a — The Den by day

Late afternoon in a pine-panelled basement rec room. The high window's venetian blinds let warm
light in, and it lands as soft stripes across the shag carpet and the beanbag. The TV is the anchor,
centre-left: a walnut cabinet with rabbit ears, playing the current channel's slate. Below it, on the
stand's open shelf, sits our own woodgrain console: chunky POWER and RESET levers, two difficulty
switches, the current cartridge in its slot, and the Counter showing 01 above its 32 lamps (31 and
32 are diamond-shaped because they belong to the hidden reskins). A handwritten sticky note stuck
to the stand's rail under the lamp says "flip the POWER switch! (or press P)", so the room explains
itself. On the right is the Label
Wall: four felt-backed shelves with label-maker tape plaques (DUELS, BRAIN, SPORTS, ARCADE) and
thirty code-drawn cartridges. The door with the denim jacket, the calendar (today's date, Daily #1),
the sunburst clock (real time), the braided rug, two joysticks, a trailing pothos and a white cat
asleep against the beanbag fill the room around it.

## b — The Den by night

Same room, after dark, designed rather than inverted. The blinds tilt shut, the lamp clicks on and
throws one warm pool, and the TV becomes the main light. Its glow takes the colour of what is on
screen (sampled once a second, smoothed, kept calm). A soft strip light under each shelf keeps all
thirty labels readable. The calendar and clock fall back into the dark; the card turns plum-dark.

## c — The power switch, mid-snow

The moment after a flip: the picture has collapsed to a line and a dot, and the set has come back up
in snow with a degauss wobble. While it snows, the room flickers with a cold grey light. Meanwhile
the Counter has flipped to 02, the console's cartridge has changed, and the matching cartridge on the
wall lifts and glows (Big Top Splash, bottom row). Then the picture rolls once into the new channel.
Holding P keeps cycling, with the snow growing comically heavy each time.

## d — A label focused, with its card

Keyboard focus on Paint Tanks: the cartridge lifts with a visible focus ring drawn above every light
layer, the TV changes channel to its slate (short snow), the Counter flips to 20, and the card
updates: title, tagline, "2 players", the green "Couch versus" badge, your best, patches, and the two
ways in (Coming soon / Details).

## e — The Label Wall list

The accessible way in, and the default below 900 px: the same thirty labels as a grid, with filters
by family and by players, each card showing its cartridge label, slot, family, tagline and who it is
for.

## Critique rounds (five)

1. Sun shafts were hard white bars over the labels, the window read as a white slab, the Counter's
   digits overflowed, the cables were thick black loops, and the beanbag read as a shell. Fixed:
   soft blurred shafts with carpet stripes, a real sky with a hedge and fence, smaller flip digits,
   thin cables, a slouchy beanbag.
2. At night, a hard-edged arc of light appeared on the wall (the lamp pool's shape cut its own
   gradient). Fixed: glows fill the room, so no shape edge can show.
3. Labels too small to enjoy at 1920: bigger cartridges and labels. The wall above the TV was empty:
   added a sunburst clock that keeps real time. The calendar glowed too brightly in the dark: it now
   dims at night.
4. Would a 14-year-old and a 50-year-old both reach for the switch? Not yet, so the sticky note was
   added. The TV's tint was too timid: stronger, smoother glow. The Power Cycle chip copy was
   tightened.
5. The snow moment needed to feel electric: the room now flickers cold while the set snows. Checked
   at 1280×720 (fixed a wrapping button), ultrawide 2560×1080 (the room extends, nothing stretches),
   and the list by night.

## Decisions to confirm

- **Coming-soon labels.** The prompt describes blank white labels with a handwritten "soon". Thirty
  identical blank labels made the wall unreadable and failed "distinct", so each cartridge shows its
  own printed label (pattern, colours, motif, slot tab) with a strip of masking tape across it marked
  "soon" in marker. Say if you prefer fully blank labels.
- **The game card** floats bottom-left, beside the TV block, so the wall stays unobstructed.
- **The RESET lever** restarts what is on screen and never changes channel: that is what Reset did
  on the cartridge (`research/dossiers/00-cartridge.md`).
- **Additions not in the prompt:** the sticky note, the sunburst clock and the shelf props (trophy,
  snow globe, board-game boxes, bookend) in the short rows.
- **Type:** Fraunces (display), Atkinson Hyperlegible Next (UI), Big Shoulders Display (labels,
  Counter), Patrick Hand (handwriting). All OFL and self-hosted.

## Owner review (2026-10-26)

Approved in principle, with four fixes, all made and the frames re-shot:

1. The sticky note sat partly under the TV picture (the CRT is an HTML layer above the room). It
   now hangs on the TV's left edge, clear of the screen.
2. The coat hanger read as broken lines and the jacket did not hang from it. The hanger is now one
   continuous wire hooked over the top of the door, and the jacket's shoulder seams rest on its
   arms, with the neck visible inside the open collar.
3. The joystick cables looked stiff. They now slump across the rug in loose, uneven curves with a
   soft highlight and shadow, and climb over the stand's lip to the console.
4. The flip-digit Counter (current slot 01–32 above 32 lamps) looked stacked on the console and
   lopsided. It is now its own small wooden unit with a SLOT name plate, standing on the shelf on
   the console's baseline and wired to it, with the console narrowed so the pair sits evenly.
   This departs from the prompt's "on top of the console" at the owner's request.

## Owner review, second round (2026-10-26)

1. The sticky note still sat awkwardly. It now hangs from the stand's top rail under the lamp: only
   its gummed strip is stuck to the wood, the lower half hangs over the open shelf with a longer
   shadow and a lifted corner, and by night the lamp keeps it readable. The owner chose this over a
   taller drawer front or a smaller note.
2. A white cat now sleeps on the carpet against the beanbag, curled with its chin on its paws and
   its tail round the front. It is drawn in layers (window light, a cool shade low on the flank,
   soft tufts along the back, combed strands, pink ears and nose, whiskers), breathes slowly and
   flicks an ear now and then; both stop with reduced motion. By night it turns a soft grey.
