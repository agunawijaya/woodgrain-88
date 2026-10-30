/**
 * The player's paths through Gravity Duel, by keyboard, in the game harness,
 * plus the engine hooks on the wireframe bench for behaviour that would
 * otherwise take real flying skill to bring about (a star swallow, a Hot
 * Landing, a cloak fuel-out, mutual reload).
 */
import { expect, test } from '@playwright/test';
import {
  AMMO_SEGMENTS,
  CENTRE_X,
  CENTRE_Y,
  FINE_PER_UNIT,
  FUEL_SEGMENTS,
  TOP_SPEED_UNITS,
} from '../src/engine/types.ts';
import {
  openBench,
  openGame,
  openRun,
  readyUp,
  resultsActionOrder,
  startSolo,
  startVersus,
  startVsKid,
  waitForResults,
} from './harness.ts';

const TOP_SPEED_FINE = TOP_SPEED_UNITS * FINE_PER_UNIT;

test('the game menu shows the channel dial, the modes and the Kids', async ({ page }) => {
  const errors = await openGame(page);
  const menu = page.getByLabel('Gravity Duel game menu');
  await expect(menu.getByText('VS A KID')).toBeVisible();
  await expect(menu.getByText('VERSUS')).toBeVisible();
  await expect(menu.getByText('Grandpa Lou').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('a duel between two keyboard seats ends at results, in the standard order', async ({
  page,
}) => {
  // Channel 4 (The Star) with nobody touching the stick: gravity alone drags
  // both corners into the star and trades the point to whoever is left,
  // deterministically, without depending on either seat's aim. Short length
  // and a fast-forwarded loop keep the match inside the test's timeout.
  const errors = await openGame(page, 'speed=20&channel=game-4');
  const menu = page.getByLabel('Gravity Duel game menu');
  await menu.locator('[data-match-length="5"]').click();
  await startVersus(page);
  await readyUp(page);

  await waitForResults(page);
  const order = await resultsActionOrder(page);
  // "Share" trails the three standard buttons in a versus match; the three
  // standard ones must still sit in the brief's order, whatever else joins them.
  const standard = ['play-again', 'game-menu', 'back-to-hall'].map((action) =>
    order.indexOf(action),
  );
  expect(standard.every((index) => index >= 0)).toBe(true);
  expect([...standard].sort((a, b) => a - b)).toEqual(standard);
  expect(errors).toEqual([]);
});

test('a duel against a Kid ends at results with "How it flew it"', async ({ page }) => {
  // No match-length click here: that would move focus off the menu's
  // auto-focused start button, and Enter would no longer start the match.
  const errors = await openGame(page, 'speed=20&channel=game-4');
  await startVsKid(page);
  await readyUp(page);

  await waitForResults(page);
  await expect(page.locator('.gd-results').getByText(/How .+ flew it/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('a docking race starts and plays without erroring', async ({ page }) => {
  const errors = await openGame(page, 'speed=4&channel=game-8');
  await startVsKid(page);
  await readyUp(page);
  await page.waitForTimeout(3000);
  expect(errors).toEqual([]);
});

test('solo docking shows one pre-match card and plays', async ({ page }) => {
  const errors = await openGame(page, 'speed=4&channel=game-14');
  await startSolo(page);
  const prematch = page.locator('.gd-prematch');
  await expect(prematch.locator('.gd-seat-card')).toHaveCount(1);
  await readyUp(page);
  await page.waitForTimeout(3000);
  expect(errors).toEqual([]);
});

test('both control schemes can be picked from the menu', async ({ page }) => {
  const errors = await openGame(page);
  const menu = page.getByLabel('Gravity Duel game menu');
  await menu.locator('[data-scheme="modern"]').click();
  await expect(menu.locator('[data-scheme="modern"]')).toHaveAttribute('aria-checked', 'true');
  await menu.locator('[data-scheme="classic"]').click();
  await expect(menu.locator('[data-scheme="classic"]')).toHaveAttribute('aria-checked', 'true');
  expect(errors).toEqual([]);
});

test('the trajectory guide is forced off in Daily, with its reason shown', async ({ page }) => {
  const errors = await openRun(page, 'mode=daily');
  await readyUp(page);
  // Pause (Esc) to reach the Hall's own "Game menu", where the real settings
  // sheet lives; the run stays Daily throughout, so the guide stays forced.
  await page.keyboard.press('Escape');
  await page.getByText('Game menu', { exact: true }).click();
  await page.getByLabel('Gravity Duel game menu').getByText('Settings').click();
  await expect(
    page.getByText('Daily, challenge and record runs are flown without the guide.'),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('all four looks load and idle on the menu', async ({ page }) => {
  for (const look of ['deep', 'brass', 'paper', 'whirl']) {
    const errors = await openGame(page, `look=${look}`);
    await page.waitForTimeout(500);
    expect(errors, `look "${look}"`).toEqual([]);
  }
});

test('a micro-challenge starts its run straight away and reports its result', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // Its 45 seconds pass in a little over two at twenty times speed.
  await page.goto('/game.html?seed=7&mode=micro&micro=star-point&speed=20');
  await expect(page.getByLabel('Gravity Duel game menu')).toHaveCount(0);
  await readyUp(page);
  await expect
    .poll(() => page.evaluate(() => window.__gravityDuelHarness?.log.results.length ?? 0), {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('a challenge link opens the same channel and the Hall-seated Kid', async ({ page }) => {
  const errors = await openRun(page, 'mode=challenge&challenge=4&channel=game-8&kid=moss');
  await readyUp(page);
  const run = await page.evaluate(() => window.__gravityDuelHarness?.fake.context.run);
  expect(run?.channel).toBe('game-8');
  expect(run?.mode).toBe('challenge');
  expect(errors).toEqual([]);
});

test('with reduced motion the menu and a match run cleanly', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await openGame(page, 'speed=4&channel=game-2');
  await startVsKid(page);
  await readyUp(page);
  await page.waitForTimeout(3000);
  expect(errors).toEqual([]);
});

// ——— Engine behaviour, poked directly on the wireframe bench ———

test('a missile is swallowed crossing the star (variation 4)', async ({ page }) => {
  const errors = await openBench(page, 'variation=4&left=idle&right=idle');
  await page.evaluate(
    ({ x, y }) => {
      const shot = window.__gravityDuel?.match?.shots[0];
      if (!shot) throw new Error('bench has no shot 0 yet');
      Object.assign(shot, { x, y, vx: 0, vy: 0, live: true, age: 20, life: 50, turned: 0 });
    },
    { x: CENTRE_X, y: CENTRE_Y },
  );
  await page.waitForTimeout(200);
  const live = await page.evaluate(() => window.__gravityDuel?.match?.shots[0]?.live);
  expect(live).toBe(false);
  expect(errors).toEqual([]);
});

test('a Hot Landing: the starbase refuels a ship at top speed and it lives (variation 6)', async ({
  page,
}) => {
  const errors = await openBench(page, 'variation=6&left=idle&right=idle');
  await page.evaluate(
    ({ x, y, vx }) => {
      const ship = window.__gravityDuel?.match?.ships[0];
      if (!ship) throw new Error('bench has no ship 0 yet');
      Object.assign(ship, { x, y, vx, vy: 0, fuel: 0, ammo: 0, spin: 0 });
    },
    { x: CENTRE_X, y: CENTRE_Y, vx: TOP_SPEED_FINE },
  );
  await page.waitForTimeout(200);
  const ship = await page.evaluate(() => window.__gravityDuel?.match?.ships[0]);
  expect(ship?.fuel).toBe(FUEL_SEGMENTS);
  expect(ship?.ammo).toBe(AMMO_SEGMENTS);
  expect(ship?.spin).toBe(0); // the dead speed check the cartridge could never fire
  expect(errors).toEqual([]);
});

test('a cloak with the last fuel segment burns out and the rival scores (variation 2)', async ({
  page,
}) => {
  const errors = await openBench(page, 'variation=2&left=person&right=idle');
  await page.evaluate(() => {
    const ship = window.__gravityDuel?.match?.ships[0];
    if (!ship) throw new Error('bench has no ship 0 yet');
    ship.fuel = 1;
  });
  // The lone player keeps the arrows; Down, pulled alone, toggles the cloak.
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(150);
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(100);
  const match = await page.evaluate(() => window.__gravityDuel?.match);
  expect(match?.ships[0].fuel).toBe(0);
  expect(match?.ships[0].cloaked).toBe(false); // burnout uncloaks on its way out
  expect(match?.ships[1].score).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('mutual reload fills both tanks once both run dry (variation 1)', async ({ page }) => {
  const errors = await openBench(page, 'variation=1&left=idle&right=idle');
  await page.evaluate(() => {
    const match = window.__gravityDuel?.match;
    if (!match) throw new Error('bench has no match yet');
    match.ships[0].ammo = 0;
    match.ships[1].ammo = 0;
    match.shots[0].life = 1; // one tick from empty: the last-missile check fires here
  });
  await page.waitForTimeout(150);
  const match = await page.evaluate(() => window.__gravityDuel?.match);
  expect(match?.ships[0].ammo).toBe(AMMO_SEGMENTS);
  expect(match?.ships[1].ammo).toBe(AMMO_SEGMENTS);
  expect(errors).toEqual([]);
});
