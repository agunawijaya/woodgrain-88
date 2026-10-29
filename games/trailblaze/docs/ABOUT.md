# Trailblaze — About

_Every cell you ride becomes a wall. Box your rival in first._

## The hook

You cannot stop. Your rider runs on across the arena, and every cell it leaves becomes a wall
behind it. Your rival does the same. For a while the board is wide open and you can go anywhere.
Then the walls start to meet, the open space breaks into pieces, and every turn is a bet: claim
the big side, or cut across your rival's path and seal the last gap in front of them. One of you
runs out of room first. Then a new round starts, the board is clean, and you get to do it better.

## Inspired by

Inspired by the trail duel, slot 8 on the 1988 cartridge. The original from 1977 is a tiny program
with big ideas. It has fourteen variations from one handful of switches:

- one or two players;
- a steady pace, or one that climbs every five seconds;
- walled edges, or edges that wrap round;
- four directions or eight;
- trails with gaps;
- and two free-drawing modes where the trail is a pen.

**The computer opponent** is simple and honest. It counts the free cells along four straight lines
from its head and turns down the longest one. It looks three cells ahead, or six when the left
difficulty switch is on A. To break a tie it consults a clock that flips every 1.28 seconds. That
clock is why it rides in stair steps across open ground, and why it can be lured into a pocket it
cannot see the end of. Trailblaze keeps it exactly as it was, as "Computer 1977".

**The quirks we kept, and why they happen:**

- **Riders pass through each other.** The program only ever checks a rider against the walls and
  trails on the board, never against the other rider, so two heads can share a cell. A rider that
  meets the other head-on still crashes a moment later, into the trail just laid.
- **The diagonal hole.** The switch that stops you steering straight back into yourself only knows
  the four main directions. Riding diagonally, you can reverse into your own trail on either
  switch.
- **The shorter pause.** When only the right rider crashes, the pause before the next round is a
  little shorter, because the program reuses a start value for its countdown.
- **The frozen finish.** The winning point does not play out at all: the board simply stops where
  it is, the final trails left on screen.

**Two curiosities.** Leave the cartridge running for about 21 minutes 51 seconds without pressing
reset (a long drawing session will do it) and a counter overflows. The game drops back into its
attract mode, cycling the screen's colours to spare the television's phosphor. The program also
keeps one byte of memory that it sets and clears but never reads. What it was for, nobody can tell
from the program alone. Neither changes a match, and Trailblaze leaves both out.

## What is new

- **Four looks**, switchable at any time, even mid-match:
  - **Neon Grid**: light-bikes leave glowing walls.
  - **Toy Trains**: wind-up locomotives lay their own track across a playroom mat.
  - **Mummy's Wrap**: two runaway mummies unspool their bandages through a tomb.
  - **Ice Trail**: skaters carve ridges of ice on a frozen lake.

  Each has its own crash and a watcher who reacts to it: a conductor's whistle, a priest's
  lightning, a snowman who melts and is built again.

- **Neighbourhood Kids** to ride against, each with human reflexes: Dee's quick hands, Grandpa
  Lou's patience, Rosa's habit of cutting across you. After a match, "How Rosa saw it" shows what
  the Kid saw in its last seconds and where its hands slipped.
- **Five Remix channels**, opened by patches:
  - **Fading Trails**: walls melt after eight seconds.
  - **Ghost Trails**: walls vanish from sight but stay solid.
  - **Shrinking Arena**: the border closes in.
  - **Boost Lanes**: lanes double your speed.
  - **Four Way**: four riders, one from each corner.
- **Doodle**: the two drawing variations, with your picture kept as an SVG in the look's colours.
- **Den Life**: patches, a daily channel, challenge links, micro-challenges and records.
- **Chase camera** for riding alone, colour-blind rider colours, and reduced effects.

## Who it is for

Two people on one keyboard is the heart of it: one on WASD, one on the arrows, rounds that last
half a minute, and a rematch that is always one key away. Alone, the Kids give you a ladder:

- Pip wanders and is kind to newcomers.
- Moss and Dee will make you think and react.
- Lou reads the whole board and rarely gives you a cheap point.

At constant speed the game rewards planning. On the speed-up channels, fast hands decide it.

## Light and dark

Each look is designed twice: once for a den full of afternoon light, once for the den at night
with the lamps down and the television glowing.

- **By day** the colours run deep against a pale world: neon walls stand on white glass, the trains
  run on a sunny playmat, and the ice ridges cross a bright frozen lake.
- **At night**: the neon walls blaze on black glass and pool their light on the floor, the engines'
  headlamps sweep the dark playroom, and every crash lights up its corner of the arena.
