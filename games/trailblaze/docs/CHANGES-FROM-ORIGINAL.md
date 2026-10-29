# Trailblaze — Changes from original

_Differences between the trail duel on the 1977 cartridge and our game. The original's rules and
quirks are retold in [NOTES.md](NOTES.md); this page says what we kept, what we changed and why._

## Kept

- **The rules, exactly.** A 40 × 20 board, riders that never stop, a trail one cell behind the head,
  a crash into any wall or trail gives the other rider the point, both crashing gives both a point,
  first to 10. The same step timing to the tick: 15 ticks of 20 ms at the start, 3 at top speed, a
  speed-up every 256 ticks, crash pauses of 4.8 s (4.48 s when only the right rider crashed).
- **All 14 variations**, as channels with their cartridge numbers: one or two players, constant
  speed or speed-up, bordered or wraparound, four- or eight-way steering, gaps, and the two free
  drawing variations (our Doodle channels).
- **Every quirk**, each pinned by a test:
  - riders pass through each other;
  - the diagonal hole in reversal protection;
  - the short pause when only the right rider crashes;
  - the board freezing on the winning point;
  - the computer's stair-step path, its uncapped lookahead and its habit of steering right when
    boxed in.
- **The difficulty switches**: on B a straight reversal is ignored, on A it goes through. On the
  computer's channels the left switch sets how far the computer looks ahead.
- **The computer opponent**, as "Computer 1977": the same ray counting, the same tie-break clock,
  the same blind spots. It is not made any smarter.

## Changed

| Original behaviour                                                                                                | Woodgrain behaviour                                                           | Why                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| The speed-up clock keeps running across rounds, so a round's first speed-up can come at any time in its first 5 s | The clock starts with each round: the first speed-up always comes at 5.12 s   | Both riders get the same ramp in every round. A rule that depends on how long the last crash pause happened to run reads as random               |
| A turn pressed between two steps is read only if the stick is still held at the step                              | The last direction pushed before a step is kept until that step               | A quick tap is never lost, and keyboards tap more than joysticks do                                                                              |
| Riders jump a whole cell at each step                                                                             | Riders glide along curves, turning smoothly through the corner of a cell      | Light-bikes, trains, mummies and skaters do not move in jumps. The rules still move them a whole cell at each step; only the picture is smoothed |
| One colour per rider                                                                                              | Colour plus a shape and a trail pattern per rider, and a colour-blind palette | Riders are told apart without relying on colour                                                                                                  |

## Added

- **Neighbourhood Kids** as opponents, with human reflexes: each reacts late by its own amount,
  reads only so far ahead, misses some of your turns, gets rattled at speed, and fumbles now and
  then. After a match, "How Rosa saw it" shows what the Kid saw and where it slipped.
- **Four looks**, each with a light and a dark version: Neon Grid, Toy Trains, Mummy's Wrap and Ice
  Trail. Each has its own riders, trails, crash and watcher. Rules, timing and controls are the same
  in all four.
- **Five Remix channels**, opened by patches: Fading Trails, Ghost Trails, Shrinking Arena, Boost
  Lanes and Four Way.
- **Patches, micro-challenges, the daily channel and challenge links**, through Den Life.
- **Doodle export**: a drawing from a Doodle channel can be kept as an SVG picture in the look's
  colours, and the last twelve stay in a local gallery.
- **The Chase camera**: playing alone, the picture can follow your rider closely instead of showing
  the whole board.
- **Records** per channel, opponent and Kid setting, and a share line with one symbol per point.

## Removed

- **The attract timeout.** The cartridge drops into its demo after a while without input. The Hall
  has its own attract mode; inside the game nothing times out.

## Presentation

Crashes are arcade-style and cartoon, never hurtful:

- light-bikes burst into shards of light;
- toy trains tip over with a clonk while the conductor whistles;
- a mummy is wrapped up in its own bandage and topples;
- a skater slips and sits down hard, and the snowman watching melts and is built again.

The trap closing, the moment the last gap seals, has its own effect and sound in every look. Each
look has a watcher at the top of the arena who reacts to every crash.
