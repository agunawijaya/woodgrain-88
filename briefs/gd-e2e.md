# Brief: Gravity Duel end-to-end flows and screenshot sets

For: **engineer** (writes the suite), then **qa-scout** (runs it and files the pictures). From the
lead (prompt 05, stage 8).

## Read first

- `prompts/05-gravity-duel.md` §9 (the Playwright list) and §5 (screens).
- `games/trailblaze/playwright.config.ts`, `games/trailblaze/e2e/*`: the model to follow. Do not
  import from it.
- Gravity Duel's `game.html` harness (the real module with a fake Hall context), `play.html` (the
  dev bench, which exposes `window.__gravityDuel = { match, session, stage }`), the controller,
  and the screens.

## Write

- `games/gravity-duel/playwright.config.ts`: port **5523**, projects `flows` (1280×720) and
  `shots`, the same GPU flags as Trailblaze.
- `games/gravity-duel/e2e/harness.ts`, `flows.spec.ts`, `kids-flows.spec.ts`, `shots.spec.ts`.
- `package.json` scripts `e2e` and `shots`, as Trailblaze's.

## Flows (each a test)

- Duel to 10 with two keyboard seats. Drive both seats; a dev hook may speed things up, for
  example placing a missile on course, if the harness offers one; otherwise use short matches.
- Duel against a Kid.
- Star variation (game 4) with a swallow.
- Starbase refuel (game 6), including a Hot Landing at top speed.
- Cloak fuel-out (a cloak with the last segment ends in a burnout and the rival scores).
- Mutual reload.
- Docking race (game 8) and solo docking (game 14).
- Both control schemes (Classic and Modern).
- Trajectory guide disabled in Daily (the setting shows its reason).
- All four looks load and play.
- Results panel order and keys: Play again (R) · Game menu · Back to the Hall (H).
- Tutorial completes.
- A micro-challenge starts and ends.
- A challenge link replays the same channel and opponent.
- Reduced motion: no camera nudge, the cloak snaps.

Engine-level setups (fuel, ammo, positions) may be poked through `window.__gravityDuel` on the
dev bench, or through any test hook the harness exposes. Keep them in the harness, not in the
game's code.

## Shots (`SHOTS=1` only)

For each look, at 1280×720 and 1920×1080, light and dark, into
`games/gravity-duel/docs/media/screens/<look>/`:

- menu;
- mid-duel;
- bank shot (the hero page's `scene=bank` is fine for this one);
- hit;
- dock;
- results.

Use `preserveDrawingBuffer` pages (the bench and hero pages have it) or wait two animation frames
before each capture.

## Standards

As AGENTS.md. Run the flows project yourself until it is green. Report: files, the run's result,
anything flaky and why.
