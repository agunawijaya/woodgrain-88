# Gravity Duel: engine check

An independent review of `src/engine` against `docs/NOTES.md`, with the dossier
(`research/dossiers/16-gravity-duel.md`) as a fallback where NOTES.md is silent. Every claim below was
proven end to end through `createMatch` and `stepMatch`, with bodies parked where they are needed rather
than flown there. The tests live in `tests/hooks.test.ts`.

## Verdicts

- **Starbase speed check that can never fire** — confirmed. A ship at top speed refuels, rearms and
  returns to its start spot at rest without exploding; the `refuelled` event reports its speed.
- **Cloak fuel-out suicide** — confirmed. Cloaking on the last segment, or burning it away while
  cloaked, blows the ship up and scores for the rival; thrusting the last segment away is safe.
- **Mutual reload** — confirmed. One empty ship stays empty while the rival still has missiles; both
  refill only when a missile's countdown ends with both empty.
- **Ships pass through each other** — confirmed.
- **The speed fold** — confirmed. A ship at 60 units firing straight ahead launches a missile that
  folds to 31 units and is slower than its ship.
- **Cloaked ships cannot steer, thrust or fire** — confirmed, and their missile in flight cannot hit or
  be swallowed until they uncloak.
- **A hit does not reload early** — confirmed. The next shot still waits the full 128 ticks from the
  last firing.
- **The spinning victim** — confirmed. It spins 64 ticks one heading step a tick, cannot be scored on
  again meanwhile, and can still thrust and fire.
- **Self-hit** — confirmed. Harmless for 8 ticks; then on switch A it explodes and the rival scores, on
  switch B the missile is just taken back.
- **Gravity's rhythm** — confirmed. Each body is pulled once every 8 ticks, on odd ticks, in the order
  ship 0, ship 1, shot 0, shot 1.
- **Docking tolerance** — confirmed. On B a dock needs a whole-unit difference under 16; on A at most 1.
- **Match end** — confirmed. Ten points end it at once; the clock ends it after 35,840 ticks with a
  warning 1,024 ticks before.

## Disagreements

None. The engine matches NOTES.md on every hook and surprising rule above.

One place where the dossier is narrower than NOTES.md: it limits the mutual reload to variations 1–5,
while NOTES.md states the rule generally. The engine applies it to all seven duels, which matches
NOTES.md, the specification that wins.

## Not described in either

- The `refuelled` event carries the ship's speed (the sum of the whole units on both axes, 126 at top
  speed). NOTES.md describes only the dead speed check; surfacing the real speed in the event is our
  own, faithful addition and is documented in `types.ts`.
- A missile's `turned` field accumulates how far gravity bends its path, used by the Slingshot patch and
  the bank-shot replay. This is our own addition and does not change the cartridge's rules.

## Method

Each test drives the real engine: `setupFor` builds a match at a chosen variation, `place` parks bodies
at exact spots and speeds, and `stepMatch` advances one tick. No test calls the engine's internals
directly.
