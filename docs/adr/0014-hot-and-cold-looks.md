# ADR-0014 — Hot & Cold: three looks over one field view

- Status: accepted (prompts 03 and 03a)
- Date: 2026-10-29
- Code: `games/hot-and-cold/src/look/` (the contract, field geometry, heat palettes, glyphs),
  `games/hot-and-cold/src/looks/<look>/` (Polar Expedition, Tabletop Board, Radar Room)

## Context

Hot & Cold shows one 9 × 7 field in three looks the player can switch between. Each look needs
its own explorers, its own way of showing a clue, a bomb and a capture, and a light and a dark
version. The clues are the game: a distance or an arrow must read at a glance in every look and in
both appearances, including for colour-blind players. The rules, the timing and the inputs must
not care which look is on.

## Decisions

- **One field view contract** (`FieldView` in `look/look.ts`). The match drives a look through it:
  - `placeExplorer` and `walk` (one step, wrapping included, over a given time) and `nudge`;
  - `reveal` and `conceal` for clues;
  - `blast` and `sendHome` for a bomb;
  - `capture` and `showFlag` for the end of a hunt;
  - `setFog` for the possibility fog.

  The view owns its models and effects and decides nothing.

- **Same geometry everywhere.** Every look places square (column, row) at the same spot
  (`look/field-space.ts`), so the mouse, the Kids' paths and the tests never ask which look is
  showing.
- **Clues are drawn by the look, coloured by the game.** Each look has its own clue pieces:
  - numbers stamped in snow;
  - printed tiles on the board;
  - strokes on the scope.

  All of them take their colour from one heat palette (`look/heat.ts`): warm to cool by distance,
  with a colour-blind ramp. The glyph shapes (`look/glyphs.ts`) carry the meaning on their own, so
  colour never has to.

- **Light and dark are designed, not tinted.** A look builds its view for one appearance. An
  appearance change, and since prompt 03a a look change, rebuilds the view on the running match
  (`MatchSession.setAppearance`, `setLook`) and redraws what the match has revealed. The match
  never restarts.
- **The stage is the arena package's.** Light moods, finish and exposure come from
  `packages/arena` per look and appearance, as for Tank Duel and Trailblaze.

## Consequences

- A fourth look is one new folder implementing `FieldView`. The rules, the session and the tests
  are untouched.
- Changing a look mid-match builds a new stage (each look has its own light). The controller
  disposes the old one after the session has moved its view across.
- Feel (prompt 03a) was checked against Trailblaze's lesson: a step and a reveal must show within a
  frame of the rule that caused them (see the game's NOTES.md).
