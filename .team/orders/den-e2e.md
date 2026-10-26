---
id: den-e2e
kind: tests
model: gemini-3.8-flash-high
fence:
  - hall/e2e/harness/den-life.spec.ts
  - hall/e2e/harness/den-life-modes.spec.ts
  - hall/e2e/harness/den-life-a11y.spec.ts
  - hall/e2e/frames/den-life-frames.spec.ts
  - hall/e2e/harness/play-loop.spec.ts
  - hall/e2e/helpers.ts
acceptance:
  - pnpm exec playwright test hall/e2e/harness --project harness
  - pnpm exec eslint hall/e2e
  - pnpm exec prettier --check hall/e2e
reads:
  - playwright.config.ts
  - hall/e2e/helpers.ts
  - hall/e2e/harness/play-loop.spec.ts
  - hall/e2e/site/a11y.spec.ts
  - hall/e2e/frames/frames.spec.ts
  - hall/src/harness.ts
  - hall/src/app/boot.ts
  - hall/src/routes/router.ts
  - hall/src/den/den-view.ts
  - hall/src/den/scene.ts
  - hall/src/den/console.ts
  - hall/src/den/den-life-layer.ts
  - hall/src/den/calendar-view.ts
  - hall/src/den/growth-art.ts
  - hall/src/jacket/jacket-view.ts
  - hall/src/jacket/patch-popover.ts
  - hall/src/kids/kids-view.ts
  - hall/src/versus/versus-view.ts
  - hall/src/run/run-overlay.ts
  - hall/src/play/session.ts
  - hall/src/play/den-modes.ts
  - hall/src/channels/channel-picker.ts
  - hall/src/chrome/settings-panel.ts
  - hall/src/chrome/dialog.ts
  - hall/src/dev/showcase-boot.ts
  - hall/tests/fixtures/fake-game.ts
  - hall/tests/fixtures/catch-game.ts
  - hall/tests/fixtures/index.ts
---

## Goal

Playwright end-to-end tests for Den Life, run against the dev harness (`/harness.html`), plus a fix
that makes the existing play-loop spec independent of the day's Power Cycle pick. You write the
specs only; the lead runs them. Read the source files listed above to get every selector right,
and use only selectors that exist there (`data-ref`, `data-do`, `data-action`, classes, roles).

## Context

- The harness boots the real Hall with fixtures:
  - test-paddles in slot 11: two seats, versus `local+bot`; a bot seat scores 3 points within about
    30 s and wins, so an idle seat 1 loses;
  - test-grid in slot 20;
  - five catch games, test-catch-1 to test-catch-5, in slots 26–30, each with micro-challenges.
- `?showcase=full`, `?showcase=mid` or `?showcase=new` before the hash boots on a generated
  profile in memory (dev only): every growth item, patches on the jacket, a Versus series at 2–1,
  a Power Cycle Run two rounds in. Example: `/harness.html?showcase=full#/jacket`.
- Without a showcase, data lives in localStorage; use `skipIntro(page)` from `helpers.ts` first.
- Routes: `#/`, `#/jacket`, `#/kids`, `#/versus`, `#/run`, `#/play/<id>?…`, `#/records`.
- Every test collects console errors with `collectErrors(page)` and ends with
  `expect(errors).toEqual([])`.
- Timeouts: give the Versus and Run tests `test.setTimeout(180_000)`.

## Tests

### hall/e2e/harness/den-life.spec.ts

1. **Jacket by keyboard.** Open `?showcase=mid#/jacket`.
   - Focus the first `.sewn-patch` and press Enter: the patch is held (`.jacket-held-ring` is
     visible).
   - ArrowRight changes that patch's `transform` attribute; R changes it again (rotation).
   - Enter sews it: the ring is hidden.
   - Ctrl+Z restores the transform recorded before ArrowRight.
2. **Jacket by mouse.** On `?showcase=mid#/jacket`, open a sewn patch's up-close view by clicking
   it.
   - "Take it off" removes it: the `.sewn-patch` count drops by one.
   - Drag that patch's drawer tile (`.patch-tile[data-key="…"]`) onto the middle of the jacket SVG
     with `page.mouse` (down, several moves, up): the count is back.
3. **Jacket export.** "Export card" (`[data-do="export"]`) triggers a download whose suggested
   file name ends in `.svg`.
4. **Calendar month view.**
   - In `?showcase=full#/`, clicking `[data-ref="calendar"]` opens `.dialog--calendar`, whose
     `.cal-grid` has at least 28 `li`.
   - PageUp changes `.cal-month` to the previous month; Escape closes it.
5. **Switches persist and reach the game.** In `#/` (no showcase):
   - press `]`: `[data-ref="switch-right"]` has an aria-label containing "A, hard";
   - reload: still "A, hard";
   - go to `#/play/test-paddles`, press Enter to start, then Escape: the pause dialog's
     `[data-switch="right"] strong` reads "A".
6. **Channel dial by number pad.** Go to `#/play/test-catch-1` (the game menu).
   - Click `.play-channel`, press 1, 2, then Enter.
   - The URL hash contains `ch=` with the 12th channel's id, read from the dial chip
     `[data-pick]` whose `.dial-chip-number` is 12 before pressing Enter.
   - `.play-channel` then starts with "CH 12".
7. **Growth and Forget my data.** In `?showcase=full#/`, there are 4 `.growth-poster` elements.
   - Settings (`.topbar` settings button), then `[data-do="forget"]`, then confirm.
   - Back in the Den, there are no `.growth-poster` and no `.growth-trophy`.
8. **Navigation.** From `#/` click the corkboard `[data-ref="corkboard"]`: `#/kids` with
   `.kids-screen` visible. "← Back to the Hall" returns to `#/` and the Den. The same for the jacket
   and the chalkboard (`#/versus`).

### hall/e2e/harness/den-life-modes.spec.ts

1. **Versus Night, best of 3, with a Kid in seat 2.** `skipIntro`, then `#/versus`.
   - Pick "A Neighbourhood Kid", choose `pip` in the kid select, choose best of 3, and untick every
     pool checkbox except `test-paddles`. Start the night.
   - Loop until `.versus-stage.is-crowned` is visible:
     1. click "Draw game N";
     2. wait for "Play game N";
     3. click it, press Enter to start the match;
     4. wait for `.dialog--results`, then click `[data-result="versus"]`.
   - The finished night shows `.series-games li` (two) and `[data-do="rematch"]`.
   - `#/records` lists a rivalry.
2. **Power Cycle Run through five transitions.** `skipIntro`, then `#/run`.
   - Click "Start a run" (`[data-do="free"]`).
   - Five times:
     1. wait for the goal card's `[data-do="go"]` (each time, `.run-card-kicker` reads
        "Round N of 5");
     2. click Go;
     3. wait for `.run-round-hud`;
     4. press Escape, choose "Back to the Hall" in the pause menu, and accept the leave
        confirmation;
     5. go to `#/run` again.
   - After the fifth, `.run-slates li` has 5 items and `.run-share` contains "0/5".

### hall/e2e/harness/den-life-a11y.spec.ts

For light and dark (`page.emulateMedia({ colorScheme })`), axe (`@axe-core/playwright`, same
helper shape as `site/a11y.spec.ts`: wait for finite animations, then no serious or critical
violations) on:

- `?showcase=full#/jacket`;
- `?showcase=mid#/kids`;
- `?showcase=full#/versus`;
- `?showcase=new#/versus` (the setup form);
- `?showcase=full#/` with the calendar dialog open;
- `#/play/test-catch-1` with the channel dial open;
- `?showcase=full#/jacket` with a patch's up-close dialog open.

### hall/e2e/frames/den-life-frames.spec.ts

Like `frames/frames.spec.ts`, at 1920×1080, but on `http://localhost:4488/harness.html?showcase=full#/`
(an absolute URL, since the frames project's base URL is the built site): the grown Den, median
frame interval and main-thread busy time per frame. Report both with `test.info().annotations`.
Hold them to the same budgets only when the renderer is not SwiftShader, as the existing spec does.

### hall/e2e/harness/play-loop.spec.ts (fix)

The Den now opens on the day's pick among seven playable fixtures, so clicking the game card may
start a game other than test-paddles. Before the first game card click:

- focus `.cartridge[data-slot="11"]`;
- press Enter;
- wait for the Counter to read "11" (`counterText`).

Change nothing else.

## Style

Each spec has a short file comment saying what it proves. TypeScript strict, ESLint and Prettier
clean; no `any`, no `waitForTimeout` longer than 1 s (wait for selectors or `expect.poll`
instead), no commented-out code.
