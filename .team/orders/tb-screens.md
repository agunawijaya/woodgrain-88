---
id: tb-screens
kind: plumbing
model: gemini-3.8-flash-high
fence:
  - games/trailblaze/src/screens/**
  - games/trailblaze/src/ui/**
  - games/trailblaze/tests/screens/**
acceptance:
  - pnpm exec vitest run --project trailblaze games/trailblaze/tests/screens
  - pnpm exec eslint games/trailblaze/src/screens games/trailblaze/src/ui games/trailblaze/tests/screens
  - pnpm exec prettier --check games/trailblaze/src/screens games/trailblaze/src/ui games/trailblaze/tests/screens
  - pnpm exec tsc -p games/trailblaze/tsconfig.json
reads:
  - games/hot-and-cold/src/screens
  - games/hot-and-cold/src/ui/hud.ts
  - games/hot-and-cold/src/app/controller.ts
  - games/hot-and-cold/tests
  - games/tank-duel/docs/media/screens/menu-720p-dark.png
  - games/trailblaze/src/channels.ts
  - games/trailblaze/src/app/settings.ts
  - games/trailblaze/src/app/save.ts
  - games/trailblaze/src/doodle/svg.ts
  - games/trailblaze/src/progress/patches.ts
  - games/trailblaze/src/engine/types.ts
  - games/trailblaze/src/session/match-session.ts
  - games/trailblaze/src/look/look.ts
  - games/trailblaze/src/look/seats.ts
  - packages/kit/src/kids.ts
  - packages/kit/src/kid-portrait.ts
  - packages/kit/src/kids/reflex.ts
  - packages/kit/src/contract.ts
  - packages/kit/src/patch-art.ts
---

## Goal

Trailblaze's screens and in-match HUD as DOM overlays above the three.js arena: menu, pre-match
cards, HUD, results (with "How Rosa saw it"), how to play, records, Doodle gallery and the settings
sheet. Port Hot & Cold's `src/screens/*` and `src/ui/hud.ts`: same structure, same `create…Screen`
/ `dispose` pattern, same sheet, focus handling, keyboard behaviour, `:focus-visible` rings,
`prefers-reduced-motion` handling, light and dark styling through the kit's appearance, and the
same collection navigation (below). Change what the tables below say; keep everything else.

The controller that wires these together comes in a later order. Each screen takes plain data and
callbacks, never reads stores itself, and never imports three.js.

## Collection rules every screen keeps

- **Game menu** and **Back to the Hall** are the only two destinations, with exactly those names.
  The menu has "← Back to the Hall" top left; Escape on the menu asks the controller to go back.
- Pause order: Resume · Look · Camera · How to play · Settings · Game menu · Back to the Hall.
- Results order: Play again (R) · Game menu · Back to the Hall (H). Share sits beside them.
- Every control reachable by keyboard; focus visible only for keyboard users; AA contrast in both
  appearances; nothing breaks at 1280×720 or on a 390 px wide phone (stack, never overflow).
- Our own copy only (given below). Never the original game's title or any brand.

## Skin

Same layout family as Hot & Cold and Tank Duel (see the Tank Duel menu capture: a title panel and
a mode panel on the left over the live arena, Kid Polaroids along the bottom right). Trailblaze's
own skin in `screens/style.ts`:

- Night: panels `rgba(12, 18, 32, 0.88)`, text `#eef2f8`, muted `#9fb0c8`, a 1 px top edge that
  runs from the left rider's colour to the right rider's (`seatColours(palette)` main colours).
- Day: panels `rgba(250, 246, 238, 0.92)`, text `#1b2a41`, muted `#4a5a72`, the same edge using
  the `deep` colours.
- The wordmark "TRAILBLAZE" in the display face Hot & Cold uses, with a small inline SVG under it:
  two trails, orange and blue, each making one right-angle turn, stopping a cell apart.
- Selected and primary buttons use the right rider's colour (the player's), never a third accent.

## Screens and what changes from Hot & Cold

### Menu — `screens/menu.ts`

- Title panel: wordmark; channel tag (`CH 03 · SPEED-UP`, two-digit index, title upper-cased);
  a line under it: originals "Game 3 of the 14 on the 1977 cartridge."; Remix "A Remix, opened
  by Boxed In." (the patch title).
- **Channel dial**: previous / next buttons (also `[` and `]`) and a strip of all 19 channels in
  four groups (Bordered, Wraparound, Doodle, Remix). Each entry shows its four facts as small
  inline SVG icons (`channelFacts`): speed (a flat line / a rising line), edges (a closed square /
  a square with open sides and arrows), steering (4 / 8 arrows), fire (none / a dashed trail /
  an eraser). Locked Remix entries show a lock and "Opens with <patch title>"; they can be looked
  at but not played.
- **Modes** for the selected channel (first one focused, Enter starts it):
  - duel channels: `VS A KID` (sub-line "Against Rosa", the picked Kid), `VERSUS` ("Two riders,
    one keyboard"), `VS COMPUTER 1977` ("The cartridge's own rider"; on channels 2 and 4 this is
    the first mode and the Kid mode is hidden).
  - Doodle channels: `DOODLE` ("Draw alone, nothing to crash into") and `DOODLE TOGETHER`
    ("Two pens, one board").
  - Four Way: `FOUR WAY` ("You and three Kids") and `FOUR WAY · TWO PLAYERS`.
- **Opponent picker**: the six Kid Polaroids (kit portraits) as in Hot & Cold, plus a seventh card,
  "Computer 1977", drawn by us in inline SVG: a plain beige box with a dark slot and one red lamp,
  no logos, no console shapes. A note under the picked card: one line per Kid (see below), and
  "Memory: Human / Sharp" from the Den setting as Hot & Cold shows it.
- **Look switcher**: four small swatch buttons (Neon Grid, Toy Trains, Mummy's Wrap, Ice Trail),
  each a tiny inline SVG of two trails in that look's colours on its background colour; the
  controller swaps the live arena behind the menu.
- Scoring: `First to 10` / `First to 5`. Switches: `Left switch B` / `Right switch B` toggles
  (A/B), with a hint "A: reversing straight back crashes you. B: it is ignored."
- Links: How to play · Settings · Records · Doodle gallery.
- Kid lines (our copy, keep exactly):
  - Grandpa Lou: "Reads the whole board, then turns a beat late."
  - Moss: "Claims the big side early and keeps clear of trouble."
  - Rosa: "Hunts you. She will cut straight across your path."
  - Benny: "Copies your turns a moment after you make them."
  - Dee: "The quickest hands on the street. Boxes herself in."
  - Pip: "Wanders about, then springs a trap out of nowhere."
  - Computer 1977: "Never blinks, never plans. Looks three cells ahead (six on switch A)."

### Pre-match — `screens/prematch.ts`

Two cards (four in Four Way): who rides (portrait, "You", "Player 2", a Kid or Computer 1977),
their colour and their trail pattern swatch, their switch, their keys (`WASD · Space` for the left
rider, `Arrows · Enter` for the right), and the look's name. "Press Enter or Space to ride" and a
3-2-1 that the controller drives (`setCount(n)`).

### HUD — `ui/hud.ts`

- Score tallies top centre in the seat colours, each with the rider's shape mark (left: a circle,
  right: a diamond; Four Way adds a square and a triangle) so colour is never the only clue.
- Speed indicator: five pips under the score, filled up to the current stage, with
  `aria-label="Speed 3 of 5"`.
- Queued turn: a small heading arrow beside each human rider's tally, shown from the tick a turn
  is latched until the step takes it (`setQueuedTurn(seat, heading | null)`).
- Pause button top right with an "Esc" hint. Messages as Hot & Cold's (`point`, `trap`, `win`).

### Results — `screens/results.ts`

- Score line in seat colours; winner line ("You win 10–6", "Rosa wins 10–8", "A draw at 10–10").
- Facts: longest ride (seconds, one decimal), cells claimed per rider, traps sprung per rider.
- Patches stitched this match, with the kit's patch art.
- **How Rosa saw it** (the Kid's name, whichever Kid it was; hidden for people and Computer 1977),
  collapsible, closed by default: a strip of four small canvas frames of the arena (2D, 4 px per
  cell, the two trail colours on a dark board) at 1.5 s, 1.0 s, 0.5 s before the Kid's last crash
  and at the crash, each with the Kid's awareness square outlined around its head, and a mark on a
  frame where its log shows a `slipped-late` (clock icon), `slipped-wrong` (crossed arrow) or a
  `missed` rival turn (closed eye), with a legend. Input type:
  ```ts
  export interface KidReplayFrame {
    readonly atMs: number; // ms before the crash, 0 for the crash itself
    readonly cells: Int8Array;
    readonly kidHead: Cell;
    readonly awareness: number;
    readonly marks: readonly ('slipped-late' | 'slipped-wrong' | 'missed')[];
  }
  ```
- Buttons in the order above; `R` and `H` keys; Share copies the line given by the caller.

### How to play — `screens/tutorial.ts`

Six short cards the player steps through (← →, Enter), each with a tiny looping inline SVG
animation (CSS animation, paused under reduced motion) and one or two lines of our copy:

1. "You never stop. Your rider keeps going; you only choose where it turns."
2. "Steer with WASD or the arrows. You cannot turn straight back on yourself."
3. "Every cell you leave becomes a wall. Ride into any wall and your rival scores."
4. "Box your rival in: close the gap and they have nowhere left to go."
5. "On speed-up channels the pace climbs every five seconds."
6. "Gaps: hold fire to leave holes. Wraparound: ride off one edge and in at the other."
   Done marks the tutorial seen (callback).

### Records — `screens/records.ts`

A table per channel group from `TrailblazeSave.records`: channel, opponent, memory, played, won,
lost, best margin, longest ride. Empty state: "No matches yet. Your records fill in as you ride."

### Doodle gallery — `screens/gallery.ts`

Up to twelve tiles, newest first: the drawing via `doodleSvg` inline, channel and date; buttons
Download SVG (callback) and Delete (asks to confirm, callback). Empty state: "Draw something in a
Doodle channel and press X to keep it here."

### Settings sheet — `screens/settings-sheet.ts`

Look (four swatches), Match length (10 / 5), Camera (Overhead / Chase), Colour-blind riders,
Reduced effects, and a **speed-up preview**: five small bars that light up in turn at the five step
paces (15, 12, 9, 6 and 3 ticks of 20 ms per cell), static under reduced motion.

## Tests required (`tests/screens/`, with `// @vitest-environment happy-dom` as Hot & Cold's `tests/screens-sheets.test.ts` does)

- Menu: modes per channel kind (duel, computer channel 2, doodle, four-way); `[`/`]` move the dial;
  a locked Remix cannot start; Escape calls back; every Kid line present.
- HUD: tallies with shape marks; speed pips and aria label; queued arrow shows and clears.
- Results: button order and R/H keys; "How Rosa saw it" hidden for people, present and collapsed
  for a Kid, four frames, marks rendered.
- Tutorial: six cards, keyboard stepping, done callback.
- Records and gallery empty states; gallery delete asks first.
- Settings sheet: each control calls back with the right patch.

Keep the suite under 10 s.

## Out of scope

The controller, the session, stores, the Hall, sound, three.js and the looks, and anything outside
the fence. If something you need from another module is missing, say so in the report rather than
adding it.
