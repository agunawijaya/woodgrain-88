---
id: den-fixtures
kind: plumbing
model: gemini-3.8-flash-high
fence:
  - hall/tests/fixtures/fake-game.ts
  - hall/tests/fixtures/turn-game.ts
  - hall/tests/fixtures/catch-game.ts
  - hall/tests/fixtures/index.ts
  - hall/tests/fixtures.test.ts
acceptance:
  - pnpm exec vitest run --project hall hall/tests/fixtures.test.ts
  - pnpm exec eslint hall/tests/fixtures hall/tests/fixtures.test.ts
  - pnpm exec prettier --check hall/tests/fixtures hall/tests/fixtures.test.ts
reads:
  - packages/kit/src/contract.ts
  - packages/kit/src/kids.ts
  - packages/kit/src/channels.ts
  - packages/kit/src/patches.ts
  - packages/kit/src/micro.ts
  - packages/kit/src/types.ts
  - packages/kit/src/share.ts
  - packages/kit/src/rng.ts
  - packages/kit/src/loop.ts
  - packages/kit/src/input.ts
  - hall/tests/fixtures/fake-game.ts
  - hall/src/data/registry.ts
---

## Goal

Den Life (prompt 01) is proven end to end with test-only fixture games, because no real game is
playable yet. This order does three things:

1. Bring the existing paddle fixture up to the amended contract.
2. Add two new fixtures:
   - a turn-based board game whose bot reads Neighbourhood Kid parameters;
   - a single-player game with three micro-challenges and thirty channels.
3. Add an index that exports all three, plus five "virtual" copies of the single-player game for
   Power Cycle Run tests.

The fixtures only ever load from the dev-only harness and from tests. They are never in the
registry or the build.

## Context

Contract changes in `packages/kit/src/contract.ts`, already done by the lead:

- `GameContext.proSwitch` is gone. Use `context.difficulty.get()` (`{ left: 'A' | 'B'; right: 'A' |
'B' }`) and `context.difficulty.onChange`.
- `manifest.supports.proSwitch` is gone. Describe the switches in `manifest.difficulty` (left and
  right `{ a, b }` lines, plus `liveChange`).
- `ChannelDef` needs `kind: 'original' | 'remix'`. A remix names its patch in `unlockedBy`. An
  original may give `originalGame: [n]` and a `group`.
- A bot seat is `{ kind: 'bot', kid: KidId }` in `context.seats`. `aiSettings(kid)` in `kids.ts`
  turns a kid into reaction, error rate and the like; `errorRateForRound` adds the streaky swing.
- `GameResult.emoji` is optional: at most 12 emoji summing up the run for the share line (see
  `emojiSummary` in `share.ts`).
- Read `fake-game.ts` to see how a fixture mounts, uses the loop and input, reports results and
  draws its demo.

Fixture slots: `createRegistry(overrides)` replaces a base game by slot, so each fixture claims
a slot.

- Paddles (`test-paddles`) stays on 11, because its second version owns Counter lamp 31.
- The turn game (`test-grid`) takes slot 20.
- The catch game (`test-catch`) takes slot 26.

Their families must match the base game they replace in that slot:

| Fixture        | Slot | Family                                  |
| -------------- | ---- | --------------------------------------- |
| `test-paddles` | 11   | arcade (it is 'duels' today; change it) |
| `test-grid`    | 20   | duels                                   |
| `test-catch`   | 26   | arcade                                  |

`players` and `versus` are free.

## Interface to implement

```ts
// hall/tests/fixtures/index.ts
import type { GameEntry, GameModule } from '@woodgrain-88/kit';
export { fakeGame, fakeManifest, FAKE_GAME_ID } from './fake-game.ts';
export { turnGame, turnManifest, TURN_GAME_ID } from './turn-game.ts';
export { catchGame, catchManifest, CATCH_GAME_ID } from './catch-game.ts';
/** The three fixtures as registry overrides, each loading its module. */
export const FIXTURE_ENTRIES: readonly GameEntry[];
/** Five catch games under ids test-catch-1 … test-catch-5 (slots 26–30), so a Power Cycle Run has five candidates. */
export function virtualRunGames(): { entry: GameEntry; module: GameModule }[];
/** Every fixture id, for the build check that keeps them out of the site. */
export const FIXTURE_IDS: readonly string[];
```

## Behaviour and edge cases

1. **Paddles (`fake-game.ts`), updated:**
   - family 'arcade';
   - `manifest.difficulty` with A as narrow paddles and B as normal, for each side, and
     `liveChange: true`;
   - the paddle height also shrinks by a third for a seat whose switch is A, applied from the next
     point;
   - channels `classic` (original, `originalGame: [1]`) and `fast` (original, `originalGame: [2]`)
     plus `remix-wild` (remix, `unlockedBy: 'first-point'`);
   - results carry `emoji`: 🟩 per point won and 🟥 per point lost, in order;
   - when seat 2 is a bot, it reads `aiSettings(seat.kid)` for its reaction delay and error rate.

   Keep everything else as it is: the versions, the test hooks (`data-version` on the canvas),
   the controls and the existing patches. The existing e2e specs rely on them.

2. **Turn game (`turn-game.ts`, id `test-grid`, title "Test Grid"):**
   - tic-tac-toe on a 3×3 board drawn on a canvas;
   - 1–2 players, `versus: 'local+bot'`;
   - seat 1 is X and moves first;
   - keyboard: arrows move a cursor, Enter places; mouse clicks a cell;
   - every cell button carries `data-cell="0"`…`"8"` in an overlay of buttons, so tests can play
     it.

   The bot (when seat 2 is a bot):
   - waits `reactionMs` (from `aiSettings`) before moving;
   - with probability `errorRateForRound` picks a random legal move, otherwise the best move
     (win, block, centre, corner, side);
   - a kid with `deception` > 0.7 prefers corner traps;
   - Benny (`mirror`) copies the player's last move by symmetry when it is legal.

   Results:
   - report `winnerSeat` (1, 2 or null for a draw) and `presentation: 'hall'`;
   - emoji 🟩 for a win, 🟥 for a loss, 🟨 for a draw;
   - emit events `move` (`{ cell: number }`), `win` (`{ seat: number }`) and `draw`.

   Patches:
   - `first-win` (club, count win 1);
   - `three-wins` (pro, count win 3);
   - `ten-wins` (legend, count win 10);
   - `perfect-draw` (secret: count draw 3, with a hint).

   Channels:
   - `classic`, original, `originalGame: [1]`;
   - `misere`, remix: a three-in-a-row loses, `unlockedBy: 'three-wins'`.

   `manifest.difficulty`: left A means the bot moves first, B means you move first; there is no
   right switch; `liveChange: false`. Its `demo()` plays bot against bot on a loop.

3. **Catch game (`catch-game.ts`, id `test-catch`, title "Test Catch"):**
   - 1P: move a basket left and right (arrows or A/D) to catch falling dots;
   - a run lasts 30 s or until three dots are missed;
   - score is the dots caught;
   - events `catch` (`{ streak: number }`) and `miss`;
   - 30 original channels in 5 groups of 6 ("Slow", "Brisk", "Fast", "Wind", "Night"), ids
     `slow-1` … `night-6`, `originalGame: [1]…[30]`, where the speed and drift differ by group;
   - three micro-challenges, each passed by events: `catch-five` (count catch 5), `streak-four`
     (max catch.streak 4) and `no-miss` (count catch 8 in channel `slow-1`);
   - patches: `ten-catches` (club, sum of catches 10), `streak-ten` (pro, max streak 10),
     `hundred` (legend, count catch 100);
   - emoji: one 🟢 per 5 dots caught (at most 12);
   - `manifest.difficulty.left`: A means a smaller basket, B a normal one; `liveChange: false`;
   - `supports.microChallenges: true`;
   - when `run.micro` is set, show its goal line at the top and end the run when the brief's
     seconds run out.
4. **Hygiene:**
   - every fixture validates: `validateManifest` returns [] and `validateChannels` returns [];
   - `validateRemixUnlocks` passes against each fixture's patch ids;
   - all ids are kebab-case;
   - every fixture's `mount` and `demo` clean up every listener and animation frame on
     `dispose`.

## Tests required (`hall/tests/fixtures.test.ts`)

- Each of the three manifests validates, and its channels and remix unlocks validate.
- `FIXTURE_ENTRIES` override slots 11, 20 and 26 in `createRegistry` without changing the count
  (30).
- `virtualRunGames()` returns five distinct ids and slots, each with three micro-challenges.
- The turn game's move picker (export it as a pure function `pickBotMove(board, seat, settings,
draw, lastHumanMove)` from `turn-game.ts`):
  - takes an immediate win;
  - blocks an immediate loss when its error draw says it does not err;
  - plays a random legal move when it errs;
  - Benny mirrors.
- `FIXTURE_IDS` lists the three ids and the five virtual ids.

## Out of scope

Any file outside the fence: the Hall's wiring, the harness entry and e2e specs.
