# Trailblaze — Notes

_Verified behavioural facts, timing numbers, simulation sweeps and design records. Everything about
the 1977 cartridge is retold in our own words from the behaviour dossier and checks against the
program, with no addresses, bytes, tables, layouts or quotes._

## Dossier facts used

- **The board.** 40 columns by 20 rows. In the bordered variations the outer ring of cells is wall,
  which leaves 38 × 18 = 684 open cells. In the wraparound variations there is no wall, and a rider
  that leaves one edge comes back at the opposite one.
- **The start.** The left rider starts at column 10, row 10, heading right. The right rider starts at
  column 30, row 10, heading left. Riders never stop.
- **A step.** First every rider's current cell becomes trail (or is cleared, when fire is held where
  fire makes gaps or erases). Then the cartridge's computer, if it plays, looks at the board. Then
  turns are applied, and every rider moves one cell. A rider whose new cell is not empty has crashed.
  The trail is always one cell behind the head.
- **No rider-to-rider check.** The program never tests the two riders against each other, only
  riders against trail and wall. Two heads can share an empty cell.
- **Points.** Each crash gives the other rider a point. Both crashing on the same step gives both a
  point, so 10–10 is possible. First to 10 wins.
- **Timing.** One tick is one 50 Hz frame (20 ms). A step comes every 15 ticks (0.3 s, 3.3 cells per
  second). In the speed-up variations the gap between steps shrinks by 3 ticks every 256 ticks
  (5.12 s), down to 3 ticks (16.7 cells per second).
- **The crash pause.** It lasts 240 ticks (4.8 s), or 224 ticks (4.48 s) when only the right rider
  crashed.
- **The 14 variations.** These are the combinations of: one or two players, constant speed or
  speed-up, bordered or wraparound, four- or eight-way steering, and fire leaving gaps. Variations 13
  and 14 are free drawing, with no scoring, and fire erases. The full mapping is in
  `src/engine/variations.ts`, checked row by row against the dossier in
  `tests/engine/variations.test.ts`.
- **Difficulty switches.** For each rider, switch B ignores a straight reversal and switch A lets it
  through, straight into the rider's own trail. In variations 2 and 4 the left switch sets the
  computer's lookahead instead: 3 cells on B, 6 cells on A.
- **The computer.** It counts free cells along four rays in a fixed order: up, down, left, right.
  It keeps the best ray, with ties decided by a frame counter that flips every 64 frames
  (1.28 s). That flip is what gives its stair-step path through open space.

## Verified quirks and what we did with each

All of them are kept, and each one is pinned by a test.

| Quirk                                   | What happens                                                                                                                                                                                                       | Where it is tested                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| The diagonal hole                       | Reversal protection only checks cardinal headings. A rider moving diagonally can reverse straight into its own trail, even on switch B.                                                                            | `tests/engine/match.test.ts`, "1977 hooks" |
| What "reversal" means                   | On switch B the opposite part of a push is masked out. A pure reverse is ignored, but a diagonal push that contains the reverse becomes its side-on half. This was checked in the program by the crew and is kept. | `tests/engine/match.test.ts`               |
| Four-way steering with a diagonal push  | The horizontal half wins (checked in the program).                                                                                                                                                                 | `tests/engine/headings.test.ts`            |
| The computer obeys reversal protection  | Its choice goes through the same filter as a stick (checked).                                                                                                                                                      | `tests/engine/match.test.ts`               |
| The short pause for the right rider     | When only the right rider crashes, the pause is 224 ticks instead of 240, because a start value is reused.                                                                                                         | "1977 hooks"                               |
| Riders pass through each other          | Crossing paths in one cell is harmless. Meeting head-on in one cell crashes both on the next step, and so does swapping cells. Both score either way.                                                              | "1977 hooks"                               |
| The winning point skips the crash       | The match ends on the crash tick: no pause, the board frozen as it is.                                                                                                                                             | "1977 hooks"                               |
| The computer's uncapped lookahead       | When an early ray is short, a later ray's full length is kept uncapped, so the computer can briefly see a whole row or column.                                                                                     | `tests/ai/computer-1977.test.ts`           |
| The computer boxed in on every side     | It ends up steering right: each later ray passes an "at least as good" test on the short-ray branch. The order guessed "up"; the program says right, and right is kept.                                            | `tests/ai/computer-1977.test.ts`           |
| The attract timeout and the unused byte | Not gameplay. Told in ABOUT.md only.                                                                                                                                                                               | —                                          |

## Choices of our own

- **The speed-up clock starts with each round.** The cartridge counts with a frame counter that
  keeps running, so its first speed-up can come anywhere in the first 5 s of a round. Ours comes at
  exactly 5.12 s every round, so both players always get the same ramp. Listed in
  CHANGES-FROM-ORIGINAL.
- **Input is buffered one step.** The engine latches the last direction pushed before a step, so a
  quick tap between two steps is never lost.
- **The picture runs a little behind the rules.** On screen, a rider crosses each cell along a
  curve during the step after the rules moved it. Turns read as curves, at the cost of about one
  cell of lag on average (0.3 s at the starting speed, 0.06 s at top speed). Rules and inputs are
  not affected.

## How the Kids ride

The Kids are ours, not the cartridge's; the 1977 program had only its computer. A Kid rider
(`src/ai/kid.ts`) sees and steers the way a person does:

- **What it sees.** Trail within its awareness radius of its head; beyond that, open floor. The
  other bike counts as a wall, and so do the cells it will cover while the Kid's own hands react.
  The cells the Kid itself rides through before its turn count as trail too, or a dead end would
  seem to open out behind it.
- **When it turns.** It decides at each step, and again when it notices the rival turn. It plans
  from where it will be when its hands act, not from where it is. A wall it saw coming only has to
  be timed (35% of a reaction). The rival's bike or fresh trail in the way needs the whole reaction.
- **How sure it is.** A turn has to be open wherever the hands might land, give or take one spread
  of its reaction. At speed, a Kid with unsteady hands stops aiming for one-cell gaps.
- **How much road it wants.** At least one reaction's worth of open road ahead of every course it
  takes, more if it is careful (doubled at full caution). At the starting speed that is under a
  cell, so nothing changes. At top speed a slow, careful Kid keeps turning away and gives up room,
  and a quick one rides close. This is what makes fast hands count more at speed.
- **What it wants.** Space, safety, cutting across the rival three cells ahead of the bike, and
  copying the rival's turns, each weighted by its planning style. Riding straight on gets a small
  bonus, so a Kid does not weave when every way is as good. A small whim breaks ties.

## Feel numbers

| Parameter          | Value                                               | Feel rationale                                       |
| ------------------ | --------------------------------------------------- | ---------------------------------------------------- |
| Tick               | 20 ms                                               | The cartridge's own frame, so every timing is exact. |
| Step periods       | 15, 12, 9, 6, 3 ticks                               | 3.3, 4.2, 5.6, 8.3 and 16.7 cells per second.        |
| Speed-up interval  | 256 ticks (5.12 s)                                  | As the cartridge.                                    |
| Crash pause        | 240 ticks, or 224 when only the right rider crashed | As the cartridge.                                    |
| Computer lookahead | 3 cells (switch B), 6 cells (switch A)              | As the cartridge.                                    |

## Performance

`perf.html` lays every open cell of the arena (both riders snaking through half the board) and
measures steady-state frames at 1920×1080, quality High, after the first second.

- **Discrete GPU** (the development laptop's GeForce RTX 4060 Laptop, Direct3D 11 through ANGLE):
  60 fps median and 60 fps in the slowest 5% in all four looks, light and dark. That is the display's
  refresh, so the real ceiling is higher.
- **Integrated GPU** (the same laptop's Intel UHD, which a browser picks when Windows sends it to
  the power-saving GPU): 15–24 fps with the full board, and no better with an empty one. The stage
  (shadow maps, bloom, reflections at full resolution) is the cost, not the trails. Medium quality
  helps (Toy Trains: 10 → 17 fps). A device this weak should start on Medium or Low.

The full board costs nothing measurable over an empty arena: the trail pieces are instanced, and
the swept curves are built once per cell.

## Simulations

Seeded headless matches to 10 points, seats alternating except against the computer, which keeps
the left rider as on the cartridge. The tuning runs used seeds 50 000–79 999 plus three fresh sets
for checking. The final values were checked on a set never used for tuning (240 matches per line).
The locked tests (`tests/sim/balance.test.ts`, opt-in with `TRAILBLAZE_BALANCE=1`) use seeds from
31 000, 160 matches per line, and allow 5 points of sampling noise either side of a band.

| Scenario                                           | Matches | Result                                    | Target                     |
| -------------------------------------------------- | ------- | ----------------------------------------- | -------------------------- |
| Lou against Pip, variation 1                       | 240     | Lou wins 84%                              | 75–90%                     |
| Lou against Pip, variation 3 (speed-up)            | 240     | Lou wins 65%                              | lower than variation 1     |
| Moss against Dee, variation 1                      | 240     | Moss wins 70%                             | 55–70%                     |
| Moss against Dee, variation 3                      | 240     | Moss wins 59%: Dee's rate rises 11 points | Dee rises at least 8       |
| Moss against Computer 1977 (switch B), variation 2 | 240     | Moss wins 95–100%                         | 60–80% (missed, see below) |

**Computer 1977 is weaker than the target assumed.** It counts free cells along four rays, up to
three ahead, and turns down the longest, with no sense of the space behind. A Kid that reads the
board fills its own side while the computer rides into pockets. Making it lose only 60–80% of the
time would mean either a smarter computer (not the cartridge's) or a weaker Moss (who must also
beat Dee). We kept both faithful and locked the measured band (85–100%) instead. On switch A it
looks six cells ahead and lasts longer. The Old Machine patch asks for that.

**What tuning changed** (from the prompt's starting table, which said to tune by simulation):

| Kid         | Changed                                                                                                                  | Why                                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lou         | 330 → 360 ms, lookahead 9 → 7, awareness 12 → 9, slips 3% → 5%                                                           | Beat Pip almost every match. A beat later on every turn is still Lou ("turns late")                                                                              |
| Moss        | awareness 12 → 7, slips 4% → 6%                                                                                          | Won 80%+ against Dee once the Kids stopped seeing space leak out of dead ends                                                                                    |
| Rosa, Benny | awareness 7 → 6                                                                                                          | Keeps "medium" below Moss                                                                                                                                        |
| Dee         | 180 ± 60 → 160 ± 30 ms, attention 0.6 → 0.7, panic 0.75 → 0.6, slips 10% → 5%, style 0.3 · 0.4 · 0.2 → 0.25 · 0.25 · 0.4 | Her cutting off won slow games and threw fast ones away. With less of it and steadier hands, speed helps her as it should. Panic is still the highest of any Kid |
| Pip         | ± 120 → ± 60 ms, panic 0.7 → 0.5, slips 14% → 8%, cut-off 0.6 → 0.4                                                      | He lost every match. He still has the widest spread of any Kid and wanders                                                                                       |

Panic itself was softened in the kit: full panic stretches a reaction by half (it used to double
it), doubles the slip rate (it used to triple it), and no longer narrows what a Kid reads. See
ADR-0012.

**Other runs.** A scripted space-filling rider lays at least 616 of the 684 open cells of a
bordered arena (90%) before it runs out of room; the prompt's "800 cells" counts the border too.
Lou rides alone for at least 280 cells on each of seeds 101–105 (the space-filling
test in `tests/ai/kid.test.ts`). The engine fuzz test (`TRAILBLAZE_FUZZ=1`) plays 100 000 random
input streams: no rider ever stands on a trail cell without a crash, and the scores always add up.

## Open questions

- None on the rules.
- Computer 1977 against Moss: the prompt's 60–80% band is not met (see Simulations). Owner's call
  whether a stronger computer is wanted; the faithful one stays the default.
- The Den has no Kid memory setting (Human / Sharp) yet, so the Kids ride as Human. When it
  arrives, `reflexProfile(kid, mode)` and `memoryProfile(kid, mode)` already take it.
- A Kid's decision costs 0.5–1 ms (floods for space within its awareness). Two Kids at top speed
  spend about 3% of each second on it; the test holds it under 1 ms.
- On average the picture runs one cell behind the rules: 0.3 s at the starting speed. The feel pass
  (stage 6) should try starting each curve a step early from the latched turn, which the engine
  already knows before the step.
