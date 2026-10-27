# Tank Duel — Changes from original

What Tank Duel keeps from the 1977 tank duel, what it changes and why, and what is new. The
original is described here only by how it plays; nothing from its program, tables or screens is in
this repository. The verified behaviour, in our own words, is in [NOTES.md](NOTES.md).

## Kept

- **All 27 variations**, each a channel with the same rules:
  - the vehicle: tanks, biplanes or jets;
  - the shot: guided, straight or machine gun;
  - bouncing walls and billiard scoring;
  - invisible tanks;
  - the board: open, light cover, dense cover, clouds or clear sky;
  - the formation: 1 v 1, 2 v 2, a giant bomber against three, one jet against three.
- **One point per hit**, one shell per player in the air, and no friendly fire (unless the Own
  ricochets setting below is on). Guided shells turn
  with the vehicle; machine guns fire short repeating bursts.
- **The hit.** The victim spins for about two and a half seconds and is shoved back along the shot.
  Both shells clear, nobody steers, and the clock keeps running.
- **The round.** About 2 minutes 44 seconds, and a warning for the last 20 seconds. At the end
  everything stops.
- **Tanks.** Sixteen headings turned one step at a time, at the original's rhythm. They drive
  forward only, are pushed back off walls and the other tank, and slide free when wedged.
- **Aircraft.** Always flying: biplanes have three speeds, and jets cruise, burn or brake. Nothing
  collides in the air, and everything wraps at the edges.
- **Bouncing and billiard.**
  - A bounce gives a shell back most of its flight.
  - On billiard channels only a banked shot scores.
  - After 32 bounces a billiard shell briefly cannot score, as the original's counter wrapped.
- **Invisible tanks** show only while they fire, bump something or spin after a hit.
- **Difficulty switch A is a handicap.** Shots fly about five eighths as far, and aircraft are
  slower: biplanes by one speed, jets by two. Tanks are unaffected.
- **The hooks.**
  - The shooter's vehicle twitches a step when it scores.
  - Each bounce raises the ricochet ping.
  - The two sides' explosions rumble at slightly different pitches.
  - The 32-in-1 cartridge's biplane wiring (up and down turn) is a setting, off by default.

## Changed

| Original behaviour                             | Woodgrain behaviour                                                          | Why                                                                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Tanks drive at about 2.5 units a second        | 3 units a second                                                             | A maze round has room for more than a handful of meetings                                                                         |
| The hit shoves the victim about 0.8 units      | 1.6 units                                                                    | The shove reads on a large screen                                                                                                 |
| Open-ground spawns face each other             | They face up and inwards                                                     | Nobody wins a point at the bell                                                                                                   |
| A bounce refreshes a shell's flight every time | Every shell burns out after 1.5 lifetimes, however often it bounces          | A shell fired square at a wall would bounce between that wall and the one opposite for ever, and its owner could never fire again |
| Steep diagonals are slowed                     | Movement is exact in every direction                                         | The slowdown only corrected the original's pixel grid                                                                             |
| The scores blink in the last seconds           | The round clock is a burning fuse that sparks faster; the score plates blink | The same warning, readable at a glance                                                                                            |
| A hit freezes play at once                     | A 60 ms hold before the spin                                                 | The blow lands before the spin starts                                                                                             |
| The score rolls over past 99                   | Scores count on                                                              | No player should lose a hundredth hit                                                                                             |
| Turning snaps a step at a time                 | Same steps and rhythm, eased between steps on screen                         | The rhythm is kept; the picture does not judder                                                                                   |

## Added

- **The Neighbourhood Kids.** Six computer rivals with their own styles. The original had no
  computer opponent: a tank nobody played just sat there.
- **Four Remix channels**, each opened by a patch:
  - Ricochet Royale, where only banks score and every bounce is a point;
  - Blackout, invisible tanks with a radar sweep;
  - Ace Duel, jets with afterburner fuel;
  - Last Tank, short rounds where one hit wins.
- **Rules and modes.**
  - Scoring: the timed round, or first to 10.
  - Ways to play: Versus for two players, Vs a Kid, and Practice, where the other tank sits still as
    in 1977.
  - Daily runs, challenge links, micro-challenges for the Power Cycle Run, and patches.
- **Around the match:**
  - a playable tutorial;
  - records per channel, against each Kid, and the best bank shot;
  - a results screen that replays the best hit with its bank path traced.
- **Settings:** the cartridge wiring, a practice aim line, explosion size, colour-blind-safe team
  colours, and the sound mix.
- **Reverse gear**, a setting, off by default. In 1977 pulling back only stops a tank; with Reverse
  gear on it backs the tank away at half speed, for every player and Kid alike. Asked for by the
  owner; off by default so the original's forward-only tanks stay the standard.
- **Own ricochets**, a setting, off by default. In 1977 your own shell never hits you. With Own
  ricochets on, a shell that has bounced off a wall at least once can come back and hit the side
  that fired it; that side spins as if hit and the other side gets the point. Asked for by the
  owner. Only a ricochet counts: a shell straight from the barrel, a guided shell steered round, or
  one carried round a wrapping sky never hurts its own side.
- **Keys for one or two players.** Alone, the whole keyboard steers: the arrow keys or WASD, and
  Space or Enter to fire. Two players on one keyboard split it, player 1 on the arrows and player 2
  on WASD.

## Removed

- **The SELECT and RESET switches.** The Hall's channel dial chooses the variation, and Play again
  restarts.
- **Black screens between games**, and scores that roll over.

## Presentation

- **A tabletop diorama.** Painted miniature tanks and aircraft on crafted terrain boards, seen from
  a fair tilted camera so both seats see the whole board equally.
- **By day and by night.** Golden afternoon light by day; at night, a desk lamp and moonlight, with
  muzzle flashes and explosions lighting the table.
- **Hits are arcade explosions:** a flash, a fireball, rolling smoke, debris, a scorch on the ground
  and the victim spinning as in 1977. No people are shown and there is no gore.
