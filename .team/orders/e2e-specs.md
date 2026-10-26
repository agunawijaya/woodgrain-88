---
id: e2e-specs
kind: tests
fence:
  - hall/e2e/site/*.spec.ts
  - hall/e2e/harness/*.spec.ts
acceptance:
  - pnpm exec tsc -p hall/e2e/tsconfig.json
  - pnpm exec eslint hall/e2e
  - pnpm exec prettier --check hall/e2e
reads:
  - playwright.config.ts
  - hall/e2e/helpers.ts
  - hall/src/app/boot.ts
  - hall/src/den/den-view.ts
  - hall/src/den/scene.ts
  - hall/src/den/console.ts
  - hall/src/den/wall.ts
  - hall/src/den/game-card.ts
  - hall/src/chrome/topbar.ts
  - hall/src/chrome/settings-panel.ts
  - hall/src/chrome/dialog.ts
  - hall/src/list/list-view.ts
  - hall/src/play/session.ts
  - hall/tests/fixtures/fake-game.ts
---

## Goal

Write the Playwright end-to-end specs for the Hall from the scenario list below. The lead runs
them; you only write them so they typecheck and lint cleanly.

## Context

- `playwright.config.ts` defines two projects: `site` (built site on port 5488, specs in
  `hall/e2e/site/`) and `harness` (dev server on 4488 serving `/harness.html`, specs in
  `hall/e2e/harness/`, where slot 20 holds the test-only fake game "Test Paddles", id
  `test-paddles`).
- Use `@playwright/test` (`test`, `expect`) and `@axe-core/playwright` (`AxeBuilder`).
- Use the helpers in `hall/e2e/helpers.ts`: `skipIntro(page)` before `page.goto` in every test
  except the intro tests, `counterText(page)`, `collectErrors(page)` (assert it is empty at the end
  of each test).
- Selectors you can rely on: `.den` (with `data-time="day"|"night"`), `svg.den-scene`,
  `[data-ref="power"]` (the POWER lever, focusable), `[data-ref="power-arm"]`,
  `.cartridge[data-game="<id>"]` (wall labels, focusable), `.game-card`,
  `.game-card button[data-action="play"]`, `.game-card button[data-action="details"]`,
  `.topbar button[data-action="appearance"|"settings"|"sound"]`,
  `.topbar-switch button[data-action="den"|"list"]`, `.list-view`, `.list-card`,
  `.filter-chip[data-group="family"][data-value="duels"]`, `.dialog` with `.dialog-title`,
  `.dialog-close`, `.play-view`, `.play-back`, `.play-pause`, `.dialog--pause`,
  `.dialog--results`, `button[data-result="again"|"menu"|"hall"]`, `.play-challenge`,
  `.intro-dark`, `.den.is-intro`.
- The Den starts on slot 1 when no game is playable (site) and on the fake game's slot 20 in the
  harness (it is the only playable game, so it is the day's Power Cycle).
- Power cycles take about 0.7 s; wait for the Counter text to change with `expect.poll`.

## Behaviour and edge cases

Site specs (`hall/e2e/site/`):

1. `den.spec.ts`: by day (`colorScheme: 'light'`) the Den has `data-time="day"`; by night
   `data-time="night"`; with System appearance, emulating `colorScheme: 'dark'` after load switches
   it to night without a reload.
2. `power.spec.ts`: clicking `[data-ref="power"]` moves the Counter from `01` to `02`; pressing `P`
   moves it on again; `Shift+P` goes back; from `01`, `Shift+P` gives `32` (wrap-around through the
   locked slots); dragging the lever to the right by 40 px goes forward and to the left goes back.
3. `keyboard.spec.ts`: Tab from the page reaches the TV, then the POWER lever, then (after the
   console controls) the first wall cartridge; ArrowRight moves focus along the row; Enter on a
   cartridge tunes the TV (Counter shows its slot) and moves focus into `.game-card`; activating
   Details opens a `.dialog` titled with the game's name; Escape closes it.
4. `list.spec.ts`: the `L` key and the List switch open `.list-view` with 30 `.list-card`s; the
   Duels filter leaves 6; at a 800×600 viewport a fresh visit to `/` opens the list by default.
5. `intro.spec.ts` (without `skipIntro`): a fresh visit shows `.den.is-intro`; pressing a key skips
   it within 1 s (`is-intro` removed); a second visit does not show it.
6. `navigation.spec.ts`: opening Details changes the URL to `#/game/<id>`; browser Back returns to
   `#/` with no dialog open; `#/records` and `#/about` render their `h1`; an unknown hash returns to
   the Den.
7. `data.spec.ts`: in Settings, Export downloads a `.json` file (use `page.waitForEvent('download')`);
   importing that file in a fresh context (set the file input `input[data-do="import"]`) shows a
   confirmation dialog, and confirming shows the toast "Save imported".
8. `a11y.spec.ts`: AxeBuilder finds no serious or critical violations on the Den, the list, the
   details dialog, Records, About and the Settings dialog, by day and by night.
9. `network.spec.ts`: across loading the Den, cycling the power switch three times and opening the
   list, every request goes to the page's own origin.
10. `frames.spec.ts` (at 1920×1080): sample `requestAnimationFrame` intervals for 3 s in the Den;
    the median is under 16 ms on a normal machine; if `process.env.CI` is set, only warn (use
    `test.info().annotations.push`) instead of failing.

Harness specs (`hall/e2e/harness/`):

11. `play-loop.spec.ts`: from `/harness.html#/`, the game card's Play opens `.play-view` with
    `.play-back` visible; Escape there returns to the Den; Play again, then Enter starts play
    (`.play-pause` visible, `.play-back` hidden); Escape opens `.dialog--pause` whose buttons read,
    in order, Resume, Restart the match, How to play, Settings, Game menu, Back to the Hall; Resume
    closes it; waiting for the bot to win (up to 30 s) shows `.dialog--results` with buttons in the
    order Play again, Game menu, Back to the Hall; pressing `H` returns to the Den.
12. `challenge.spec.ts`: build a challenge hash in the page with the kit's encoder is not possible
    from the test, so navigate to the Den, finish one run, use "Challenge a friend" (read the copied
    link from the toast text or `navigator.clipboard` with clipboard permissions granted), open it,
    and expect `.play-challenge` to show the score to beat; a hand-edited link (change one digit of
    `beat=`) opens without `.play-challenge`.
13. `leave.spec.ts`: during play, after the first point is scored, browser Back shows a
    confirmation dialog; choosing "Keep playing" stays on the play view.

## Tests required

The specs above, one `test` per numbered behaviour (several `test`s per file are fine). Each test
asserts `collectErrors(page)` is empty at the end.

## Out of scope

Changing source, config or helpers; screenshots; anything outside the fence.
