# Gravity Duel — How to play

_Turn, thrust, drift and shoot. Nothing stops you but your own engine._

## Goal

**In a duel**, hit your rival's ship with your missiles: first to 10 points wins, or the higher
score when the match clock runs out. **In docking**, touch your pod with your speed matched to its
own: first to 10 docks, or the most when the clock runs out.

## Controls

Two people share one keyboard, or use two pads. Playing alone, you fly the blue ship on the arrow
keys.

**Classic** (as in 1978):

| Action            | Blue ship (seat 1)  | Orange ship (seat 2) | Gamepad                     |
| ----------------- | ------------------- | -------------------- | --------------------------- |
| Turn left / right | ← →                 | A D                  | Stick or d-pad left / right |
| Thrust            | ↑                   | W                    | Stick or d-pad up           |
| Cloak on / off    | ↓ on its own        | S on its own         | Stick down, or B            |
| Fire              | Enter or Right Ctrl | Space                | A                           |
| Pause             | Esc                 | Esc                  | Start                       |

**Modern** (point where you want to face):

| Action           | Blue ship (seat 1)                 | Orange ship (seat 2) | Gamepad    |
| ---------------- | ---------------------------------- | -------------------- | ---------- |
| Face a direction | Arrows (two at once for diagonals) | WASD                 | Left stick |
| Thrust           | Right Shift                        | Left Shift           | A          |
| Fire             | Enter                              | Space                | B          |
| Cloak on / off   | Right Ctrl                         | Q                    | Y          |

In Modern the ship still turns at the cartridge's rate. You say where to face, and it gets there
as fast as the Classic controls could.

## Rules

- **Turning.** Sixteen headings. A tap turns one step at once; held, the ship keeps turning a step
  every 0.16 s, a full circle in 2.56 s.
- **Thrust and drift.** Thrust pushes you along your heading, and you keep that speed until
  something changes it. To stop, turn round and thrust the other way. Top speed is just under 4
  steps a tick across a field 160 steps wide.
- **Fuel** (duels). 8 segments; one lasts 20.5 s of thrust. When it is gone your engine stops,
  and you drift.
- **Missiles** (duels).
  - You carry 8, one in flight at a time, each lasting 2.56 s.
  - You can fire again only 2.56 s after your last shot, even if it hit.
  - A missile adds your ship's speed to its own, so a shot fired along your motion goes faster.
    At top speed it folds over and comes out slower than you.
  - When both ships are out of missiles, both reload when the last one burns out.
- **Hits.** A hit scores 1 and sends the victim spinning for 1.28 s while play goes on. A spinning
  ship cannot be scored on again until it stops.
- **Your own missile.** Harmless for its first 0.16 s. After that, on difficulty switch A it can
  blow you up and your rival scores; on B it just vanishes.
- **The star** (channels 4 and 5).
  - It pulls on everything, missiles too, harder the closer you are.
  - It swallows missiles.
  - A ship that touches it explodes and goes back to its corner, and the rival scores.
- **The starbase** (channels 6 and 7). No pull. Touch it, at any speed, to go back to your corner
  with full fuel and missiles. It swallows missiles too.
- **The cloak** (channels 2–7).
  - Pull down on its own to vanish, again to reappear.
  - It costs a fuel segment at once and burns fuel as thrust does.
  - While cloaked you cannot be hit and the star cannot touch you, but you cannot turn, thrust or
    fire, and your missile in flight is harmless.
  - **If the cloak burns your last segment, your ship blows up and your rival scores.**
- **Edges.** Walls bounce you back; open edges carry you round to the other side.
- **Ships pass through each other.**
- **Docking** (channels 8–17).
  - No weapons, no cloak, endless thrust.
  - Pods drift with speeds of their own. Touch yours with your speed matched to dock: within one
    step a tick on switch B, almost exactly on A.
  - After a dock the pod sets off another way, and you must wait 2.56 s before docking again.
  - With a beacon in the middle, the pods swing round it.
- **Match end.** 10 points, or the clock: 12 minutes on Cartridge length, 4 on Short, which takes
  5 points to win. The score blinks for the clock's last 20 seconds.

## Modes and channels

Every variation of the 1978 program is a channel, with its cartridge number.

**Duel**

| Channel                        | Edges | Middle   | Cloak |
| ------------------------------ | ----- | -------- | ----- |
| Open Space (Game 1)            | Walls | —        | No    |
| Open Space · Cloak (Game 2)    | Walls | —        | Yes   |
| Wraparound · Cloak (Game 3)    | Open  | —        | Yes   |
| The Star (Game 4)              | Walls | Star     | Yes   |
| The Star · Wraparound (Game 5) | Open  | Star     | Yes   |
| Starbase (Game 6)              | Walls | Starbase | Yes   |
| Starbase · Wraparound (Game 7) | Open  | Starbase | Yes   |

**Docking race**

| Channel                     | Edges | Pods     | Beacon |
| --------------------------- | ----- | -------- | ------ |
| Rendezvous (Game 8)         | Open  | One each | No     |
| One Pod (Game 9)            | Open  | Shared   | No     |
| Beacon · One Each (Game 10) | Open  | One each | Yes    |
| Beacon · Walls (Game 11)    | Walls | One each | Yes    |
| One Pod · Walls (Game 12)   | Walls | Shared   | No     |
| One Each · Walls (Game 13)  | Walls | One each | No     |

**Solo docking**

| Channel                       | Edges | Beacon |
| ----------------------------- | ----- | ------ |
| Solo Rendezvous (Game 14)     | Open  | No     |
| Solo Beacon (Game 15)         | Open  | Yes    |
| Solo · Walls (Game 16)        | Walls | No     |
| Solo Beacon · Walls (Game 17) | Walls | Yes    |

**Remix**, opened by patches:

| Channel       | What changes                                                                 | Opened by   |
| ------------- | ---------------------------------------------------------------------------- | ----------- |
| Binary Stars  | Two stars orbit each other in the middle, and both pull.                     | Lou's Orbit |
| Comet         | Every twenty seconds a comet crosses the field, dragging everything near it. | Soft Dock   |
| Asteroid Belt | A ring of slow rocks round the starbase stops missiles and bounces ships.    | Ghost Kill  |
| Last Fuel     | Eight missiles and one tank for the whole match. No reloads.                 | Fuel Miser  |

## Settings

- **Look:**
  - Deep Space (starfighters, a living star);
  - Brass Orrery (clockwork craft, a filament bulb);
  - Paper Sky (crayon rockets, a smiling sun);
  - Whirlpool (submarines, a vortex).

  Only the picture and the sound change.

- **Controls:** Classic or Modern.
- **Trajectory guide** (off by default): dots showing where you will drift and where your shot
  would fly. Not available in daily runs, challenge links or micro-challenges, and runs played
  with it do not set records.
- **Match length:** Cartridge (10 points or 12 minutes) or Short (5 points or 4 minutes).
- **Ship colours:** Standard or Colour-blind safe. The two ships differ in shape too.
- **Reduced effects** (always on with reduced motion): smaller bursts, no camera nudge.
- **Camera:** Overhead, or Follow (a closer view that follows your ship; playing alone only).
- **Appearance** (Light, Dark, System) is the Den's.

## Scoring

- **Duels:** one point per hit. Your rival also scores when your own missile blows you up (switch
  A), when you touch the star, and when your cloak burns your last fuel.
- **Docking:** one point per dock.
- The higher score wins; a tie when the clock runs out is a draw.

## Patches

- **Club:**
  - First Contact: win any duel.
  - Soft Touch: dock five pods in one match.
- **Pro:**
  - Ghost Kill: score within a second of dropping your cloak (opens Asteroid Belt).
  - Fuel Miser: win a duel with six or more fuel segments left (opens Last Fuel).
  - Soft Dock: dock ten times with your switch on A (opens Comet).
- **Legend:**
  - Lou's Orbit: beat Grandpa Lou on The Star · Wraparound with your switch on A (opens Binary
    Stars).
- **Secret:**
  - "Aim where the star will send it."
  - "The station never checks your speed."

## Den Life

- **Difficulty switches:**
  - Duels: on A your own missile can blow you up; on B it cannot.
  - Docking: on A a dock needs your speed matched almost exactly; on B within one step a tick.
  - Each seat has its own switch, set before the match.
- **Gold thread:** every patch earned with your switch on A is sewn in gold; Lou's Orbit and Soft
  Dock ask for A anyway.
- **The Neighbourhood Kids.** They fly with human limits: they react late, lead a moving target
  by the wrong amount, misjudge where it is, hold a burn too long, forget how much fuel they have
  left and get rattled next to the star.
  - **Grandpa Lou:** calm and frugal with fuel; leads his shots well and takes only good ones;
    turns late.
  - **Moss:** keeps her distance, circles, cloaks when a missile comes, and heads for the
    starbase when she runs low.
  - **Rosa:** hunts you at close range and loves a shot bent round the star.
  - **Benny:** copies your moves a beat later.
  - **Dee:** full thrust everywhere, straight at you. The star gets her a lot.
  - **Pip:** wanders off, fires at almost anything, and now and then bends a perfect shot round
    the sun.
  - **Sharp Kids** (the Den's harder setting) react twice as fast, never fumble, lead exactly,
    judge where you are twice as well and never lose count of their fuel.
- **Power Cycle Run** (45 seconds each):
  - Three docks: dock 3 pods (Solo Rendezvous).
  - Round the star: score once with the star in play (The Star).
  - Close to the sun: fly 30 s close to the star without crashing (The Star).
  - Light touch: win a point with 5 s of thrust or less (Open Space).
- **Versus Night:** yes, in duels and docking races; a Kid can take the second seat.

## Tips

- Fire across your motion, not along it: at top speed a forward shot folds and comes out slower
  than you.
- Lead a moving ship: aim where it will be when your missile gets there.
- Round the star, aim wide. The star bends the shot; let it.
- Count your fuel before you cloak. The cloak is not an escape if it burns your last segment.
- Out of missiles? Your rival may still have some. Keep moving until they run dry too.
- Low on fuel on a starbase channel? Ram the station. It never checks your speed.
- Docking: match the pod's drift first, then close in slowly.
