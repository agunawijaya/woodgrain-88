---
id: tb-results-per-rider
kind: plumbing
model: gemini-3.8-flash-medium
fence:
  - games/trailblaze/src/screens/results.ts
  - games/trailblaze/tests/screens/results.test.ts
  - games/trailblaze/tests/progress/share.test.ts
acceptance:
  - pnpm exec vitest run --root games/trailblaze tests/screens/results.test.ts tests/progress/share.test.ts
  - pnpm exec eslint games/trailblaze/src/screens/results.ts games/trailblaze/tests/screens/results.test.ts games/trailblaze/tests/progress/share.test.ts
  - pnpm exec prettier --check games/trailblaze/src/screens/results.ts games/trailblaze/tests/screens/results.test.ts games/trailblaze/tests/progress/share.test.ts
reads:
  - games/trailblaze/src/screens/results.ts
  - games/trailblaze/src/progress/share.ts
  - games/trailblaze/tests/screens/results.test.ts
  - games/trailblaze/tests/progress/share.test.ts
---

## Goal

The Trailblaze results screen shows each rider's own numbers, so "Cells claimed 110 / 110" (which
read as one total) becomes a small table with one column per rider: **Cells laid** and **Traps
sprung**, each number under that rider's name in that rider's colour.

## Context

- `createResultsScreen` in `games/trailblaze/src/screens/results.ts` builds the markup as strings.
  The facts card is the `<dl class="tb-facts tb-card">` block near the "Facts" comment, with
  `.tb-facts` styles in the `STYLE` string.
- Both riders lay one cell on every step, so their counts are often equal; the table must make it
  obvious that each number belongs to one rider.
- Seats can be two (duel, versus) or four (Four Way). Solo Doodle has one.
- The title already states the winner first ("You win 10–6", "Moss wins 10–6"). The share line
  (`games/trailblaze/src/progress/share.ts`, not in your fence) states the sharer's score first.
  Do not change either; only add the tests below that pin this down.
- Copy is UK English, sentence case. No new copy beyond the strings in this order.

## Interface to implement

Rename the field in `ResultsSeat`; the lead updates the one caller in the controller.

```ts
export interface ResultsSeat {
  readonly name: string;
  readonly score: number;
  /** Cells this rider laid over the whole match. */
  readonly cellsLaid: number;
  /** Traps this rider closed on a rival over the whole match. */
  readonly trapsSprung: number;
  readonly colours: SeatColours;
  readonly isHuman: boolean;
}
```

## Behaviour and edge cases

1. Replace the facts `<dl>` with exactly this structure (one `<th scope="col">` and one `<td>` per
   seat, in seat order; names escaped with the existing `escapeText`):

   ```html
   <div class="tb-facts tb-card">
     <p class="tb-facts-longest"><span>Longest ride</span><strong>12.4 s</strong></p>
     <table class="tb-facts-table">
       <thead>
         <tr>
           <td></td>
           <th scope="col" style="--seat: #ff8a2a">You</th>
           <th scope="col" style="--seat: #38a8ff">Moss</th>
         </tr>
       </thead>
       <tbody>
         <tr>
           <th scope="row">Cells laid</th>
           <td>63</td>
           <td>58</td>
         </tr>
         <tr>
           <th scope="row">Traps sprung</th>
           <td>1</td>
           <td>0</td>
         </tr>
       </tbody>
     </table>
   </div>
   ```

   `--seat` is the seat's `colours.main`. The longest ride is formatted with one decimal and a
   space before "s" (`12.4 s`).

2. Replace the `.tb-facts div`, `.tb-facts dt` and `.tb-facts dd` rules with these, keeping the
   existing `.tb-facts` rule as it is:

   ```css
   .tb-facts-longest {
     margin: 0;
     display: flex;
     justify-content: space-between;
     gap: 12px;
   }
   .tb-facts-longest span {
     color: var(--tb-muted);
   }
   .tb-facts-table {
     width: 100%;
     border-collapse: collapse;
     font-variant-numeric: tabular-nums;
   }
   .tb-facts-table th,
   .tb-facts-table td {
     padding: 3px 0 3px 12px;
     text-align: right;
   }
   .tb-facts-table th[scope='row'] {
     padding-left: 0;
     text-align: left;
     font-weight: 400;
     color: var(--tb-muted);
   }
   .tb-facts-table td {
     font-weight: 700;
   }
   .tb-facts-table thead th {
     font-weight: 700;
     border-bottom: 3px solid var(--seat);
     padding-bottom: 4px;
     max-width: 9ch;
     overflow: hidden;
     text-overflow: ellipsis;
     white-space: nowrap;
   }
   ```

3. Four seats give four columns; one seat gives one column. Nothing else on the screen changes.
4. Update the file's top comment: "claimed cells" becomes "cells laid and traps sprung per rider".

## Tests required

In `games/trailblaze/tests/screens/results.test.ts` (update existing fixtures to `cellsLaid`):

- the facts table has one column header per seat, in seat order, with the seat's name;
- each "Cells laid" cell holds that seat's own number (use different numbers per seat, e.g. 63 and 58);
- "Traps sprung" likewise;
- four seats give four columns;
- the longest ride reads `12.4 s` for 12.43;
- a name with `<` is escaped in the header.

In `games/trailblaze/tests/progress/share.test.ts` (add; do not change `share.ts`):

- player seat 0 wins 10–6: `shareLine` ends with `· 10–6`;
- player seat 0 loses 6–10: ends with `· 6–10` (the sharer's score first);
- player seat 1 wins 10–4: ends with `· 10–4` and its symbols are 🟦 for seat 1's points;
- a point both crashed on counts for both and shows ⬜.

## Out of scope

`share.ts`, the controller, the banner wording, the Kid replay, patches, any other screen, any
other game. Do not add dependencies.
