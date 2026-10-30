# Gravity Duel — Changes from original

_Differences between the 1978 orbital duel on the cartridge and our game. The original's rules
and quirks are retold in [NOTES.md](NOTES.md); this page says what we kept, what we changed and
why._

## Kept

- **The physics, in whole numbers, to the tick:**
  - sixteen headings, a tap turning one step at once and a held turn every 8 ticks;
  - thrust every fourth tick;
  - velocities in sixteenths of a step a tick, folding past 63, not clamped;
  - the field 160 by 90 steps, edges that bounce or wrap;
  - gravity pulling one body every other tick in turn, falling off with the square of the distance.
- **Every rule:**
  - 8 fuel and 8 missile segments, one missile at a time, 128 ticks between shots whatever
    happens to the shot;
  - mutual reload;
  - a hit scoring 1 and spinning the victim 64 ticks while play goes on;
  - your own missile dangerous on switch A after 8 ticks;
  - the star swallowing missiles and blowing up ships;
  - the starbase refuelling and rearming;
  - docking by touch with speeds matched, a wide tolerance on B and a near-exact one on A;
  - first to 10, or 35,840 ticks on the clock, the score blinking for the last 1,024.
- **All 17 variations** as channels with their cartridge numbers, grouped Duel, Docking race and
  Solo docking.
- **Every quirk**, each pinned by a test:
  - the starbase's speed check that can never fire;
  - the cloak that kills on your last segment;
  - the dead controls while cloaked;
  - mutual reload;
  - the speed fold;
  - ships passing through each other.
- **Two engine notes**, one per ship.

## Changed

| Original behaviour                                                                                | Woodgrain behaviour                                                                                 | Why                                                                                                                                         |
| ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Touches are pixel overlaps of tiny sprites (an 8-step ship, a ball of a star a few steps across). | Touches are circles: ship radius 4 steps, missile 1, pod 2, the middle 5.                           | The looks draw ships, stars and pods large enough to read from across the room; the circles follow the drawings, so a hit looks like a hit. |
| Gravity comes from a small grid of values in 8-step blocks.                                       | The same inverse-square law computed from exact positions, fitted to the grid within about 10%.     | Smooth orbits, no steps in the pull as you cross a block; the strength and fall-off are the cartridge's.                                    |
| The grid lookup runs off its end at the very left column and gives freak pulls there.             | Left out.                                                                                           | A memory slip in the original, not a rule anyone played for.                                                                                |
| Pods get their speeds from the frame counter.                                                     | Pods draw them from the match's seeded random stream.                                               | The same spread of speeds, and daily runs and challenge links replay exactly.                                                               |
| Ships restart where the program put them.                                                         | Our own start spots: the orange ship top left facing right, the blue ship bottom right facing left. | Our own layout.                                                                                                                             |
| A ship bounces with its sprite's corner on the wall.                                              | A ship bounces 6 steps from the wall, a missile 1 step, a pod 2.                                    | Nothing is drawn poking through the walls.                                                                                                  |
| The match clock is about 12 minutes.                                                              | Cartridge length (10 points or 12 minutes) or Short (5 points or 4 minutes).                        | A shorter match for a quick game; the cartridge's is still the default.                                                                     |

## Added

- The Neighbourhood Kids, flying with human limits (the original has no computer opponent).
- The Modern control scheme, and an optional trajectory guide (never in daily, challenge or
  record runs).
- Four looks, each in light and dark.
- Four Remix channels opened by patches: Binary Stars, Comet, Asteroid Belt and Last Fuel.
- Patches, micro-challenges, daily runs, challenge links, records and the "How the Kid flew it"
  replay.

## Removed

- The attract mode's colour cycling, and the console's colour or black-and-white switch: the Hall
  handles idle screens and appearance.
- Nothing from the rules.

## Presentation

Ships shoot and explode, arcade style:

- a flash, a ring and sparks in Deep Space;
- gold sparks and loose cogs on the orrery;
- a crayon starburst on paper;
- a plume of spray on the water.

A hit ship spins its 64 ticks as on the cartridge. No gore anywhere.
