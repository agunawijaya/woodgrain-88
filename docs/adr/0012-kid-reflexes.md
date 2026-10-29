# ADR-0012 — Human-like reflexes for the Neighbourhood Kids

- Status: accepted (prompt 04)
- Date: 2026-10-29
- Code: `packages/kit/src/kids/reflex.ts`, tests `packages/kit/tests/kids-reflex.test.ts`; first
  user `games/trailblaze/src/ai/kid.ts`

## Context

The owner's rule from Hot & Cold applies here too: Kids have human limits and never play
perfectly. In a turn-based game those limits are mostly memory (ADR-0011). In a real-time game they
are perception and reflexes: how quickly a Kid reacts, how far ahead and around it looks, what it
misses, how pressure rattles it, and how often its hands slip. Trailblaze is the first game where
these decide the play. Tank Duel, Bumper Chase, Disc Duel and the sports games will need the same
thing, so it belongs in the kit.

## Decisions

- **The game decides, the reflex delivers.** A game's AI chooses an action from what the Kid
  perceives. `KidReflex<A>` turns that decision into a delayed and sometimes spoiled action of the
  game's own type `A`. It never chooses for the game.
- **One profile per Kid** (`ReflexProfile`):
  - reaction time, as a mean and a spread;
  - lookahead and awareness, in the game's own steps;
  - attention, the chance of noticing what the rival just did;
  - panic, how much pressure slows and rattles the Kid;
  - slip rate;
  - a planning style: weights for claiming space, cutting off, safety and mirroring.
- **Pressure is two numbers**, speed and cramp, each 0 to 1. The game supplies them. Panic is the
  Kid's panic weight times the larger of the two. Full panic stretches a reaction by half
  (`PANIC_LAG`), doubles the slip rate (`PANIC_SLIPS`) and halves attention. It does not narrow
  lookahead or awareness. A first version did, and it made nervous Kids blind exactly when speed
  should have rewarded their fast hands.
- **Foreseen moves are timed, surprises are reacted to.** A turn the Kid saw coming (a wall it has
  been riding towards) only has to be timed, so it takes `FORESEEN_SHARE` (35%) of a reaction. A
  surprise (the rival's bike or fresh trail in the way) takes the whole reaction. Games say which
  is which when they call `decide`, and plan with `expectedDelay(pressure, foreseen)`.
- **A slip is either late or wrong, with equal odds.** A late slip doubles the delay. A wrong slip
  performs one of the alternatives the game offered. Trailblaze offers only open headings: a wrong
  turn into a wall reads as a bug, not a fumble, while a late turn into one reads as human.
- **Seeded and logged.** The reflex draws only on the rng it is given, against the game's clock.
  Its log ('decided', 'acted', 'slipped-*', 'noticed', 'missed') feeds the results panel's "How the
  Kid saw it".
- **The Den's Kid setting covers reflexes.** `reflexProfile(kid, 'sharp')` removes slips and halves
  reaction times, under the same Human / Sharp setting as memory (`MemoryMode`). Records note which
  setting was used.

## Consequences

- Each game owns its perception: what "within awareness" means on its board, and what counts as
  speed and cramp. Trailblaze uses a Chebyshev radius round the head and treats far cells as open.
  That is how a narrow-eyed Kid rides into a dead end.
- Values start from the table in the module and are tuned by each game's balance simulations. A
  game may pass its own profile for its simulations, but players always meet the kit's.
- Trailblaze's tuning (October 2026) moved several values away from the starting table: Lou 360 ms
  with lookahead 7, Dee 160 ± 30 ms with panic 0.6, Pip ± 60 ms. Its NOTES.md has the runs and the
  reasons.
- Speed only rewards fast hands if the game makes slow ones pay. Trailblaze does this by letting
  each Kid want at least one reaction's worth of open road ahead, more if it is careful. At speed,
  a slow, careful Kid keeps turning away and gives up room.
