# Hot & Cold Inventory Report

Inventory of prompt 03 implementation status for Hot & Cold.

## A. Hall integration

### A.1 Registry status

**Still the placeholder.** Hot & Cold is imported from `coming-soon/hot-and-cold.ts` (registry.ts:20), not with a `load` function. At registry.ts:52 it is listed as `{ manifest: hotAndCold }` with no loader, whereas Tank Duel and Trailblaze have loaders at lines 59–60 and 76–78.

### A.2 Package exports and Hall dependency

**Not exported, not depended on.**

- `games/hot-and-cold/package.json`: no `exports` field (compare trailblaze/package.json lines 8–10 with `./manifest` and `./module`).
- `hall/package.json`: does not list `@woodgrain-88/hot-and-cold` in dependencies (lines 14–21 show `@woodgrain-88/kit`, tank-duel, and trailblaze only).

---

## B. Channels and Remix

### B.1 All channels: id, kind, group, title, unlockedBy

| Index | id            | kind     | group         | title            | unlockedBy  |
| ----- | ------------- | -------- | ------------- | ---------------- | ----------- |
| 1     | `game-1`      | original | Race          | Race             | (none)      |
| 2     | `game-2`      | original | Turns         | Turns            | (none)      |
| 3     | `game-3`      | original | Turns         | Turns · Bouncing | (none)      |
| 4     | `game-4`      | original | Turns         | Turns · Wrapping | (none)      |
| 5     | `game-5`      | original | Hunt for hunt | Hunt for Hunt    | (none)      |
| 6     | `game-6`      | original | Hunt for hunt | Hunt · Bouncing  | (none)      |
| 7     | `game-7`      | original | Hunt for hunt | Hunt · Wrapping  | (none)      |
| 8     | `game-8`      | original | Clock         | Clock            | (none)      |
| 9     | `game-9`      | original | Clock         | Clock · Bouncing | (none)      |
| 10    | `game-10`     | original | Clock         | Clock · Wrapping | (none)      |
| 11    | `two-flags`   | remix    | Remix         | Two Flags        | pure-memory |
| 12    | `minefield`   | remix    | Remix         | Minefield        | bomb-dodger |
| 13    | `thin-ice`    | remix    | Remix         | Thin Ice         | sharp-eyes  |
| 14    | `drift-storm` | remix    | Remix         | Drift Storm      | old-fox     |

(Source: channels.ts:38–134)

### B.2 Remix channels: rule implementation status

#### Two Flags

- **Defined:** Yes (channels.ts:89–99)
- **Patch exists:** Yes, `pure-memory` at patches.ts:37–42
- **Rule implemented:** Yes. At channels.ts:98 the rule object spreads `RACE` and adds `flags: 2`
- The two-flags rules are used directly in the session without additional engine code; the solver models two flags

#### Minefield

- **Defined:** Yes (channels.ts:100–110)
- **Patch exists:** Yes, `bomb-dodger` at patches.ts:23–27
- **Rule implemented:** Yes. At channels.ts:109 the rule object spreads `RACE` and adds `composition: { bombs: 16, distances: 27 }`
- The composition change flows through `generateBoard` in engine/board.ts to lay 16 bombs instead of 8

#### Thin Ice

- **Defined:** Yes (channels.ts:111–122)
- **Patch exists:** Yes, `sharp-eyes` at patches.ts:30–34
- **Rule implemented:** Yes. At channels.ts:121 `clueFadeSeconds: 10` is set on the channel object
- Fade is applied at controller.ts:299–301 (passed to match session), enforced at match-session.ts:301 and kid.ts:126

#### Drift Storm

- **Defined:** Yes (channels.ts:123–133)
- **Patch exists:** Yes, `old-fox` at patches.ts:44–52
- **Rule implemented:** Yes. At channels.ts:132 the rule object spreads `RACE` and adds `motion: 'bounce', flagSteps: 2`
- The motion and flagSteps settings are used in flag.ts to move the flag two steps (instead of one) when bouncing

### B.3 Group names mismatch with prompt 03a

**Code groups:** `'Race'`, `'Turns'`, `'Hunt for hunt'`, `'Clock'`, `'Remix'` (channels.ts:41–95)

**Prompt 03a expected:** `"Race / Turns / Solo"`

**Inference:** The code uses distinct group names for each play style: Race, Turns, Hunt for hunt, and Clock; it does not consolidate the latter three into "Solo". The "Hunt for hunt" and "Clock" groups remain as separate labels in channels.ts.

---

## C. Patches, micro-challenges, share

### C.1 Patch IDs and tiers

| id                 | tier   |
| ------------------ | ------ |
| `flag-finder`      | club   |
| `neighbours-rival` | club   |
| `bomb-dodger`      | pro    |
| `sharp-eyes`       | pro    |
| `pure-memory`      | pro    |
| `old-fox`          | legend |
| `lucky-75`         | secret |

(Source: patches.ts:7–62)

**Lucky 75 present:** Yes ✓ (patches.ts:55–61)

### C.2 75th check bonus implementation

**Yes, implemented.** At engine/match.ts:410:

```typescript
const onLastCheck = match.rules.style === 'hunts' && state.score + worth === match.rules.goal;
events.push({ type: 'capture', seat, square, onLastCheck });
```

The capture is marked `onLastCheck: true` only when:

- The match style is hunt for hunt (`match.rules.style === 'hunts'`)
- The capture brings the seat's total score to exactly the goal (75 checks in variations 5–7)

This event is tracked in progress/tracker.ts:61 and picked up by the Lucky 75 patch (patches.ts:60) as `field: 'onLastCheck'`.

### C.3 Micro-challenges and share emoji

**Micro-challenge IDs and channels:**

| id                  | channel | title                 |
| ------------------- | ------- | --------------------- |
| `find-the-flag`     | game-8  | Find the flag         |
| `find-two-flags`    | game-8  | Find 2 flags          |
| `flag-without-bomb` | game-8  | A flag without a bomb |
| `beat-dee`          | game-1  | Beat Dee to the flag  |

(Source: progress/micro.ts:8–41)

**Share emoji built at:** session/result.ts:24–28 in the `emojiTrail` function, which maps clue kinds to emoji (`🔢` ➜ distance, `➡️` ➜ arrow, `💥` ➜ bomb, `🚩` ➜ flag) and takes the first 12 checks.

Emoji is included in the GameResult at result.ts:71 (`emoji: emojiTrail(input.trail)`), then passed to controller.ts:553 where `dailyShareLine` formats it for the daily run. The share object is passed to the results screen at controller.ts:582 and displayed at screens/results.ts:348–349.

---

## D. Controller and kit contract

### D.1 setPauseItems calls and items

Four calls with **empty lists**:

- Line 327: showMenu() → `context.setPauseItems([])`
- Line 378: showTutorial() → `context.setPauseItems([])`
- Line 465: beginPlan() → `context.setPauseItems([])`
- Line 567: showResults() → `context.setPauseItems([])`

One call with **one item**:

- Line 495 in startMatch() → `context.setPauseItems([{ id: 'change-channel', label: 'Change channel', onSelect: () => showMenu() }])` (only in normal mode)

**Note:** Clues mode and Look are not exposed as pause items; they are changed from the menu.

### D.2 reportResult calls and presentation

**Called at:** controller.ts:521

```typescript
const receipt = context.reportResult(result);
```

Where `result` is a GameResult built by `buildResult()` (session/result.ts:60) with:

- `presentation: 'game'` (result.ts:72)
- `emoji: emojiTrail(input.trail)` (result.ts:71)

**Share line:** For daily runs only, the share object `{ share: { line, copy: () => ... } }` is spread into the results screen options at controller.ts:582. The line is built by `dailyShareLine()` (kit's share.ts) and passed through the results screen, not in the reportResult call itself.

### D.3 Possibility fog locks

**FOG_LOCKS defined at controller.ts:91–96:**

```typescript
const FOG_LOCKS: Partial<Record<GameContext['run']['mode'], string>> = {
  daily: 'The fog is off for the daily: everyone hunts the same field the same way.',
  challenge: 'The fog is off for challenge links, so both of you hunt on equal terms.',
  'power-cycle-run': 'The fog is off in a Power Cycle Run.',
  'versus-night': 'The fog is off on Versus Night.',
};
```

**Applied at:**

- controller.ts:130: `const fogLock = FOG_LOCKS[context.run.mode] ?? null;`
- controller.ts:187: `return fogLock === null && settings.get().fog;` (fogOn() checks both lock and setting)

**Recording marks:**

- controller.ts:540: When fog is on, the run keeps old bests: `...(fogOn() ? { ...recorded, bests: save.bests } : recorded)`
- controller.ts:578: Results card shows: `offRecord: fogOn() ? 'Not a record: the fog was on' : null`

### D.4 Manifest declarations

**At manifest.ts:9–62:**

```typescript
supports: { daily: true, challengeLinks: true, microChallenges: true },
difficulty: { left: {...}, right: {...}, liveChange: false },
events: HOT_COLD_EVENTS,
```

All three fields are declared.

---

## E. Tests, e2e, screenshots, docs

### E.1 Vitest results

**Command:** `pnpm exec vitest run --project hot-and-cold`

```
 Test Files  11 passed (11)
      Tests  117 passed | 2 skipped (119)
   Start at  23:10:54
   Duration  3.54s
```

### E.2 Type check and lint

**TypeScript:** `pnpm exec tsc -p games/hot-and-cold/tsconfig.json` → No errors

**ESLint:** `pnpm exec eslint games/hot-and-cold/src games/hot-and-cold/tests` → No errors

### E.3 E2E, playwright, screenshots

**Not found:**

- No `playwright.config.ts` in `games/hot-and-cold/`
- No `e2e/` directory in `games/hot-and-cold/`
- No `docs/media/screens/` directory

Media assets do exist at `docs/media/hero/` (hero shots and companion animations), but no e2e screenshots.

### E.4 Documentation files in `games/hot-and-cold/docs/`

**Exists:**

- `NOTES.md` ✓

**Not found:**

- ABOUT.md
- HOW-TO-PLAY.md
- ARCHITECTURE.md
- CHANGES-FROM-ORIGINAL.md

**ADR for looks:** No ADR found in `docs/adr/` matching "hot", "cold" or "looks".

### E.5 NOTES.md balance numbers and Kid memory values

**Balance numbers (Feel section, lines 118–131):**

| Parameter                     | Ticks | Seconds | Source             |
| ----------------------------- | ----- | ------- | ------------------ |
| Step while held               | 16    | 0.63    | 1978               |
| Step, switch A in variation 1 | 20    | 0.79    | 1978               |
| Button asleep after a step    | 7     | 0.28    | 1978               |
| Wait for the next turn        | 15    | 0.59    | 1978               |
| Bomb blast                    | 8     | 0.32    | 1978               |
| Capture celebration           | 32    | 1.26    | 1978               |
| One clock tick                | 31    | 1.22    | 1978               |
| Clock                         | 75    | ~92     | 1978               |
| New field: wait before moving | 16    | 0.63    | 1978 (first steps) |

**Kid memory values (lines 133–145):**

| Kid   | Capacity | Half-life | Distortion | Attention | Rehearses |
| ----- | -------- | --------- | ---------- | --------- | --------- |
| Lou   | 9        | 120 s     | 2%         | 90%       | yes       |
| Moss  | 7        | 90 s      | 4%         | 80%       | yes       |
| Rosa  | 6        | 60 s      | 6%         | 85%       | no        |
| Benny | 6        | 60 s      | 5%         | 95%       | no        |
| Dee   | 4        | 30 s      | 10%        | 50%       | no        |
| Pip   | 3        | 20 s      | 18%        | 40%       | no        |

---

## F. The Den's Kid setting (does not exist yet)

### F.1 Settings infrastructure

**Den UI:** `hall/src/chrome/settings-panel.ts` (lines 100–300) provides the appearance, sound, motion, CRT, and controls panels. No Den-wide Kid setting UI yet.

**Kit settings storage:**

- Schema and API: `packages/kit/src/settings.ts:56–134` (`createSettings()`)
- Current version: No versioning constant found; inferred as v1
- Read function: `repo.get()` (settings.ts:97)
- Write function: `repo.update((draft) => { ... })` (settings.ts:98–102)

Game-specific settings are read/written via `game(gameId)` at settings.ts:113–125, which returns a namespace that calls `repo.get().games[gameId]` and `repo.update()`.

### F.2 Den-wide settings reads in GameContext

**GameSettingsView interface** (contract.ts:256–266):

```typescript
export interface GameSettingsView {
  appearance(): Appearance;
  onAppearance(listener: (appearance: Appearance) => void): Unsubscribe;
  reducedMotion(): boolean;
  onReducedMotion(listener: (reduced: boolean) => void): Unsubscribe;
  screenShake(): boolean;
  crtEnabled(): boolean;
  colorBlindHints(): boolean;
  /** The game's own settings namespace. */
  game: GameSettingsStore;
}
```

Games access Den settings through `context.settings.appearance()`, `.reducedMotion()`, etc., and game-specific settings through `context.settings.game.get(key, fallback)`.

### F.3 memoryProfile and reflexProfile call sites

**memoryProfile calls:**

- Hot & Cold, ai/kid.ts:20 import, line 83 usage: `const profile = memoryProfile(kid, options.memory);`
- Trailblaze, ai/kid.ts:23 import, line 157 usage: `const profile = options.profile ?? reflexProfile(kid, options.mode);` (with fallback to reflex)
- Trailblaze, ai/kid.ts:190 usage in Ghost memory: `ghostMemory = createGhostMemory(memoryProfile(kid, options.mode), seat);`

**reflexProfile calls:**

- Trailblaze, ai/kid.ts:24 import, line 157 usage (as noted above)

**mode: 'human' passes:**

- Trailblaze, app/controller.ts:239: `createKidRider({ kid: rider.kid, seat, mode: 'human', seed: ... })`
- Trailblaze, demo/demo.ts:89–90: Two `createKidRider({ ... mode: 'human' ... })`
- Trailblaze, dev/play.ts:105: `createKidRider({ kid: entry.kid, seat, mode: 'human', ... })`
- Trailblaze, dev/play.ts:142: `createKidRider({ kid, seat: index === 0 ? 2 : 3, mode: 'human', ... })`
- Trailblaze, sim/duel.ts:89–90, 100, 167: Three `createKidRider({ ... mode: 'human' ... })`

### F.4 Tank Duel's Kid usage

**Tank Duel does not use memoryProfile or reflexProfile.** Search found no imports of `createKidMemory`, `memoryProfile`, or `reflexProfile` in `games/tank-duel/src`. Tank Duel implements custom AI in its `ai/` folder (aim.ts, commander.ts, navigation.ts, perception.ts, personality.ts, tuning.ts) that does not rely on the kit's memory model.

### F.5 Trailblaze createKidRider call sites (with path:line)

All `createKidRider` calls are with `mode: 'human'`:

| File              | Line | Context                                         |
| ----------------- | ---- | ----------------------------------------------- |
| ai/kid.ts         | 145  | function definition                             |
| app/controller.ts | 239  | When building a match rider from seated Kid     |
| demo/demo.ts      | 89   | Rosa in demo                                    |
| demo/demo.ts      | 90   | Moss in demo                                    |
| dev/play.ts       | 105  | Interactive play, building rider from Kid entry |
| dev/play.ts       | 142  | Building a four-kid multiplayer match           |
| sim/duel.ts       | 89   | First rider in duel simulation                  |
| sim/duel.ts       | 100  | Second rider in duel simulation                 |
| sim/duel.ts       | 167  | Computing balanced matchup win rate             |

---

## Summary of open items

- **A:** Hot & Cold is not yet integrated with the Hall (no `load` function, no exports, not in hall dependencies)
- **B.3:** Group names do not match prompt 03a; code has 5 groups (Race, Turns, Hunt for hunt, Clock, Remix), prompt expected 3 (Race, Turns, Solo)
- **E:** No e2e tests, playwright config, or screenshot docs; no ABOUT, HOW-TO-PLAY, ARCHITECTURE, or CHANGES-FROM-ORIGINAL; no ADR for looks
- **F:** The Den's Kid memory setting does not exist; games currently hardcode their memory mode (Hot & Cold uses `'human'` at controller.ts:179)
