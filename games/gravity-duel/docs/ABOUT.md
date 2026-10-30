# Gravity Duel — About

_No brakes in space._

## The hook

Two ships, one star, and nothing to slow you down. Turn, burn, let go, and you keep drifting the
way you were going until you burn the other way. The star in the middle pulls on everything:
your ship, your rival's, and every missile in flight. So the shot that matters is not the
straight one. It is the one you send wide of the sun, watch curve round it, and see come out the
far side straight into your rival's path. Miss, and you are drifting toward the star yourself with
two fuel segments left and a ship that will not stop. Vanish under your cloak, if you dare: you
cannot steer while you are hidden.

## Inspired by

Inspired by the 1978 orbital duel, slot 16 on the 1988 cartridge: an early space duel for a home
console, with gravity you can feel. It packs seventeen variations into one small program:

- **Seven duels:**
  - walls that bounce you back, or edges that wrap round;
  - with or without the cloak;
  - with a lethal star that pulls, or a refuelling starbase that does not.
- **Six docking races for two:** no weapons, endless thrust, and drifting pods to catch by matching
  their speed exactly. Sometimes there is a gravity beacon to swing them round.
- **Four solo docking runs** against the clock.

There is no computer opponent: it was made for two people on one console. Gravity Duel adds the
Neighbourhood Kids, built to fly as people do.

**The quirks we kept, and why they happen:**

- **The starbase never checks your speed.** The program was meant to blow up a ship that rams the
  starbase too fast, but it sets the ship's speed to zero one step before it measures it. So the
  check can never fire, and slamming into the station at full speed is the quickest way home.
- **The cloak can kill you.** Running out of fuel by thrusting is safe: the engine just stops.
  Losing your last segment to the cloak, as you switch it on or while it stays on, blows your ship
  up and hands your rival a point.
- **The cloak is a gamble, not an escape.** While cloaked you are invisible and nothing can touch
  you, not even the star. But you cannot turn, thrust or fire, and your missile in flight goes
  harmless until you show yourself again.
- **Mutual reload.** You carry eight missiles. Fire them all and you wait, empty, until your rival
  has fired all of theirs too and the last one burns out. Then both of you refill.
- **A missile fired forward at full speed comes out slower.** Each axis of a speed is held in a
  single byte that folds back on itself past its limit, rather than stopping there. A missile adds
  its own speed to the ship's, so fired straight ahead from top speed it folds, and the ship
  overtakes its own shot.
- **Ships pass through each other.** The program never checks one ship against the other.
- **Two engines, two notes.** Each player's engine has its own pitch, so you can hear who is
  burning without looking.

**The timing question.** The cartridge runs at the 50 frames a second of European TV sets. Its
match clock is 35,840 frames, which is just under twelve minutes there. On the 60-frame sets the
game was probably written for, the same count is about ten minutes. Gravity Duel keeps the
cartridge's frame counts, and runs them at 50 a second, as this cartridge did.

## What is new

- **Four looks, one game:**
  - **Deep Space**: starfighters over a nebula, with a living star;
  - **Brass Orrery**: clockwork craft round a filament bulb;
  - **Paper Sky**: a child's crayon rockets round a smiling sun;
  - **Whirlpool**: two little submarines circling a vortex.

  The field, the physics and every timing are identical in all four.

- **The Neighbourhood Kids.** Six opponents who fly with human limits:
  - they react late and lead a moving target badly;
  - they hold a burn too long and lose count of their fuel;
  - they panic next to the star.

  Grandpa Lou is calm and frugal; Dee burns everywhere and the star gets her a lot.

- **Two control schemes.** Classic (turn and thrust, as in 1978) or Modern (point the stick where
  you want to face; the ship still turns at the old rate).
- **An optional trajectory guide** shows where you will drift and where your shot would fly, for
  learning. It stays off in daily runs, challenge links and records.
- **Four Remix channels**, opened by patches: Binary Stars, Comet, Asteroid Belt and Last Fuel.
- **Daily runs, challenge links, micro-challenges and patches**, as across the collection.

## Who it is for

Two people on one keyboard or two pads, which is how it was always meant to be played, or one
person against a Kid. The first minute is about learning that nothing stops, the first hour about
bending shots round the star. Solo docking is a calm puzzle for one.

## Light and dark

By day, each look is lit like a sunny afternoon:

- a bright planetarium dome;
- sunlight through a study window;
- white paper and crayons;
- turquoise water with sunlight dancing on it.

By night the TV glows:

- deep black space and glowing engines;
- a desk lamp's warm pool on brass;
- a torch on the page, with glow-in-the-dark crayon;
- dark water, submarine lights and plankton that shines where the current stirs it.
