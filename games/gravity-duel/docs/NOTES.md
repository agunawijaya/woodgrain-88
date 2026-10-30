# Gravity Duel: notes

Verified behaviour of the 1978 orbital duel (cartridge slot 16), the decisions our engine makes on
top of it, and the simulations behind the Kids. The research dossier
(`research/dossiers/16-gravity-duel.md`, not published) was the starting point; everything below
was checked against the reference code by the lead (prompt 05, stage 2) and is written in our own
words. Nothing here is the cartridge's data.

## Units

The cartridge works in whole numbers, and so does our engine (`src/engine/types.ts`).

- **Time.** One tick is one PAL frame, 20 ms; 50 ticks a second.
- **Field.** 160 steps across, 90 down, y running down the screen.
- **Position.** Each axis holds a whole step and a fraction of 1/256.
- **Velocity.** Each axis is a signed whole part of **speed units** (one unit is a sixteenth of a
  step per tick) plus a fraction of 1/256 of a unit. We store both as one integer in fine units
  (256 to a unit). Each tick a body moves its velocity divided by 16, in subpixels. Top speed,
  63 units, is just under 4 steps a tick.

## Verified behaviour

### Turning and thrust

- Sixteen headings. A tap turns one step at once; held, the turn repeats every 8 ticks, so a full
  circle takes 128 ticks (2.56 s). Holding both turn directions counts as holding neither.
- Thrust works only on ticks divisible by 4. Each thrust adds a vector of strength 72 fine units
  along the heading (about 0.28 of a speed unit on the four main axes). From rest, straight-line
  thrust reaches top speed after about 228 thrusts, 912 ticks or 18 s.
- **The speed fold (new finding).** Speed is not clamped, it is folded. Each tick, before moving,
  the whole speed units are kept to the signed 8-bit range and then reflected:
  - 64 becomes 63, 65 becomes 62, and so on;
  - −65 becomes −64, and so on down.

  Thrust only ever crosses the limit by a fraction, so for a ship it acts as a cap at 63. A missile
  is different, see below.

### Missiles

- Firing needs a missile ready and a segment of ammo; holding the button fires again as soon as it
  can. A missile starts at the ship with the ship's velocity (its fraction dropped) plus a muzzle
  velocity: half the thrust vector, in whole speed units (36 on the main axes, 2.25 steps a tick).
- A ship can fire again only **128 ticks after it last fired**. The countdown does not stop when
  the missile hits a ship or is swallowed, so a hit does not reload you early.
- **A missile fired forward at speed comes out slower (new finding).** The muzzle velocity is
  added before the fold. A ship flying at 60 units that fires straight ahead makes a missile
  of 96 units, which folds to 31. The ship overtakes its own shot, and after the 8-tick grace,
  on switch A, that is suicide. We keep this: it is how the cartridge plays, and it rewards
  firing across your motion rather than along it.
- Each ship carries 8 missile segments. **Mutual reload:** when any missile's countdown ends while
  both ships have none left, both refill to 8. One ship that has fired everything waits for the
  other to do the same.
- Touching your own missile after its first 8 ticks takes the missile back. On switch A you
  explode and the other seat scores; on B nothing else happens.
- Missiles bounce or wrap at the edges exactly like ships.

### Hits, spins and the score

- A missile that touches the other ship takes the point and sets the victim spinning for 64 ticks,
  one heading step a tick. Play goes on. A spinning ship cannot be scored on again until the spin
  ends, but its pilot can still thrust and fire, pointing wherever the spin has it.
- Ships pass through each other.
- First to 10 points ends the match at once. Otherwise the match clock ends it after 35,840
  ticks (11 min 56.8 s), and the score blinks for the last 1,024 ticks.

### Fuel and the cloak

- Fuel is 8 segments. Each burn (one thrust, or every fourth tick cloaked) counts down a segment
  of 256 burns; the very first segment has 255.
- Running out of fuel by thrusting is safe: the engine simply stops.
- **Cloak.** In variations 2–7, pulling the stick down on its own (no other direction) toggles
  the cloak. It must be let go before it toggles again.
  - Cloaking costs one segment at once, then burns from the same counter as thrust.
  - Losing the last segment to the cloak, at the moment of cloaking or while cloaked, blows the
    ship up and scores for the other seat.
- **Cloaked ships drift (new finding).** While cloaked, the cartridge skips everything else for that
  ship: it cannot turn, thrust or fire. Nothing touches it, and that includes the star. Its own
  missile, if one is still flying, cannot hit anything or be swallowed until the ship uncloaks.
  Gravity still pulls it. The dossier described the cloak as invisible and intangible; the controls
  going dead with it is our addition from the code, and it changes the cloak from an escape into a
  gamble.

### The middle

- **Star** (variations 4 and 5): it pulls (see Gravity) and swallows missiles. A ship that touches
  it is put back at its starting spot at rest, explodes (the 64-tick spin), and the other seat
  scores.
- **Starbase** (variations 6 and 7): no pull. It swallows missiles too. A ship that touches it is
  put back at its starting spot at rest, with full fuel and full ammo.
  - **Hook, the dead speed check.** The code then measures the ship's speed and would blow it up
    at 4 units or more. The velocity was already zeroed one step earlier, so the check can never
    fire. Ramming the starbase at full speed is the fastest way home.
- **Beacon** (docking variations 10, 11, 15, 17): it pulls, and harms nothing.

### Gravity

- Gravity pulls one body at a time. On odd ticks the four bodies take turns (ship 0, ship 1,
  shot 0, shot 1), so each is pulled once every 8 ticks, missiles and pods included.
- **What the pull is.** The cartridge looks the pull up in a small grid indexed by distance from
  the middle in blocks of 8 steps, one axis at a time. Read as a law, it is close to **inverse
  square**: the pull along an axis is proportional to that axis's distance divided by the cube of
  the full distance, with a cap of 255 fine units per pull near the middle. (The dossier called it
  inverse-distance; the numbers fall off with the square.)
- **Our version.** We compute the same law from exact positions, without the cartridge's 8-step
  blocks or its grid:

  ```
  pull along x = sign(dx) × min(255, floor(26 000 × |dx| / d³))
  ```

  with `dx`, `dy` and `d` in steps from the body to the middle. The constant was fitted to the
  cartridge's behaviour at every block; it comes within about 10% of it.

- **Left out.** At the very left column the cartridge's grid lookup runs past its end and reads
  unrelated bytes, giving freak pulls there. We do not reproduce it.

### Edges

- **Wrap:** leaving one side brings you in at the other.
- **Bounce:** the position reflects off the wall and that axis's velocity reverses exactly.

### Docking (variations 8–17)

- No weapons, no cloak, no fuel or ammo bars, and thrust never runs out.
- The two shot objects become pods. They start at mid-height, one under each ship, with random
  velocities: each axis between about 1/8 and 7/8 of a step a tick, never zero. Pod 1 mirrors
  pod 0 horizontally.
- **Shared pod** (9, 12): only pod 0 flies and both ships race for it. **Own pods** (8, 10, 11,
  13): seat 0 can dock only with pod 0, seat 1 only with pod 1. **Solo** (14–17): seat 0 and
  pod 0 alone.
- **A dock.** The ship touches its pod with the velocities matched. The difference is measured
  in whole speed units, horizontal plus vertical:
  - switch B needs a difference under 16 (one step a tick);
  - switch A needs 0 or 1.

  A dock scores a point and plays a chime. The pod gets a fresh random velocity where it is, and
  that ship cannot dock again for 128 ticks.

### Hooks: verdicts

| Hook                                                | Verdict                                 | Engine test                  |
| --------------------------------------------------- | --------------------------------------- | ---------------------------- |
| Starbase speed check that can never fire            | Confirmed in the code                   | `tests/match-combat.test.ts` |
| Cloak fuel-out suicide (thrust running dry is safe) | Confirmed                               | `tests/match-combat.test.ts` |
| Mutual reload only when both ships are empty        | Confirmed                               | `tests/match-combat.test.ts` |
| Ships pass through each other                       | Confirmed                               | `tests/match-combat.test.ts` |
| A different engine pitch per ship                   | Confirmed (two pitches, one per player) | sound palette                |
| Probable NTSC timing on this PAL cartridge          | Unresolved; ABOUT only                  | —                            |
| The speed fold (missile slower than its ship)       | New, confirmed                          | `tests/physics.test.ts`      |
| Cloaked ships cannot steer, thrust or fire          | New, confirmed                          | `tests/match-combat.test.ts` |

The cartridge has no computer opponent.

## Engine decisions

- **Touching** is circles, not pixels: ship radius 4 steps, missile 1, pod 2, the middle 5. The
  looks draw ships longer than the cartridge's 8-step sprites so they read from across the room,
  and the circles follow the drawings. Tested on the current positions each tick, as the cartridge
  tested last frame's picture; at these speeds nothing can pass through a ship between ticks.
- **Bouncing** reflects the centre of a ship 6 steps from the wall (about half the drawn ship; a
  missile 1 step, a pod 2), so a ship never pokes through the quay.
- **Pods** draw their velocities from the match's seeded random stream instead of the frame
  counter.
- **Start spots** are our own: seat 0 at (30, 20) facing right, seat 1 at (130, 70) facing left.
- **The order of a tick:**
  1. Count the tick.
  2. For seat 0, then seat 1:
     - the cloak: burn, then toggle (as the cartridge does);
     - if uncloaked: fire, turn, thrust, then what it touches.
  3. Missile countdowns, with mutual reload; dock cooldowns.
  4. Spins.
  5. Move every body: fold, move, edges.
  6. Gravity on this tick's body.
  7. The clock.

## Remix rules (ours)

Four channels of our own, opened by patches (`src/engine/remix.ts`):

- **Binary Stars** (on variation 5):
  - two stars of radius 4 steps circle the middle, 14 steps out, one turn every 1,000 ticks;
  - each pulls at 0.6 of the cartridge's strength;
  - each is as deadly as the cartridge's star, which is not there.
- **Comet** (on variation 3):
  - from tick 600, every 1,000 ticks, a comet crosses the field edge to edge in 300 ticks, at
    heights drawn from the match's seeded stream;
  - it pulls at 0.8 strength and touches nothing.
- **Asteroid Belt** (on variation 6):
  - ten rocks of radius 2.5 steps on a ring 24 steps out round the starbase, one turn every 3,000
    ticks;
  - a missile that touches a rock stops;
  - a ship bounces off it, its velocity reflected about the line between the centres.
- **Last Fuel** (on variation 5): no mutual reload. When both ships are out of missiles and none
  is flying, the match ends on the score.

The Kids do not model the Remix bodies. They forecast the binary pair as one star in the middle,
which keeps them clear of the pair's ring; the comet and the rocks surprise them, as they would a
person.

## The Kid pilots

The cartridge has no computer opponent; the Kids are ours (`src/ai/`). Each one flies with the
kit's three human models plus a few habits of its own:

- **Reflexes** (`kids/reflex`, ADR-0012). It decides ten times a second; its hands act a reaction
  later, lengthened by panic near the star or at speed, and now and then on the wrong heading or
  late.
- **Memory** (`kids/memory`, ADR-0011). It keeps count of its own fuel and missiles, and of the
  rival's missiles, in a fading memory. A Kid that has forgotten its fuel goes on what it last
  believed, which is how Moss can cloak on an empty tank.
- **Aim** (`kids/aim`, ADR-0017, new this prompt):
  - it leads a moving target by a share of the true lead, drawn afresh for each shot;
  - it holds a burn past the point it meant to stop, by its overshoot.
- **Its own habits** (`src/ai/styles.ts`):
  - the range it likes and how much it circles the rival;
  - how hard it cruises and how far off its wanted speed it lets itself drift;
  - its fuel reserve;
  - how good a shot must look before it fires;
  - how far off it judges a target's bearing (`aimNoise`, degrees);
  - how much it allows for the star when it lines up a shot (`pullSense`);
  - its taste for cloaking, the starbase and bent shots;
  - Pip's wandering and his rare perfect shot.

How a Kid decides, in order:

1. Burn clear of the star if its forecast says it will fall in.
2. Dodge (or cloak, if it believes it can afford to) a missile it noticed coming.
3. Uncloak when the danger has passed.
4. Head for the starbase when it believes it is low.
5. Line up a shot: the real physics, run forward on the Kid's slightly wrong idea of the target.
6. Otherwise move to the range it likes, circling.

Docking:

- far off, it aims for where the pod will be, walls and the beacon included;
- close in, it takes on the pod's drift and eases in slowly.

**Sharp Kids** (the Den's harder setting):

- react twice as fast and never slip;
- lead exactly and never overshoot;
- remember everything;
- judge a target's bearing twice as well and allow fully for the star.

### Tuning (prompt 05)

| Kid   | Range | Circling | Cruise | Aim noise | Pull sense | Shot tolerance | Fire range |
| ----- | ----- | -------- | ------ | --------- | ---------- | -------------- | ---------- |
| Lou   | 50    | 0.3      | 14     | 12°       | 0.9        | 2              | 60         |
| Moss  | 70    | 0.6      | 16     | 14°       | 0.8        | 4              | 110        |
| Rosa  | 22    | 0.8      | 26     | 14°       | 1.0        | 4              | 45         |
| Benny | 40    | 0.5      | 20     | 16°       | 0.7        | 4              | 60         |
| Dee   | 10    | 0        | 40     | 22°       | 0.3        | 5              | 160        |
| Pip   | 45    | 0.4      | 18     | 28°       | 0.4        | 14             | 140        |

Range, cruise and fire range are in steps of the 160 × 90 field and speed units. Fire range is
the farthest a Kid will take a shot from: Lou and Rosa wait to be close, Dee and Pip fire across
the field.

What moved the numbers:

- **Hit rates.** The first Kids hit 50–70% of their shots: they forecast the real physics
  exactly and sat still.
  - Circling made the targets move, so leading mattered.
  - A per-shot error in judging the target's bearing (`aimNoise`) brought the rates down.
- **Ricochets.** In the bouncing channels a missile lives long enough to cross the field twice, so
  a good share of hits are ricochets. The skill gap between Kids therefore had to be wide:
  - Lou is careful and takes only good shots;
  - Pip fires at almost anything.

  We kept the cartridge's missile life and our ship size, rather than shrinking the targets.

- **Fire range.** Without one, every Kid took long shots that only ricochets could land, and
  Moss lost to Dee. Moss now shoots from her own distance (110) and Dee from anywhere (160); Lou
  waits for 60.
- **Docking with walls.** Chasing a pod's present drift failed in the walled channels: the pod
  bounces every few seconds and the chase never converges. Variation 11 managed one dock in twelve
  minutes. Aiming for where the pod will be fixed it.

Results with the values above, from `scripts/simulate.ts` (300 matches per target, seed 23):

| Target                                   | Measured | Band     |
| ---------------------------------------- | -------- | -------- |
| Lou beats Pip, variation 1               | 87.7%    | 75–90%   |
| Moss beats Dee, variation 1              | 68.3%    | 55–70%   |
| Dee's star crashes ÷ Moss's, variation 4 | 2.22×    | ≥ 2×     |
| Lou's docks ÷ Pip's, variation 8         | 1.65×    | ≥ 1.5×   |
| The perfect docker, switches B and A     | 20/20    | 10 docks |

`tests/sim/balance.test.ts` locks the same bands on 40 matches a target.

A Kid-against-Kid duel to 10 takes about 80–90 seconds; Lou hits about 45% of his shots, Pip
about 32%.
