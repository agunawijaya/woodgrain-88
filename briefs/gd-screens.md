# Brief: Gravity Duel's pre-match and results screens to Trailblaze's standard, and the keys

For: **engineer** (Sonnet subagent). From: the lead (prompt 05, stage 5 and the critique loop).

## Why

The lead looked at the real screens in `game.html`. The menu now matches Trailblaze. The pre-match
and results screens are bare by comparison, and three keyboard paths are dead:

- Enter on the menu does nothing, although the start button shows an "Enter" badge.
- The pre-match only answers a click on Ready.
- The results screen ignores R and H, though its buttons say "(R)" and "(H)".

## Read first

- `games/trailblaze/src/screens/prematch.ts`, `results.ts`, `menu.ts` (its `show()` focus) and
  `style.ts`: the model. Port the layout and behaviour into Gravity Duel's own code with `gd-`
  classes and Gravity Duel's tokens (`src/screens/style.ts`). Do not import from Trailblaze.
- The pictures to match: `games/trailblaze/docs/media/screens/ice-prematch-1920-dark.png` and
  `ice-results-1920-light.png`.
- Gravity Duel:
  - `src/screens/prematch.ts`, `results.ts`, `menu.ts`, `style.ts`;
  - `src/app/controller.ts`: `beginPlan`, `prematchSeat`, `countDown`, `finishMatch`,
    `resultsSeat`;
  - `tests/screens/*`, `tests/app/*`;
  - `AGENTS.md` (the navigation standard: results in the order Play again (R) · Game menu · Back
    to the Hall (H); in versus the first one reads Rematch (R)).

## Write fence

- `games/gravity-duel/src/screens/prematch.ts`, `results.ts`, `menu.ts` (only the `show()` focus),
  `style.ts` (only additions for these screens);
- the call sites in `games/gravity-duel/src/app/controller.ts`;
- `games/gravity-duel/tests/screens/*` and `tests/app/*`.

Nothing else. Keep the root class names `.gd-prematch` and `.gd-results`: another engineer's e2e
suite selects them. Give the results buttons `data-action="play-again"`, `"game-menu"` and
`"back-to-hall"`.

## Pre-match (as Trailblaze's)

- **A small header at the top centre:**
  - label "SPACE LOOK";
  - the look's name in the display face (`lookById(look).name`).
- **One card per seat, side by side and centred.** Solo docking has only seat 0, so one card and
  no "vs". Each card has:
  - the ship's close-up canvas in a dark well with a soft glow in the seat's colour;
  - a pilot row:
    - a Kid's portrait (`kidPortraitSvg(kid, { expression: 'photo', idPrefix })` from the kit),
      or a plain person icon in the seat colour for a person;
    - the pilot's name, bold;
    - "Flies <ship name>" under it (ship names from `SHIP_NAMES`).
  - a seat-colour dot and short stroke;
  - "Switch A/B";
  - the keys, people only ("Arrows · Enter", "WASD · Space");
  - a 4 px seat-colour bar along the card's bottom edge.
- **A footer card, bottom centre:**
  - before the countdown: "Press Enter or Space to fly";
  - during it, the count (3, 2, 1, then "Go!") in the display face, in the same place. Drop the
    full-screen count overlay.
- **Keys:**
  - Enter or Space: ready (ignore `event.repeat`);
  - Escape: back to the menu.
- **No visible Ready button.** Keep one for pointer users only if Trailblaze has one; follow
  Trailblaze.
- `PrematchSeat` gains `kid?: KidId`. The controller passes it for Kid riders.

## Results (as Trailblaze's)

The results sit in a right-hand column over the frozen field, which keeps drifting behind them.
Top to bottom:

1. **A banner card:**
   - the headline in the display face: "<Name> wins", "A draw", or for solo "<N> docks";
   - one line under it: "<Name> wins 10–3" in versus, "In <m:ss>" in solo if the controller has
     the time, otherwise leave the line out.
2. **Score cards:** two side by side, each with a seat-colour left edge, the pilot's name and the
   big score in the seat colour. Solo shows one card.
3. **A stats card:** a small table with one column per seat (one in solo), a seat-colour underline
   under each column heading. Rows:
   - shots;
   - hits;
   - accuracy;
   - fuel used;
   - star crashes (only where the channel has a star or binary stars);
   - docks (only in docking channels).

   Leave out a row that is zero for every seat and meaningless for the mode.

4. **PLAY AGAIN (R)**, or REMATCH (R) in versus: the wide primary button with an "R" key badge.
5. **Game menu** and **Back to the Hall (H)** side by side, with an "H" key badge on the second.
6. **The share line** in a small card, with a "Copy" link button when sharing is offered.
7. **Patches stitched this match**, as chips, if any.
8. **"How <Kid> flew it"**: the existing details element, restyled as Trailblaze's "How Rosa saw
   it" row.

Behaviour:

- R plays again;
- H goes back to the Hall;
- ignore repeats and modified keys;
- focus the Play again button when the screen shows.

`ResultsOptions.seats` becomes one or two seats, so the controller stops padding solo with a
placeholder seat.

## Menu

In `show()`, focus the primary start button (`.gd-modes .is-primary`) on the next animation frame
with `preventScroll`, as Trailblaze does, so Enter starts the match.

## Both appearances

- The header, cards and footer use the screens' tokens. They must read well in light and dark.
- Text keeps AA contrast.
- Keep `:focus-visible` rings.
- Honour reduced motion: no transitions.

## Done means

- `pnpm exec vitest run --root games/gravity-duel tests/screens tests/app` green; add tests for:
  - Enter/Space/Escape on the pre-match;
  - R/H on the results;
  - one card and one column in solo;
  - the menu focus.
- `pnpm exec tsc --noEmit -p games/gravity-duel`, plus eslint and prettier clean on the files you
  touched.
- No commits.

Report: files changed, the tests added, and anything in Trailblaze you chose not to port and why.
The lead will screenshot the result.
