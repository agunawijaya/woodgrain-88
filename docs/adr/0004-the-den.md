# ADR-0004 — The Den

- Status: accepted (hero frames approved by the owner on 2026-10-26)
- Date: 2026-10-25
- Code: `hall/src/den/`

## Context

The Hall must feel warm, alive and premium for teenagers and for people who owned the console, and
it must tell the cartridge's story: no menu, a power switch, thirty games where 32 were promised.

## Decision

**One SVG room on a strict 1600×900 core grid** (`geometry.ts`), always fully visible. Wider or
taller windows see more room (panelling, carpet), never a stretched picture. Positions of every
object live in `LAYOUT`, shared by the scene and the HTML overlays.

Composition: door with the denim jacket on a hanger, calendar, the TV on its stand with the console
and the freestanding Counter on the open shelf, the lamp, a sunburst clock, the Label Wall with the
high basement window and its blinds, the braided rug with two joysticks, the beanbag.

**Layers**, back to front: room, TV and stand, lamp, console and Counter, the wall, pothos,
calendar, jacket, pads, beanbag, daylight, nightlight, the power-cycle dimmer, the intro darkness,
the intro hand, and one focus indicator above everything so keyboard focus is visible at night.

**Day and night are designed, not inverted.** Scene colours are `--den-*` tokens with their own
night values. Day adds blurred sun shafts and warm carpet stripes. Night adds a masked darkness cut
open by the TV glow (tinted by `--tv-tint`, the CRT picture's average colour sampled each second,
smoothed and calmed), the lamp's pool and a strip light under each shelf so labels stay readable.
Gradients for glows fill the whole room so no shape edge can cut them.

**The TV** is the kit's WebGL CRT (`crt.ts`) laid over the screen opening. It shows a game's real
`demo()` once the game is playable, or a code-drawn slate in the label's colours for coming-soon
games, or a scrambled channel for the locked slots 31 and 32.

**The power switch** (click, drag, `P`, `Shift+P`, hold `P`): clunk, the room dips, the picture
collapses to a line and a dot, the Counter flips, the cartridge in the console and the wall label
change and glow, snow throws a cold flicker into the room, a degauss wobble, the picture rolls in.
Reduced motion turns it into a cross-fade.

**RESET** restarts what is on screen and never changes channel, because that is what Reset did on
the cartridge (dossier 00).

**Coming-soon labels** wear their printed design with a strip of masking tape marked "soon" in
marker, instead of being blank, so the wall reads as thirty distinct cartridges (owner-approved).

**Anchors for prompt 01**: the jacket (`[data-ref="jacket"]`, empty patch places drawn), the pads
(`[data-ref="pads"]`, Versus Night), the difficulty switches, the Counter lamps
(`[data-ref="counter-lamps"] .lamp[data-slot]`), the calendar. Prompt 01 used them all and added
more (the corkboard, the chalkboard, the growth slots); `docs/ARCHITECTURE.md` lists the current
anchors, with the switches now `[data-ref="switch-left"]` and `[data-ref="switch-right"]`.

## Consequences

- One scene of a few thousand SVG nodes and two canvases; the frame budget is the CRT shader.
- Narrow screens (below 900 px) start in the list view, where the same labels are an accessible grid.
