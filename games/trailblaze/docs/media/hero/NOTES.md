# Trailblaze hero frames: notes

These are live renders from the game's own looks (`games/trailblaze/hero.html`, dev server on port
4522), captured at 1920 × 1080. They are not mockups:

- the real engine plays a scripted round: each rider pushes its stick before every step as a player
  would, so every trail on screen is one the rules laid;
- the trap is spotted the way the game will spot it: after a step, a rider whose reachable space
  has shrunk to a sealed pocket, with its rival outside, is trapped;
- the view is driven by the match's own events in fixed 20 ms ticks, so a frame comes out the same
  every time.

This is the third set, after the architect's review of prompt 04 (prompt 04a, see "Architect review"
below). It is shown by night, as 04a asks; `companions/` holds the same scenes by day. The owner
approved Toy Trains, Mummy's Wrap and Ice Trail; the two Neon frames and their companions were
retaken after the owner's third review (see "Owner review 3").

## The frames

| File                          | Scene                                                                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `neon-duel-dark.png`          | (a) Neon Grid by night, twenty seconds into a constant-speed round (variation 1): Lancer and Comet, motorbikes about three cells long, race for the gap. |
| `neon-crash-dark.png`         | (b) The crash push at its closest: Comet rides into orange's seal and breaks into light shards; Lancer rides on; the host points.                        |
| `trains-duel-dark.png`        | (a) Toy Trains by night, the same race, Ember and Bluebell drawn about two cells long under their headlamps.                                             |
| `trains-crash-dark.png`       | (b) The push: a buffer stop springs up at the seal, Bluebell tips over with a clonk, the conductor blows his whistle.                                    |
| `mummy-duel-dark.png`         | (a) Mummy's Wrap by night: Wick and Bun stooped and reaching, their linen dyed orange and blue, chevrons on Wick's, diamonds on Bun's.                   |
| `mummy-crash-dark.png`        | (b) The push: Bun's linen spirals up from the feet, halfway to the head; the priest's sun disc glows.                                                    |
| `mummy-crash-before-dark.png` | The Mummy crash as it was: a bolt of lightning from the priest's staff whites out the top of the board.                                                  |
| `mummy-crash-after-dark.png`  | The same moment now, without the push: Bun is wound and wobbling, no lightning, no white-out.                                                            |
| `ice-duel-dark.png`           | (a) Ice Trail by night: Juniper and Sorrel drawn larger, each with a ring in its colour on the ice.                                                      |
| `ice-crash-dark.png`          | (b) The push: frost has climbed Sorrel from skates to hood, the ice cracks with a burst of crystals, the snowman melts.                                  |

Every look is designed for light and dark; `companions/` holds each duel and crash by day.

Re-take any frame with
`http://localhost:4522/hero.html?look=neon|trains|mummy|ice&scene=duel|trap&appearance=light|dark`.
Further options: `&t=0.3` moves the moment later (keep it under 4 s on the trap scene: the next
round starts after the crash pause), `&push=0` turns the crash push off, `&measure=1` reports frame
times, and `&zoom=4&at=20,-3` looks closer at one cell. The `at` cell may lie off the board, which is how to see a watcher.

## How the four looks differ

|              | Neon Grid (default)                                                                     | Toy Trains                                                                                       | Mummy's Wrap                                                                                             | Ice Trail                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Trails       | Light-cycle walls: tall sheer ribbons, hot top edge, bright foot line, one seamless run | Railway track, the same for both: painted bed, dark sleepers, steel rails, curving round corners | Unrolled linen dyed in the mummy's colour, woven, with Wick's chevrons or Bun's diamonds down the middle | A continuous ridge of clear ice sweeping round corners, a glowing core in the skater's colour; orange's crest is jagged |
| Riders       | Lancer and Comet: motorbikes with ring wheels, riders in white helmets with stripes     | Ember (tender engine) and Bluebell (tank engine)                                                 | Wick (tall) and Bun (round): wound in strips, eyes peeping, arms out in front                            | Juniper (bobble hat) and Sorrel (hood, earmuffs)                                                                        |
| Crash        | Breaks into tumbling light shards, with a small pop of colour                           | Tips over with a clonk                                                                           | Its linen spirals up from feet to head; the cocoon wobbles and topples                                   | Frost creeps up from the skates, the ice cracks, the frozen figure slides back to a stop                                |
| Watcher      | The host, our own character: black bodysuit traced with light, glossy bob, hand on hip  | A toy conductor on a station platform                                                            | A tomb priest with a sun-disc staff                                                                      | A snowman, and a child who rebuilds him                                                                                 |
| Every crash  | Her suit flashes in the scorer's colour and she points at the wreck                     | Whistle to his lips, cheeks puffed, toot                                                         | Staff raised and struck on the stone; the sun disc glows                                                 | He melts; the child trudges in, rolls him up ball by ball, puts his things back, and he blinks and waves                |
| Trap closing | Sparks and a ring of light from the seal                                                | A buffer stop springs up                                                                         | A bandage bow ties itself                                                                                | A burst of crystals                                                                                                     |

Watchers stand at the middle of the far side and react on their own clock. The duel never waits for
them, and a crash during the snowman's rebuilding melts whatever has been built so far.

## Owner review 3 (2026-10-30) and what changed

Mummy's Wrap, Ice Trail and Toy Trains were approved. Neon Grid was not: from the overhead camera
the riders still read as blobs of light, not people on motorbikes.

- **A motorbike you can see from above.** The bike is redrawn about three cells long, nose to rear
  tyre: a disc wheel at each end with a glowing rim on both faces (a ring from the side, two lines
  of light from above), the front wheel held out ahead of the fairing on its fork, a narrow body
  over a dark engine block, and bars across the front with grips in the seat's colour. The rider
  crouches over the tank, knees out and arms to the bars, in a white helmet; a stripe in the seat's
  colour runs over the helmet and down the back, where the camera sees it first. Lancer keeps a
  pointed fairing, one stripe and one tail light; Comet a round fairing, twin stripes and twin
  tail lights, so shape tells them apart as well as colour.
- **It leans and steers like a bike.** The front goes where the rules send the rider and the rear
  wheel follows the line actually ridden, so the bike stays over its own wall through a turn
  instead of swinging its tail across the floor, and it banks gently into the turn (at most about
  17°).
- **Less light round the bike.** Every glowing part of the bike, tail light included, sits just
  under the bloom threshold, so the outline stays crisp. The wall it rides on stays inside its body
  and streams out under the tail. The pool of light on the floor waits until the bike has passed,
  where before it lit a box of floor round the bike, and shows in full when the bike breaks up.
  The coloured ring round the rider is off in this look: the rims and stripes carry the colour,
  and the soft shadow stays. At speed the light streaks come off the tail, dimmer than before.
  The crash pop is smaller and in the bike's own colour, so the shards carry the moment.

Five critique rounds, at full board and close up (`&zoom=3` to `6`), by night and by day: the
first model (wheels lost from behind, a ring framing the bike), the front wheel moved out ahead of
the fairing, the box of floor light found under the bike and held back, rims and stripes thickened
so they hold at full-board size, and the underside tidied where the body's keel showed past the
engine block.

## Architect review (prompt 04a, 2026-10-30) and what changed

- **The riders were dots from overhead.** Every rider is now drawn at a readable size: the bikes and
  the engines about two cells long, the mummies and the skaters about three times their old size,
  standing as they were. A vehicle is drawn back from its nose, which stays where the rules have the
  rider, so it never seems to touch a wall before it reaches one; its body lies over its own trail.
  Each rider has a soft contact shadow and a ring in its colour (a glow by night, the deep shade by
  day). The mummies stoop forward as they shuffle, so their bodies and reaching arms show from above.
- **The crash camera push.** On every point the picture eases in toward the crash over 0.6 s, holds,
  and is back on the whole board by 4.2 s, before the next round. It may show up to half its own
  size beyond the board, so a crash at the far wall sits inside the picture with the watcher beside
  it. It is a framing move only: no blur, no tilt. It is off with reduced motion and with Chase.
- **The Mummy crash.** No lightning and no white-out. The linen spirals up round the mummy from its
  feet to its head over 0.9 s while its arms fold in; the cocoon wobbles, then topples. The priest
  strikes his staff and his sun disc glows. The crash flash is turned right down.
- **The other crashes against the brief.** Neon's white ball of light, which bloomed over the walls,
  is now a small pop in the bike's colour, so the shards carry the moment. Trains already tipped
  over with spinning wheels. Ice now follows the brief: frost creeps up, the ice cracks, the frozen
  skater slides back off the wall to a stop.
- **The Mummy linen read as grey pipe.** It is dyed in the mummy's colour, woven in a basket weave
  drawn in code, with a deep hem along each edge and the mummy's motif down the middle: chevrons
  for Wick (pointing the way he went), diamonds for Bun.

Five critique rounds led here: the Mummy alone (size, linen, cocoon), all four looks scaled, the day
check (rings in the deep shade, a stronger blue dye, bigger skaters), the push frames, and the push
composition (crashes at the edge sat at the picture's edge).

Still open for stage 2, seen in the day companions: the Neon crash by day (pale shards on a white
floor) and the frozen skater by day (pale blue on a pale lake) want more contrast.

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
  close-up. (Superseded by prompt 04a: the riders are now drawn at a readable size.)
- With the watchers in place, the trap scenes hold 60 fps at 1920 × 1080 in all four looks (frame
  median and p95 16.7 ms, CPU at most 1.9 ms at p95). The full-board check (every open cell laid)
  holds 60 fps too; see NOTES.md, Performance.
