# Trailblaze hero frames: notes

These are live renders from the game's own looks (`games/trailblaze/hero.html`, dev server on port
4522), captured at 1920 × 1080. They are not mockups:

- the real engine plays a scripted round: each rider pushes its stick before every step as a player
  would, so every trail on screen is one the rules laid;
- the trap is spotted the way the game will spot it: after a step, a rider whose reachable space
  has shrunk to a sealed pocket, with its rival outside, is trapped;
- the view is driven by the match's own events in fixed 20 ms ticks, so a frame comes out the same
  every time.

This is the second set, after the owner's first review (see "Owner review 1" below).

## The eight frames

| File                    | Scene                                                                                                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `neon-duel-light.png`   | (a) Neon Grid by day, twenty seconds into a constant-speed round (variation 1): orange has fenced off the left, blue the right, both race for the gap.                                                          |
| `neon-trap-dark.png`    | (b) Neon Grid by night, speed-up round (variation 3): orange seals blue into a pocket of nine cells against the far wall; blue rides into the seal and blows up; the host's suit flashes orange and she points. |
| `trains-duel-light.png` | (a) Toy Trains by day, the same race, the conductor watching from his platform.                                                                                                                                 |
| `trains-trap-dark.png`  | (b) Toy Trains by night: a buffer stop springs up at the seal, Bluebell tips over with a clonk, the conductor blows his whistle.                                                                                |
| `mummy-duel-light.png`  | (a) Mummy's Wrap by day: the two unrolled strips of linen, orange-edged and blue-edged, the priest on his dais.                                                                                                 |
| `mummy-trap-dark.png`   | (b) Mummy's Wrap by night: Bun is wound into a cocoon and the priest's staff sends a bolt of lightning to it.                                                                                                   |
| `ice-duel-light.png`    | (a) Ice Trail by day: the two ridges of ice sweeping round their corners, the snowman on the bank.                                                                                                              |
| `ice-trap-dark.png`     | (b) Ice Trail by night: Sorrel slips and falls; the snowman melts into a puddle, his hat, carrot, coal, scarf and broom dropping onto the snow.                                                                 |

`companions/` holds the other appearance of each scene (the race by night, the trap by day). Every
look is designed for both.

Re-take any frame with
`http://localhost:4522/hero.html?look=neon|trains|mummy|ice&scene=duel|trap&appearance=light|dark`.
Further options: `&t=0.3` moves the moment later (keep it under 4 s on the trap scene: the next
round starts after the crash pause), `&measure=1` reports frame times, and `&zoom=4&at=20,-3`
looks closer at one cell. The `at` cell may lie off the board, which is how to see a watcher.

## How the four looks differ

|              | Neon Grid (default)                                                                     | Toy Trains                                                                                       | Mummy's Wrap                                                                                                 | Ice Trail                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Trails       | Light-cycle walls: tall sheer ribbons, hot top edge, bright foot line, one seamless run | Railway track, the same for both: painted bed, dark sleepers, steel rails, curving round corners | Unrolled linen, like a thrown roll of tissue: a crumpled strip, edges dyed orange or blue, folded at corners | A continuous ridge of clear ice sweeping round corners, a glowing core in the skater's colour; orange's crest is jagged |
| Riders       | Lancer (long, one fin) and Comet (round, twin fins)                                     | Ember (tender engine) and Bluebell (tank engine)                                                 | Wick (tall) and Bun (round): wound in strips, eyes peeping, arms out in front                                | Juniper (bobble hat) and Sorrel (hood, earmuffs)                                                                        |
| Crash        | Blows up: a ball of light, shards, sparks                                               | Tips over with a clonk                                                                           | Wound into a cocoon in a blink, topples                                                                      | Slips and falls flat on the ice                                                                                         |
| Watcher      | The host, our own character: black bodysuit traced with light, glossy bob, hand on hip  | A toy conductor on a station platform                                                            | A tomb priest with a sun-disc staff                                                                          | A snowman, and a child who rebuilds him                                                                                 |
| Every crash  | Her suit flashes in the scorer's colour and she points at the wreck                     | Whistle to his lips, cheeks puffed, toot                                                         | Staff raised and struck: lightning leaps to the fallen mummy                                                 | He melts; the child trudges in, rolls him up ball by ball, puts his things back, and he blinks and waves                |
| Trap closing | Sparks and a ring of light from the seal                                                | A buffer stop springs up                                                                         | A bandage bow ties itself                                                                                    | A burst of crystals                                                                                                     |

Watchers stand at the middle of the far side and react on their own clock. The duel never waits for
them, and a crash during the snowman's rebuilding melts whatever has been built so far.

## Owner review 1 (2026-10-29) and what changed

- **Trains.** The blue track did not look like track, and corners looked poor. Both engines now lay
  the same railway, and a right-angle turn is one curved piece of bed, sleepers and rails. The
  conductor watcher was added.
- **Neon.** Day colours were too pale, so walls now use the deeper shade of each seat colour by day.
  The trails follow the light-cycle style the owner asked for. They are tall, sheer ribbons with no
  pattern, and the half-cell seams are gone. A crash is an explosion. The host watcher was added.
  The owner decided this direction. We still copy nothing that identifies a particular film:
  the bikes, the host and every mark are our own.
- **Mummy.** The mummies did not look like mummies. They are now wound in overlapping strips, with
  eyes peeping through a gap and arms straight out. The trail is now an unrolled strip of linen
  with dyed edges, standing ankle high so it still reads as a barrier. The priest watcher and his
  lightning were added.
- **Ice.** The spikes and columns did not read as an ice trail. They became one continuous ridge,
  as the owner asked. A crash is now a slip and a fall. The snowman and the child were added.

Crash, watcher and trap moments in the trap frames are timed per look, so each reaction is caught
mid-action.

## Owner review 2 (2026-10-29) and what changed

- **Turns are curves.** Bikes, walkers, trains and skaters no longer pivot through a hard right
  angle. Every rider now crosses each cell along a smooth curve: from the edge it came in by,
  through the middle of the cell, to the edge it leaves by. Every trail is drawn along the same
  curve, so the light walls, the linen, the track and the ice all sweep round their turns. The cost
  is a little more lag between the picture and the rules: about half a cell, roughly 0.15 s at the
  starting speed, and hardly visible at top speed. The rules, inputs and timing are unchanged.
- **Ice by day.** The ridges are the deep shade of each seat colour, with a softer sheen so the sun
  no longer washes the colour off the crest. Orange and blue now stand far apart on the pale lake.

## Earlier critique rounds (first set, five per look)

These are kept as a record. The details of the first set are in git history.

- **Neon:** bloom veils on white floors, flat walls, the trap hidden behind the near wall, beaded
  floor glow, empty bands, an oversized seal ring.
- **Trains:** turntables on every cell, too bright a bedroom, small engines.
- **Mummy:** cream-on-sand bandages, too many carvings, a busy surround.
- **Ice:** a snow-blind day frame, pale walls, bright night snow.

## Open points for the art pass (stage 4)

- The host is stylised and reads at full-board framing. Her face and pose get their close-up on the
  menu and in the Chase camera.
- When Ember faced away from the camera at night, its headlamp pool was overexposed. Fixed in the
  art pass: an engine heading away from the camera dims its beam's cone and softens its pool.
- Riders read at full-board framing but are small. The Chase camera setting is where they get their
  close-up.
- With the watchers in place, the trap scenes hold 60 fps at 1920 × 1080 in all four looks (frame
  median and p95 16.7 ms, CPU at most 1.9 ms at p95). The full-board check (every open cell laid)
  holds 60 fps too; see NOTES.md, Performance.
