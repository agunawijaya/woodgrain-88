# Backlog

Ideas the owner wants kept for later. Nothing here is planned yet. When an idea is picked up, it
moves into a prompt and leaves this list.

## Hot & Cold

### Shared squares (a Remix channel)

_Raised by the owner on 2026-10-28, while reviewing prompt 03 stage 2._

In 1978, and in every original channel, two explorers can never stand on the same square. A step
onto the other explorer's square does not happen. The idea is a Remix channel where they can share
a square, and whoever presses first checks it.

What it would change:

- **Engine.** `step` in `games/hot-and-cold/src/engine/match.ts` stops refusing occupied squares.
  When both explorers on one square press in the same tick, a rule picks who checks first, perhaps
  the seat whose press came first by input order, or alternating.
- **Bombs.** The home corner can no longer be taken, so a bomb always sends its explorer home. The
  "home is taken, stay put" rule goes away in this channel.
- **Tactics.** Blocking disappears: Rosa's racing-and-blocking style needs another plan here. The
  race becomes a pure race to the square and the button.
- **Kids and the mouse.** Paths no longer walk round the other explorer (`nextMove` with
  `blocked = null`).
- **Looks.** Two explorers, pawns or blips on one square need to stand side by side, not inside
  each other. All three looks currently assume one figure per square.
- **Unlock.** Pick, or add, the patch that opens it, as the other Remix channels have.

The original channels keep the 1978 rule (hard rule 11).
