# Hot & Cold — Changes from original

_Differences between the hidden-flag hunt on the 1978 cartridge and our game. The original's rules
and quirks are retold in [NOTES.md](NOTES.md); this page says what we kept, what we changed and why._

## Kept

- **The field and the clues.** Nine by seven squares that wrap on every edge, with 8 bombs, 27
  distances and 27 arrows round one flag. Distances count king's steps; arrows name one of eight
  regions, not a line. A check looks at the flag before the square's kind.
- **All ten variations**, as channels with their cartridge numbers:
  - race to 15;
  - turns to 15 (and the third one to 75);
  - hunt for hunt to 75 checks;
  - alone against the clock;

  each with a still, bouncing or wrapping flag. The table in NOTES.md was read from the program,
  because the written descriptions had six of them wrong.

- **The timing, to the tick.** A step every 16 ticks of about 39 ms, the button asleep for 7 after a
  step, a 15-tick wait between turns, the bomb's blast, the capture's celebration and the 75-tick
  clock.
- **The quirks:**
  - a flag on a bomb square is captured safely;
  - a bombed explorer stays put while the other one stands on its home corner;
  - the second seat's last hunt after the first reaches 75;
  - the difficulty switch slows steps only in the race, counts checks twice in hunt for hunt, and
    does nothing anywhere else, the clock's unused fast setting included.
- **Classic Memory.** A clue shows only while the button is held, as in 1978.

## Changed

| Original behaviour                                                                                                                                          | Woodgrain behaviour                                                                                                                | Why                                                                                                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| A field's whole layout followed from the flag's square, so there were only 63 fields, and a player who learned them could read the flag from the first bomb | Every field is a seeded shuffle with the same mix of bombs, distances and arrows; the layouts are our own                          | The hunt should be a deduction, not a lookup. The daily and challenge links still give everyone the same field |
| A press made while the button was still asleep after a step was lost                                                                                        | It is kept, and checks as soon as the button wakes, while it is still held and the explorer has not moved                          | A press the game ignores feels like a broken button                                                            |
| Hunt for hunt showed both totals and declared nothing                                                                                                       | The fewer checks wins, and the results say so                                                                                      | Players expect a match to have a winner; the totals are still shown                                            |
| The secret: older descriptions told of a bonus round for a perfect 75th check                                                                               | No bonus round, because the program has none (NOTES.md). The secret patch Lucky 75 is "find the flag with exactly your 75th check" | Faithful to the program, while keeping a little of the legend                                                  |

## Added

- **Notebook**, a clue mode that keeps every clue on the field.
- **The possibility fog**, an optional help that shades the squares the clues have ruled out. It is
  off in the daily, challenge links, the Power Cycle Run and Versus Night, and never makes a record.
- **The Neighbourhood Kids**, with human memory: they forget, mix clues up and miss what you
  found. "What Lou remembered" shows it after a match. The Den's Kid setting can make them Sharp
  instead: perfect memory, no wrong steps, twice as quick.
- **Three looks** (Polar Expedition, Tabletop Board, Radar Room), each designed for day and night.
- **Four Remix channels**: Two Flags, Minefield, Thin Ice and Drift Storm, opened by patches.
- **Mouse play** (click to walk, click again to check), **diagonal keys** for the eight-way
  joystick, a **short match** of 5, and **colour-blind palettes** for the clues and the explorers.
- **Den Life**: patches, the daily hunt, challenge links, micro-challenges and records.

## Removed

- Nothing a player would miss. The clock games' expert setting that the program never switches on
  stays off, as in 1978.

## Presentation

Bombs explode in each look's own style and send the explorer home with no harm done. The capture is
the high point, with its own fanfare in every look.
