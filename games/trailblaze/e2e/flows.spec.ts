/**
 * The player's paths through Trailblaze, by keyboard, in the game harness.
 * Matches run at the harness's `speed=` multiple so a whole match to 10 fits
 * in a test.
 */
import { expect, test } from '@playwright/test';
import { openGame, rideFromMenu, waitForResults } from './harness.ts';

test('the game menu shows the channel dial, the modes and the Kids', async ({ page }) => {
  const errors = await openGame(page);
  const menu = page.getByLabel('Trailblaze game menu');
  await expect(menu.getByText('VS A KID')).toBeVisible();
  await expect(menu.getByText('VERSUS')).toBeVisible();
  await expect(menu.getByText('Computer 1977').first()).toBeVisible();
  await expect(menu.getByText('Grandpa Lou').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('a match against a Kid runs to the results, in the collection order', async ({ page }) => {
  const errors = await openGame(page, 'speed=8');
  await rideFromMenu(page);
  await waitForResults(page);
  const results = page.getByLabel('Match results');
  await expect(results.getByText('Rosa wins').first()).toBeVisible();
  const buttons = (await results.getByRole('button').allInnerTexts()).map((text) =>
    text.toLowerCase(),
  );
  const order = ['play again', 'game menu', 'back to the hall'].map((label) =>
    buttons.findIndex((text) => text.includes(label)),
  );
  expect(order.every((index) => index >= 0)).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  await expect(results.getByText(/How Rosa (saw|rode) it/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('Computer 1977 rides the left on its channel', async ({ page }) => {
  await openGame(page, 'channel=game-2');
  await page.keyboard.press('Enter');
  const lineup = page.getByLabel('Pre-match lineup');
  await expect(lineup.getByText('Computer 1977')).toBeVisible();
});

test('the pace climbs on a speed-up channel', async ({ page }) => {
  // Riding alone (the top-speed micro-challenge), a rider that never turns lasts past the first
  // speed-up at 5.12 s; against a Kid it would crash first and the round would start again slow.
  await page.goto('/game.html?seed=7&mode=micro&micro=top-speed-30&speed=4');
  await expect(page.getByLabel(/Speed [2-5] of 5/)).toBeAttached({ timeout: 30_000 });
});

test('the pause menu switches the look mid-match', async ({ page }) => {
  const errors = await openGame(page);
  await rideFromMenu(page);
  await page.keyboard.press('Escape');
  const look = page.getByText(/^Look: /);
  await expect(look).toHaveText('Look: Neon Grid');
  await look.click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByText(/^Look: /)).toHaveText('Look: Toy Trains');
  expect(errors).toEqual([]);
});

test('a Doodle is kept as a picture with X', async ({ page }) => {
  await openGame(page, 'channel=game-13');
  await rideFromMenu(page);
  for (const key of ['ArrowUp', 'ArrowLeft', 'ArrowDown']) {
    await page.keyboard.down(key);
    await page.waitForTimeout(700);
    await page.keyboard.up(key);
  }
  const download = page.waitForEvent('download');
  await page.keyboard.press('KeyX');
  expect((await download).suggestedFilename()).toMatch(/^trailblaze-doodle-.*\.svg$/);
  await page.keyboard.press('Escape');
  await page.getByText('Game menu').click();
  await page.getByText('Doodle gallery').click();
  await expect(page.getByText(/Download/i).first()).toBeVisible();
});

test('How to play steps through six cards back to the menu', async ({ page }) => {
  await openGame(page);
  await page.getByText('How to play').first().click();
  // Past the sixth card the tutorial is done and the menu comes back.
  for (let card = 0; card < 6; card++) await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Trailblaze game menu')).toBeVisible();
});

test('a micro-challenge starts its run straight away', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/game.html?seed=7&mode=micro&micro=top-speed-30');
  await expect(page.getByLabel('Trailblaze game menu')).toHaveCount(0);
  await page.waitForTimeout(2000);
  expect(errors).toEqual([]);
});

test('a challenge link opens on the pre-match cards', async ({ page }) => {
  await page.goto('/game.html?seed=42&mode=challenge&challenge=5&channel=game-8');
  await expect(page.getByLabel('Pre-match lineup')).toBeVisible({ timeout: 30_000 });
});

test('with reduced motion the menu and a match run cleanly', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await openGame(page);
  await rideFromMenu(page);
  await page.waitForTimeout(3000);
  expect(errors).toEqual([]);
});
