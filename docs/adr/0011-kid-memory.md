# ADR-0011 — Human-like memory for the Neighbourhood Kids

- Status: accepted (prompt 03)
- Date: 2026-10-27
- Code: `packages/kit/src/kids/memory.ts`, tests `packages/kit/tests/kids-memory.test.ts`; first
  user `games/hot-and-cold/src/ai/kid.ts`

## Context

The owner asked that the Kids not have perfect recall. A person forgets, mixes things up and
misses what the other player did, and each Kid should too, to a degree that fits its character.

Hot & Cold is the first game where this decides the play. In its Classic Memory mode a clue shows
only while the button is held. Several later games will lean on the same idea: Table 21's card
counting, Disc Duel, Crown Jump. So the model belongs in the kit, not in one game.

## Decisions

### A small, seeded model of fading

- **Facts.** A fact is whatever the game says it is. The memory holds facts, never rules.
- **Strength.** Each fact has a strength: its salience when learned, halving every `halfLife`
  seconds since it was last refreshed. Using a fact refreshes it for the Kids who rehearse (Lou,
  Moss).
- **Capacity.** A memory holds at most `capacity` facts. A new fact pushes out the weakest, and the
  newest is always kept.
- **Recall.**
  - A fact below strength 0.25 is forgotten for good.
  - Otherwise it comes to mind with a chance equal to its strength (capped at 1); a fact that slips
    stays held for next time.
- **Mix-ups.**
  - A recalled fact may come back slightly wrong, and the Kid then believes the wrong version.
  - The chance is the profile's distortion times how far the fact has faded, so a fresh memory is
    exact and a fading one blurs.
  - Each game defines "slightly wrong" for its own facts through a `FactAdapter`.
- **Attention.** What the other player reveals is noticed only with the profile's `attention`;
  the rest is logged as missed.
- **Determinism.** Every random choice is one `rng.chance` call, in a fixed order, on the Kid's
  seeded stream, so tests and replays are exact.
- **Sharp memory.** A sharp profile (infinite capacity and half-life, no distortion, total
  attention) is the Den's harder option: perfect recall.

### Distortion grows with fading

The first version rolled each Kid's distortion at every recall. Kids recall at every decision, so a
clue seen five seconds earlier could be mixed up again and again. In the Hot & Cold race the
scatterbrained Kids lost almost everything, far beyond the brief's targets.

Tying the chance to how far the fact has faded keeps the brief's numbers and fixes the
compounding. It also matches experience: what you just saw, you remember right.

### Kept separate from the Kid's character

- Memory is not one of the nine personality numbers. `KID_MEMORY` sets each Kid's profile
  alongside the personality: Lou 9 facts and 120 s, down to Pip 3 facts and 20 s.
- Games may weigh sources differently through salience. Rosa and Benny weigh what the player finds
  more, because they watch the player.

### Inspectable

The memory keeps a log of every fact it learned, missed, forgot, pushed out or misremembered.
`summary()` turns the log into what the Kid kept, forgot, misremembered (truth and belief) and
missed, which a results screen can show.

## Consequences

- A game gets human-like opponents from a few lines: an adapter, `observe` / `witness` as the match
  runs, and `recall` when the Kid decides.
- Balance depends on the memory as much as on the AI. Hot & Cold's targets were met with the
  brief's values unchanged, once the fading rule was in place (NOTES.md).
- Rules that show everything (Hot & Cold's Notebook) skip the memory and use the capacity as a
  reading budget instead.
