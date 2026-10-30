# Hot & Cold: notes

Working notes for the game. They cover what the 1978 hidden-flag hunt does (told in our own words),
how we carried it over, and what the simulations say. The original is described only as behaviour.
Nothing from its program, its tables or its screens is copied into this repository. Our fields come
from our own seeded generator.

## What the 1978 game does

These notes were checked against the behaviour dossier (`research/`, kept off the repository). The
lead also read the program directly, in prompt 03, for every point marked _read_.

- **The field.** Nine columns by seven rows: 63 squares, numbered row by row from the top left.
  - Each round hides one flag and lays 8 bombs and 27 distance squares; the remaining 27 squares,
    and the flag's own square, are arrows.
  - Clues are worked out when a square is checked: a distance is the larger of the column and row
    gaps to the flag (1 to 8, never wrapping round the edge). An arrow points along the row or
    column when the flag shares it, and otherwise diagonally, however steep the true line. So an
    arrow names one of eight regions, not a line.
- **The flag first.** A check compares the square with the flag before looking at the square's kind.
  A flag standing on a bomb square is captured safely. _Read._
- **Bombs.** A short blast (8 ticks, about a third of a second), then the explorer goes back to its
  home corner, unless the other explorer is standing on that corner. Then it stays where it is.
  Seat 1's home is the top-left corner, seat 2's the bottom right. _Read._
- **Moving flags.** In the moving variations the flag takes one step after every check that misses
  it, bombs included. _Read._
  - Its heading is one of the eight compass points, chosen when the field is laid, and never zero.
  - A bouncing flag reflects off an edge: from the last column it steps back to the one before,
    and that part of its heading flips.
  - A wrapping flag leaves one edge and comes back in at the other. _Read._
- **Moving explorers.** Eight directions, one square every 16 ticks while held (about 0.63 s). The
  field wraps on every edge. Two explorers can never share a square: a blocked step simply does not
  happen, though the step timer starts again.
- **Checking.**
  - After a step, the button sleeps for 7 ticks.
  - A press checks the square, and while the button is held the clue shows and the explorer cannot
    move. In 1978 that was the only time a clue showed.
  - Letting go completes the check, and the next step waits a full step.
- **No computer opponent.** Every seat is a person at a joystick. Our Neighbourhood Kids are new.

### The ten variations

The dossier misread six of the ten. The lead decoded the program's variation settings directly, and
the behaviour is as follows (_read_):

| Variation | How it is played                   | Flag     | The end                         |
| --------- | ---------------------------------- | -------- | ------------------------------- |
| 1         | Race: both seats at once           | still    | first to 15 captures            |
| 2         | Turns: one check each in turn      | still    | first to 15                     |
| 3         | Turns                              | bouncing | first to 15                     |
| 4         | Turns                              | wrapping | first to **75**                 |
| 5         | Hunt for hunt: whole hunts in turn | still    | a seat's checks reach 75        |
| 6         | Hunt for hunt                      | bouncing | a seat's checks reach 75        |
| 7         | Hunt for hunt                      | wrapping | a seat's checks reach 75        |
| 8         | Alone against a 75-tick clock      | still    | the clock runs out (about 92 s) |
| 9         | Alone against the clock            | bouncing | the clock runs out              |
| 10        | Alone against the clock            | wrapping | the clock runs out              |

How each style plays:

- **Turns.**
  - Each check and its release hand the turn over. The next seat may check only after 15 ticks.
  - After a capture, the seat that captured sits out the start of the next field.
- **Hunt for hunt.** Every check counts against the seat that makes it, the capture included, golf
  style.
  - Seat 1 hunts a whole field alone; then seat 2 hunts the next one; and so on in turn.
  - When seat 1's total reaches 75, seat 2 gets one last field, so both have had the same number of
    turns. When seat 2's total reaches 75, the game ends at once.
  - Fewer checks is better. The program shows both totals and declares nothing.
- **The clock.**
  - It counts down one tick every 31 updates, about 1.22 s.
  - At zero the explorer freezes for one last tick, then time is up and the flag is shown.

### Hooks and verdicts

1. **Variation 4 plays to 75 captures.** Variations 2 and 3 play to 15. The cut between "15" and
   "75" falls one variation too early: it sits where the check-counting games begin. So the third
   turns game becomes a marathon. **Kept.** It is the cartridge's variation 4, and the channel's
   description says so. The Short match length (first to 5) is there for anyone who would rather
   not.
2. **The fast clock that never runs.** The clock games contain an expert setting that would make
   the clock count down two ticks at a time. The setting that switches it on is cleared in all
   three clock variations, so it never happens. **Kept as it is:** the difficulty switch does
   nothing to the clock.
3. **The switch elsewhere.**
   - Switch A slows an expert's steps by a quarter (20 ticks instead of 16) in variation 1 only.
   - In hunt for hunt (5–7) it counts every check twice.
   - In the turns games and the clock games it does nothing.

   **Kept** exactly. The game's settings say which switch does what in each channel.

4. **The equal-turns rule is not a slip.**
   - The brief, following the dossier, took the rule that hands seat 2 a last field for a misplaced
     tie-breaker. On that reading, a solo player finding the flag on exactly the 75th check got a
     bonus round.
   - Read directly, the rule sits exactly where it belongs: in the two-seat hunt-for-hunt games,
     where it gives both seats the same number of hunts.
   - **Kept as designed.** The owner turned the secret patch "Lucky 75" into "find the flag with
     exactly your 75th check" (2026-10-27).
5. **Home-corner immunity.** A bombed explorer stays put when the other explorer stands on its home
   corner. **Kept.**
6. **A flag on a bomb square.** It is caught safely, because the flag is checked first. **Kept.**
7. **A capture at the last moment of the clock.** A capture whose celebration ends with the clock
   already at zero is not counted: the game ends first. **Kept.** It is a fraction of a second, and
   faithful.
8. **The fields.**
   - In 1978 a field's whole layout followed from where the flag was. The flag square fed a small
     shift register, and the bombs and distances followed its sequence, so there were only 63
     distinct fields. A player who learned them could read the flag from the first bomb.
   - **Changed.** Our fields are a seeded shuffle with the same composition, and the layouts are
     our own. See CHANGES-FROM-ORIGINAL.md.

## Feel numbers

Every timing is counted in the original's per-seat update, a tick of 2 / 50.77 s (about 39 ms). The
engine runs on the same ticks.

| Parameter                     | Ticks | Seconds | Source             |
| ----------------------------- | ----- | ------- | ------------------ |
| Step while held               | 16    | 0.63    | 1978               |
| Step, switch A in variation 1 | 20    | 0.79    | 1978               |
| Button asleep after a step    | 7     | 0.28    | 1978               |
| Wait for the next turn        | 15    | 0.59    | 1978               |
| Bomb blast                    | 8     | 0.32    | 1978               |
| Capture celebration           | 32    | 1.26    | 1978               |
| One clock tick                | 31    | 1.22    | 1978               |
| Clock                         | 75    | ~92     | 1978               |
| New field: wait before moving | 16    | 0.63    | 1978 (first steps) |

Our addition: a press made while the button is still asleep is kept until it wakes, as long as it
is held and the explorer has not moved. In 1978 such a press was simply lost.

**The picture never trails the rules (prompt 03a).** A step used to be drawn over the whole 16-tick
step, while the rules let the explorer check its new square after 7. A player who pressed as soon
as the button woke saw the explorer still sliding in. A step is now drawn within the 7-tick settle
time, so the explorer stands on its square the moment a check is allowed, and a held direction
reads as brisk steps with a short stand between them, as the 1978 explorer moved square by square.

## The Kids' memory

The kit's `kids/memory` model is described in ADR-0011 and the game author's guide. These are the
values Hot & Cold uses, unchanged from the brief.

| Kid   | Capacity | Half-life | Distortion | Attention | Rehearses |
| ----- | -------- | --------- | ---------- | --------- | --------- |
| Lou   | 9        | 120 s     | 2%         | 90%       | yes       |
| Moss  | 7        | 90 s      | 4%         | 80%       | yes       |
| Rosa  | 6        | 60 s      | 6%         | 85%       | no        |
| Benny | 6        | 60 s      | 5%         | 95%       | no        |
| Dee   | 4        | 30 s      | 10%        | 50%       | no        |
| Pip   | 3        | 20 s      | 18%        | 40%       | no        |

- **Salience.** Own finds weigh 1.3, the rival's 1. Striking clues weigh a further 1.5: bombs,
  finds, and distances of 1 or 2. Rosa weighs the rival's finds at 1.4 and Benny at 1.5.
- **Distortion grows with fading.**
  - The first model rolled the brief's distortion at every recall. A Kid recalls at every decision,
    so even a five-second-old clue got mixed up again and again. Pip and Dee lost 98% and 81% of
    races they should win sometimes.
  - Now the chance is the distortion **times how far the fact has faded**. A fresh clue comes back
    exactly, a half-faded one is wrong half as often as the table says, and a nearly faded one
    almost as often. The brief's numbers stand; only their meaning is "once the memory has
    faded".
- **A misremembered clue** is a distance off by one, an arrow turned a notch, or the clue pinned to
  the next square. Contradictions are settled by trusting the stories that break the fewest
  remembered facts.
- **In Notebook** the clues stay on the field, so memory does not limit what a Kid can see. It reads
  only as many clues per decision as its capacity: its own first, or the rival's first for Rosa and
  Benny.
- **The Den's Kid setting (prompt 03a).** Human is the default and everything above. Sharp gives
  every Kid the kit's perfect memory, no wrong steps (`fumble` 0), and half the time to think and to
  stand between steps (`huntStyle` in `ai/styles.ts`, the kit's reflex rule applied to this game's
  styles). The rest of each Kid's character stays. The setting is read when a match starts. The
  game's records keep Sharp boards apart, and the Hall marks Sharp runs and share lines "Sharp
  Kids". The balance numbers below are all Human.

## The Kids at play

All Kids reason with the same solver. Every story of the flag that fits what they remember is kept:
for a moving flag, where it started and which way it heads. A Kid heads for the square with the best
value. The value weighs:

- the chance the flag is there;
- the bits a check there should tell;
- the steps to get there (in the race and the clock only; in turns and hunts only checks count);
- for some Kids, bombs nearby and the rival.

| Kid   | Plays like                                                                                                                     |
| ----- | ------------------------------------------------------------------------------------------------------------------------------ |
| Lou   | Information first, goes straight for the flag once two squares remain; thinks 1.1 s and pauses 0.3 s after every step          |
| Moss  | The same discipline, but gives squares next to remembered bombs a wide berth (which costs it checks)                           |
| Dee   | Heads for the likeliest square, decides in 0.25 s, checks squares on the way three times in ten, fumbles a step one time in 20 |
| Pip   | Wanders off to a random nearby square three times in ten; one step in eight goes astray                                        |
| Rosa  | Races the rival to likely squares it can reach first, and reads the rival's clues first in Notebook                            |
| Benny | Follows the rival's clues and conclusions, which also stick better in its memory                                               |

Departures from the brief:

- **Rosa.** The brief has Rosa park on the player's home corner. Under the 1978 rule that would
  spare the player from a bomb, not trap them, so Rosa instead races the player to squares and
  stands in their way.
- **Lou in the race.** Lou loses most races to Moss, because he walks slowly. He beats her at hunt
  for hunt and in turns, where time does not count. The Block Ladder's order is unchanged.

## Simulations

All runs are seeded; reproduce with `tsx scripts/simulate.ts` in this folder. The Kid duels
alternate seats every match.

### Solving

| Scenario                                        | Runs       | Result                                             | Target             |
| ----------------------------------------------- | ---------- | -------------------------------------------------- | ------------------ |
| Exact solver, still flag, no walking            | 100,000    | flag never lost; median 4 checks, 95th 7, worst 14 | always solvable    |
| Exact solver, bouncing flag                     | 100,000    | never lost; median 5, 95th 8, worst 14             | always solvable    |
| Exact solver, wrapping flag                     | 100,000    | never lost; median 5, 95th 12, worst 22            | always solvable    |
| Perfect hunter, walking, variation 5 (one hunt) | 1,000      | median 4, 90th 5                                   | median 4–8         |
| Lou, Classic Memory, variation 5                | 1,000      | median 4, 90th 5 (equal to perfect)                | ≤ perfect + 2      |
| Perfect / Lou (Classic), variation 6            | 1,000 each | median 4 / 4                                       |                    |
| Perfect / Lou (Classic), variation 7            | 1,000 each | median 5 / 5                                       |                    |
| Pip, Classic Memory, variations 5 / 6 / 7       | 1,000 each | median 5 / 7 / 8, 90th 10 / 21 / 22                | (shaky, by design) |

### Duels (race to 5, Classic Memory, human memory)

| Pair             | Matches                    | First Kid wins    | Target |
| ---------------- | -------------------------- | ----------------- | ------ |
| Lou against Pip  | 1,800 over three seed sets | 85.1% (82.7–86.7) | 75–90% |
| Moss against Dee | 1,800 over three seed sets | 61.6% (60.3–62.7) | 50–70% |

Both are locked in `tests/balance.test.ts` (900 matches each, run with `HC_BALANCE=1`), at
72–93% and 47–73%.

### Other channels (600 matches each, Classic Memory unless noted)

| Variation                 | Lou–Pip | Moss–Dee | Lou–Moss        | Rosa–Benny      | Dee–Pip         |
| ------------------------- | ------- | -------- | --------------- | --------------- | --------------- |
| 1 Race, Notebook          | 74%     | 49%      | 29%             | 47%             | 81%             |
| 2 Turns                   | 98%     | 94%      | 57%             | 44%             | 68%             |
| 2 Turns, Notebook         | 91%     | 86%      | 50%             | 51%             | 65%             |
| 3 Turns, bouncing         | 100%    | 99%      | 65%             | 41%             | 78%             |
| 5 Hunt for hunt           | 89%     | 72%      | 33% (38% draws) | 32% (35% draws) | 55% (22% draws) |
| 6 Hunt for hunt, bouncing | 95%     | 78%      | 34% (34% draws) | 33% (34% draws) | 57% (21% draws) |

Notes:

- Hunt for hunt draws often: equal totals are common over short matches.
- In the turns games memory rules: Pip and Dee rarely win there.
- Notebook narrows the gaps in the race, because nobody forgets.

Tuning took about an hour, within the two-hour box. These are the changes it made, in order:

1. Pip wanders 3 in 10 rather than 9 in 20, and fumbles 7 in 100 rather than 12 in 100.
2. Dee weighs information at 0.55 rather than 0.2, and checks on the way 3 in 10.
3. Lou commits at two squares, with his flag weight down to 1.4.
4. The "fading memories blur" rule (above).

Four AI bugs found by the simulations were fixed along the way:

- After a bomb's blast, a Kid held the button forever.
- A Kid aimed for the square the rival stood on.
- The path could not walk round the rival on the field's wrap.
- "Commit to the flag at N squares" was inverted.

## Play decisions

- **Scores read "higher is better" everywhere.** Race, turns and the clock score flags found; hunt
  for hunt scores the flags found within the 75 checks (the match itself is won on fewest checks).
  The daily is the one hunt where fewer checks is the point. Its score is points, 25 less the checks
  taken and never below 1, so the Hall's records sort it the right way. Its label and share line
  say the checks plainly: "4 checks".
- **The fog never makes a record.** A run with the possibility fog on counts as played and can
  stitch patches, but it never becomes a best on the game's own records. The results card says
  "Not a record: the fog was on". The fog is off and locked in the daily, challenge links, the Power
  Cycle Run and Versus Night, and the settings sheet says why. Two Flags has no fog: the solver
  models one flag.
- **Keys:** the 1978 joystick had eight directions. Each seat gains four diagonal keys where they
  are free (Q E Z C beside WASD; the keypad's 7 9 1 3 for the arrows, with 8 4 6 2 walking too), and
  holding two directions also steps diagonally. Alone, the arrows and Enter; on a shared keyboard,
  seat 1 has the arrows and Enter, seat 2 WASD and Space (the owner's rule).
- **Mouse:** click a square and the explorer walks there on the 1978 clock, the shortest way round
  the wrapped edges and the other explorer. Click the square it stands on to check it (Classic
  Memory shows the clue while the button is down). Click the walk's target again to check on
  arrival. The mouse drives the only person playing, or in turns and hunt for hunt the person whose
  turn it is. In a two-person race it stays off: one mouse cannot be fair to both.
- **Ties between equally short paths** go to the one nearest the straight line. Without that, a
  Kid or a mouse walk would step off one edge and back in when a straight walk was just as short.
- **Thin Ice** melts Notebook clues 10 s after they are checked, for the Kids too: a Kid reads only
  what is still on the field.
- **Sound** has one cue per meaning in all three looks: step, check, distance (its note climbs two
  semitones for each step nearer), arrow, bomb, the trip home, a bump, a turn, the clock's last ten
  ticks and the flag's fanfare. The snowfield crunches and chimes, the tabletop clicks like wood,
  the radar pings.
- **A Polar bomb** throws up a pale snow plume that clears in about a second. The arena's tank soot
  hid the field for several seconds. By day the plume is smaller and shadowed blue-grey (prompt
  03a): at full size the white burst on white snow whited out the explorer it had just thrown.
- **A Radar bomb** is a round patch of static that thins towards its rim and lies under the blip and
  the bomb mark. The first square patch spilled over the plot's edge and hid the blip it hit.
- **Channel groups (prompt 03a):** Race (1), Turns (2 to 7, hunt for hunt included, since its seats
  take turns), Solo (8 to 10, the clock) and Remix, as the Hall's channel picker lists them.
- **The pause menu's Look and Clues items (prompt 03a).** Look applies at once, on the running
  match: the session moves its view to the new look and redraws what has been revealed. Clues
  applies from the next match, and the item says so, because records are kept per clue mode and a
  match must not change mode halfway.

## Open questions

- **Variation 4's marathon.** Variation 4 to 75 captures takes over an hour between Kids. Cartridge
  length is faithful, and Short is the default suggestion in its channel card. Should the game warn
  before starting it?
- **Turns between unequal Kids are one-sided:** Lou beats Pip 98%. The brief sets no target here. If
  the owner wants closer turns games, the lever is Pip's memory or wandering in turns only.
