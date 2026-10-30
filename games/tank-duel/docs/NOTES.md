# Tank Duel: notes

Working notes for the game: what the 1977 duel does (in our words), how we carried it over, and what
the simulations say. The original is described here only as behaviour; nothing from its program,
tables or screens is copied into this repository.

## What the 1977 game does

Verified against the behaviour dossier (`research/`, kept off the repository) and, where marked,
by the lead reading the program directly.

- **One cartridge, 27 variations.** SELECT steps through a list of 27 variations. Each fixes:
  - the vehicle (tank, biplane, jet);
  - the shot (guided, straight, machine gun);
  - whether shots bounce, and whether only banked shots score;
  - invisibility, the board (open, light maze, dense maze, clouds, clear sky);
  - the formation (1 v 1, 2 v 2, a big bomber against three, one jet against three).

  The lead confirmed the count in prompt 00.

- **No computer opponent.** Both vehicles only ever read the two controllers. An unplayed tank sits
  still; an unplayed plane flies straight on round the wrapping sky.
- **Scoring.** One point per hit. There is no cap; past 99 the display rolls over. Each player has at
  most one projectile in the air. A player's shot can never hit its own vehicle.
- **The hit.**
  - Both shots vanish, and a 2.52 s pause starts in which neither player's stick is read.
  - The struck vehicle spins one heading step per frame; it is shoved back along the shot for the
    first four frames.
  - The round clock keeps running.
- **The round.** 128 clock ticks of 64 frames (about 2 min 44 s). The scores blink for the last 16
  ticks; at the end everything freezes.
- **Tanks.**
  - Sixteen headings, one step every 15 frames while held.
  - Forward only.
  - A tank touching a wall or the other tank is pushed straight back. A tank wedged for four frames
    turns a step to slide free.
- **Aircraft.**
  - Always flying. Biplanes have three speeds; jets cruise, burn and brake.
  - Nothing collides in the air: not clouds, not other planes.
  - Everything wraps at the edges.
- **Bouncing and billiard.**
  - A bouncing shot reflects off walls and comes straight back out of a corner.
  - Each bounce refreshes most of its flight time.
  - In billiard variations a bounce counter starts at 31 and counts down per bounce. A hit while it
    still reads 31 is ignored, so only banked shots score; after 32 bounces it wraps, and the shot
    briefly cannot score again. _Lead read the program: confirmed (the counter is set to 31 on
    firing, the hit test skips scoring at 31, each bounce decrements it)._
- **Invisible tanks.** A tank is drawn in the background colour except while its shot flies, when it
  bumps something, and while it spins after being hit.
- **Difficulty switch A is a handicap.** That player's shots fly about five eighths as far, and its
  aircraft are slower (biplanes one speed tier, jets two). Tanks are unaffected.
- **Hooks we keep.**
  - The scorer twitches one heading step on every scoring hit. _Lead read the program: the shooter's
    two heading bytes are incremented just before the score is added._ We turn it one step
    anticlockwise, as the dossier reads the direction.
  - The ricochet ping rises in pitch with every bounce: the bounce counter doubles as the pitch.
  - The two players' explosion rumbles differ slightly in pitch.
  - On this 32-in-1 cartridge the biplane's stick is wired differently: up and down turn, left and
    right set the speed (our optional "Cartridge wiring" setting).

## How we carried it over

- **The board.** 64 × 40 units, 2-unit cells, so one original pixel is 0.4 units. Our arenas are new
  designs with the same purposes:
  - Open Field, open ground;
  - Sandbag Line, light cover;
  - the Old Quarter, dense cover;
  - Bumper Yard, for Ricochet Royale.

  Each is validated for mirror symmetry, enclosure, reachability and spawn safety. Every channel and
  its title is listed in `src/engine/channels.ts` and `src/copy/channel-lines.ts`.

- **Numbers** are in `src/engine/rules.ts`, converted from frames at 50 Hz. Two are tuned, and say
  why:
  - Tank speed: 3 instead of 2.5 units a second, so a maze round has room for more than a handful of
    meetings.
  - The hit knockback: 1.6 instead of about 0.8 units, so a hit reads on a large screen.
- **The spawns on the Open Field** face up and inwards rather than at each other, so nobody wins a
  point at the bell.
- **Formations** keep their offsets as the original's copies did: all members get the same stick, so
  the group moves as one. Shots come from the leader; a hit on any member scores.
- **Diagonal movement.** The original slowed the steep diagonals to stop them outrunning straight
  lines on its pixel grid. Our movement is exact in every direction, so that correction is not
  needed.

## The Neighbourhood Kids

One shared AI (`src/ai/`), fair by construction.

- It perceives only through the visibility rules: an unseen tank keeps its last sighting, and a
  plane in a cloud is not seen.
- It aims with the same shell rules as a player. The aim planner traces every heading's shot,
  bounces included, and leads moving targets.
- Its stick is a person's stick.
- The Den's Kid setting (Human / Sharp, prompt 03a) does not change Tank Duel's Kids: they use
  neither `kids/memory` nor `kids/reflex`.

Personality from the kit sets how often a kid decides, how sloppily it judges range and steers a
guided shell, how close it likes to fight, how readily it dodges or takes cover, and how deep it
plans banks.

### What the simulations taught the AI

Running thousands of Kid matches headless showed problems that no amount of tuning could hide.
Each is fixed in the code, and the numbers then came from a seeded search.

- **Shells that never die.** A bouncing shell fired square at a wall bounced between that wall and
  the one opposite for ever, so its owner could never fire again. Both sides locked out meant a 0–0
  match. Every shell now burns out after 1.5 lifetimes, however often it bounces (a change from the
  original; see CHANGES-FROM-ORIGINAL).
- **A barrel through a wall.** The aim planner traced shots from the tank's centre when its barrel
  poked through a wall. The engine fizzles such a shell on the wall, so the planner now counts that
  heading as a miss in stop-wall channels.
- **Firing a step off.** Guided shots were let go one heading step off the plan, trusting the
  steering to fix it. Tanks turn too slowly for that at short range, so a Kid now fires only on
  the planned heading.
- **Steering into cover.** A guided shell was turned towards the enemy at once, even with a wall in
  between. It now holds its line until the target is in clear view from the shell, and is first
  corrected a quarter of a second after leaving the barrel.
- **Fizzles.** A shell that died on a wall just past the barrel was fired again from the same spot,
  over and over. A Kid now pauses and drives to a nearby spot.
- **Hunches into walls.** Wild and probing shots now need open floor ahead.
- **Too good.**
  - Bank shots, leading a moving target and aircraft aiming had no human error at all.
  - Each now has a misjudgement that grows with the kid's `error`: a bank can be a heading step
    off per bounce, a target's speed is misjudged, and planes aim with the same blur as tanks.
  - After any spin a Kid needs a moment to find the target again, and so does the novice.
- **Hiding for ever.** On invisible channels two careful Kids could wait each other out. A Kid that
  has not seen its enemy for a while now goes to look where it was last seen.
- **A target that never moves.** We played every Kid against a tank that never moves, on every
  tank channel. Several scored nothing in three minutes, for five reasons:
  - _Between two headings._ With sixteen headings, a target that sits between two of them cannot
    be hit from where the tank stands. Kids held close quarters and fired the same miss for a whole
    match. A Kid now holds close quarters only when its barrel lines up, and never under the
    billiard rule, where a straight line cannot score. Otherwise it shuffles to a new angle.
  - _Curls that cannot happen._ At 40 units a second, a guided shell has flown about 22 units
    before a turn of the barrel can bend it. The planner trusted a Kid's curl at any range; it now
    trusts only as much bend as the rest of the flight allows. Rosa's feint is one step, and only
    on a flight long enough to bring the shell back.
  - _Wedged without knowing it._ A tank nosing into a corner is bumped back a little every step, so
    a check for "not moving" never fired. Progress is now measured from where the tank set off,
    and a wedged Kid picks a spot nearby.
  - _Blind during the spin._ A Kid stopped looking while a hit tank spun, which is just when a
    hidden tank shows itself, so it went on aiming at the spot where the tank had started. It now
    watches through the spin, and a probing shot at a hidden tank needs a clear line that can score.

  - _Missing from the same place._ Rosa spent a whole round thirty units away behind the sandbag
    line, sending sixty shells into it: each time the planner found a curl worth trying, so Rosa
    never moved. A Kid that misses three times from one place at an enemy that has sat still for
    half a minute now holds fire and goes closer. A fizzle on the way counts as a miss and no
    longer sends it somewhere else. Played against Kids who keep moving, the rule seldom fires:
    a looser version that fired on any run of misses made every Kid far deadlier.

  Every Kid now scores against a still tank on every tank channel, invisible ones included. The
  same fixes ended the 0–0 matches in the Old Quarter.

- **Facing each other through a gap.** Two careful Kids stood a whole match nine units apart, each
  with a clear line to the other between the sandbags. Neither fired: a shell flies along the
  barrel's heading, not the line between the tanks, and both would have clipped a corner. Lining up
  now asks for the barrel's own line to be clear.
- **Circling for ever.** On the machine-gun channels two planes stayed within a burst's reach for
  almost the whole round, yet had the nose on each other less than one per cent of the time: both
  chased each other's tail at the same speed and went round in a circle. Pilots now break it as
  pilots do. They fly to where the enemy will be, the one behind throttles back to turn inside, and
  the one in front opens up to get away. Those rounds went from about 6 hits to about 11.
- **Shooting yourself (the Own ricochets setting).** Played with ricochets that can come home, the
  Kids at first hit themselves four to nine times a round, most of them a split second after
  firing into a wall right in front of them, which no person does on purpose. The planner now
  follows a bank's whole flight and drops any that would come back into the Kid first, and a Kid
  about to fire a shell that would be back within 0.6 seconds holds fire and thinks again. The
  ricochets that still catch a Kid come off several walls, two seconds or more later, as they
  catch people: about three or four a round on the bouncing channels. Nothing changes with the
  setting off.
- **A ceasefire after every hit.** The first search let a Kid wait about five seconds after any spin
  before it fired. That balanced Kid against Kid, but a person who fires straight after the spin got
  a free shot every time: a scripted novice that recovers in a second beat every Kid, Grandpa Lou
  included, in every match. The settle is now held at a person's time to find the target again
  (half a second plus one decision) and kept out of the search.

### The tuning

The knobs live in `src/ai/tuning.ts`, one table for every Kid; personalities from the kit do the
rest. The table comes from a parallel random search that minimised the squared distance outside
each target band. Three lessons shaped it:

- **Fixed seeds overfit.** The first search played every candidate on the same seeds. Its winner
  met every target there and missed three of them on fresh seeds. The search now draws fresh seeds
  every round and measures the reigning table again beside its challengers, so a lucky table
  cannot keep the lead.
- **Some knobs are not the search's to turn.** Left free, it found the ceasefire described above,
  and later reached a low score band by blurring the Kids' aim until they fired almost at random.
  The settle is fixed at a person's pace, and the aim knobs are bounded so a Kid misjudges a
  distant tank by a few units at most.
- **The score band moved.** The prompt asked for 6–20 combined in a timed round. Under the 1977
  rules two competent players score about 25–35, and only the ceasefire or sloppy aim held the Kids
  to 6–20. The owner chose to keep the Kids competent and fair and to raise the band to 10–35
  (`src/sim/targets.ts`).

- **Win rates are noisy.** At 96 matches a win rate is good to about 4.5 points either way, and
  two seed sets can differ by ten. The last steps were made by hand, each change measured on 512
  matches per target across four fresh seed sets; the report plays 256 per target.

The final check uses seeds the search never saw (`tests/balance.test.ts`, `scripts/simulate.ts`).

## Simulation results

The full report is [SIMULATIONS.md](SIMULATIONS.md), from `scripts/simulate.ts`: every channel
against all 15 Kid pairings, plus the targets on fresh seeds. The targets, with the report's figure
and the figure over every measurement of the final table:

| Target                              | Band         | Report | All measurements |                     |
| ----------------------------------- | ------------ | ------ | ---------------- | ------------------- |
| Grandpa Lou beats Pip, game-1       | 70–85%       | 84.2%  | about 82%        | met                 |
| Dee against Moss, game-1            | 40–60%       | 60.5%  | about 61%        | at the top edge     |
| The novice beats Pip, game-1        | 35–55%       | 46.7%  | about 45%        | met                 |
| Timed rounds end 10–35 combined     | at least 90% | 87.6%  | 88%              | short by two points |
| No channel 0–0 in over 5% of rounds | at most 5%   | 0.0%   | 0%               | met                 |

Two targets are not quite met, and the simulations say why:

- **The score band.** Most of the hits in a round, 80–88% of them, land within three seconds of a
  spin ending: the shooter is still lined up when the freeze lifts, as in 1977. The rounds that run
  over 35 are mostly guided shells on open ground (game-4, median 38) and the giant bomber. Making
  a hit Kid get out of the line more often lifts the band past 90%, but a Kid busy retreating stops
  shooting, and the bold Kids then win far more (Dee against Moss rose to 71%).
- **Dee against Moss.** Dee fires far more often (48 shots a round to Moss's 28) and enough of
  them land. No knob separated Dee from Moss without moving Grandpa Lou and Pip the same way: Lou
  and Moss are both careful and accurate, Pip and Dee both quick and sloppy. The balance test's
  lock on this pairing is set at 30–70% for that reason.

The yardstick for the third target is imperfect too: the scripted novice still noses into cover for
about a fifth of a round. Teaching it to steer free changed its results more than any knob changed
the Kids', so it stays the first-time player it was when the target was set.

Against a tank that never moves, every Kid scores on every tank channel (`tests/balance.test.ts`).
On a 1920 × 1080 window the match holds 60 frames a second on every channel tried, day and night,
and memory stays flat over ten minutes on the menu.
