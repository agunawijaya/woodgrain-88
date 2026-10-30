# Brief: Hot & Cold end-to-end flows and screenshots, and the Kid-setting e2e in both games

For: engineer. Runs after `briefs/hc-integration.md` and `briefs/den-kid-wiring.md`.
References: `prompts/03-hot-and-cold.md` §9 (the list of flows), `prompts/03a-hot-and-cold-finish.md`
§1–2, and the model to copy: `games/trailblaze/playwright.config.ts`, `games/trailblaze/e2e/`
(`harness.ts`, `flows.spec.ts`, `shots.spec.ts`) and the `e2e`/`shots` scripts in
`games/trailblaze/package.json`.

Stay inside: `games/hot-and-cold/playwright.config.ts`, `games/hot-and-cold/e2e/**`,
`games/hot-and-cold/package.json` (scripts only), `games/hot-and-cold/tsconfig.json` (include the
e2e files), `games/hot-and-cold/src/dev/**` (dev-only hooks the tests need),
`games/hot-and-cold/docs/media/screens/**`, and one new file
`games/trailblaze/e2e/kids-flows.spec.ts`. Another session works in `games/trailblaze/`: create
only that file there. Do not commit.

## 1. Config

Port **5521**: the dev server `pnpm exec vite --port 5521 --strictPort`, `url:
http://localhost:5521/game.html`, projects `flows` (1280×720) and `shots`, as Trailblaze's.

## 2. Flows (`e2e/flows.spec.ts`)

One test each, driven by keyboard unless the flow says mouse, asserting on the screens' text and
accessible names, never on pixels:

1. A race with two keyboard seats (Versus on channel 1): both seats walk and check; a capture
   scores.
2. Turns against a Kid in Classic Memory: the turn passes back and forth; the results show
   "What <Kid> remembered".
3. Hunting alone to the check limit: once to a loss (the flag is shown at the end), once to a win.
   If the harness cannot reach 75 checks in reasonable time, add a dev-only hook in `src/dev/`
   (never in the game's own code) and say so.
4. The clock (channel 8): the clock runs out and the results come.
5. The look switcher: all three looks, from the menu and from the pause item `Look: …`.
6. Daily (`mode=daily`): the fog toggle in the game's settings is disabled, with its reason shown.
7. The Kid memory panel after a match against a Kid.
8. The tutorial, to the end and back to the menu.
9. Keyboard only: menu to match to results without the mouse.
10. Mouse: click a square to walk there, click again to check.
11. A micro-challenge (`mode=micro&micro=find-the-flag`) starts its run directly.
12. A challenge link (`mode=challenge&challenge=…`) opens on the pre-match cards.
13. Reduced motion (`page.emulateMedia({ reducedMotion: 'reduce' })`): menu and a match, no page
    errors.
14. **The Kid setting**: the same seeded match against Lou with `kids=human` and `kids=sharp`;
    with Sharp, "What Lou remembered" lists nothing forgotten and nothing mixed up.

Every test fails on any page error (collect `pageerror`, as Trailblaze's harness helper does).

## 3. The Kid setting in Trailblaze (`games/trailblaze/e2e/kids-flows.spec.ts`)

The file name matches the `flows` project's pattern in Trailblaze's config, so it runs with
Trailblaze's flows. Use Trailblaze's `e2e/harness.ts` helpers. Play a seeded match against Rosa
at `speed=8` with `kids=sharp`, and check that the results' "How Rosa saw it" panel, once opened,
shows no slip marks.

## 4. Screenshots (`e2e/shots.spec.ts`, only with `SHOTS=1`)

For each look (polar, tabletop, radar) × light and dark × 1280×720 and 1920×1080, save to
`games/hot-and-cold/docs/media/screens/<look>-<screen>-<width>-<appearance>.png`:

- `menu`;
- `hunt`, mid-hunt with several clues uncovered;
- `bomb`, the bomb moment;
- `capture`, the capture moment;
- `results`.

Use fixed seeds, so a re-run gives the same pictures. For the bomb and capture moments, find a
seeded field and a scripted path that reach them, or add a dev-only hook in `src/dev/`.

## 5. Checks

Run the flows (`pnpm --filter @woodgrain-88/hot-and-cold e2e`), the Trailblaze Kid flow alone
(`pnpm exec playwright test -c games/trailblaze/playwright.config.ts --project=flows
kids-flows`), and the screenshots, plus tsc, eslint and prettier on what you touched. Report
pass and fail counts with the failing test names. A test that did not run is "not run".

Report back: files changed (one line each), the checks and their key output, anything not done, and
any visual or gameplay question you stopped at.
