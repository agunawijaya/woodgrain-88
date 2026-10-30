# ADR-0017 — Human aim and touch for the Neighbourhood Kids

- Status: accepted (prompt 05)
- Date: 2026-10-30
- Code: `packages/kit/src/kids/aim.ts`, tests `packages/kit/tests/kids-aim.test.ts`; first user
  `games/gravity-duel/src/ai/`

## Context

Memory (ADR-0011) and reflexes (ADR-0012) cover what a Kid forgets and how late its hands move.
Gravity Duel shows two more limits that a person has whenever things move, and that a perfect
opponent hides:

- A person leads a moving target badly: usually too little, never the same twice.
- A person holds a push past the point (a thrust, a brake, a turn) and corrects afterwards.

Tank Duel's gunners, the sports games' passes and shots, and the racers' braking all need the
same two errors. So they belong in the kit.

## Decisions

- **One small profile per Kid** (`AimProfile`):
  - `leadBias`: the share of the true lead the Kid applies on average;
  - `leadSpread`: how much that share varies from shot to shot;
  - `overshoot`: the typical extra length of a push, as a share of what was needed.
- **The game computes the truth, the kit spoils it.**
  - `leadShare(profile, rng)` gives the share for one shot. The game scales the target's predicted
    travel by it before solving its own aim.
  - `heldFor(needed, profile, rng)` gives how long the Kid actually holds a push the job needs
    `needed` of, in the game's own units.
  - Neither function knows anything about a game's geometry.
- **Shapes of the errors:**
  - the lead share is normal around the bias, never below zero;
  - the overshoot is half-normal, so a push is never shorter than needed. Coming up short is the
    reflexes' job (a late decision), not this one.
- **Starting values** (each game tunes its own with simulations; players meet the kit's):

  | Kid   | Lead bias | Lead spread | Overshoot |
  | ----- | --------- | ----------- | --------- |
  | Lou   | 0.95      | 0.08        | 0.10      |
  | Moss  | 0.85      | 0.12        | 0.15      |
  | Rosa  | 0.80      | 0.15        | 0.30      |
  | Benny | 0.75      | 0.15        | 0.25      |
  | Dee   | 0.60      | 0.20        | 0.60      |
  | Pip   | 0.50      | 0.35        | 0.35      |

- **The Den's Kid setting covers aim.** Sharp Kids lead exactly (bias 1) and never overshoot. They
  keep half their shot-to-shot wobble, so they are deadly without being machines.

## Consequences

- A game gets human aim from two calls. The kit stays small: no ballistic solvers, no geometry.
- Balance now depends on three profiles (memory, reflex, aim). Gravity Duel's NOTES.md records how
  each one moved its balance targets.
