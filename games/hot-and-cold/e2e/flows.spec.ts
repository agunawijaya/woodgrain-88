/**
 * The player's paths through Hot & Cold, by keyboard except where a flow
 * names the mouse, in the game harness. See `prompts/03-hot-and-cold.md` §9
 * and `briefs/hc-e2e.md` for the list.
 */
import { expect, test } from '@playwright/test';
import {
  checkHere,
  matchFlag,
  matchSafeSquare,
  matchSquare,
  openGame,
  openRun,
  pickKid,
  placeSeatAndScore,
  playUntilResults,
  readyPrematch,
  selectClues,
  setMatchLengthShort,
  squareScreenPoint,
  startMode,
  walkTo,
  waitForResults,
} from './harness.ts';

test('a race with two keyboard seats: both walk and check; a capture scores', async ({ page }) => {
  const errors = await openGame(page, 'speed=8');
  await startMode(page, 'Two players');
  await readyPrematch(page);

  const flag = await matchFlag(page);
  expect(flag).not.toBeNull();
  await walkTo(page, 0, flag as number);
  await checkHere(page, 0);
  await expect(page.locator('.hc-plate[data-seat="0"] .hc-score')).toHaveText('1', {
    timeout: 10_000,
  });

  // Seat 2 walks and checks too, from its own keys (WASD and Space).
  const seat2At = await matchSquare(page, 1);
  if (seat2At !== null) {
    await walkTo(page, 1, (seat2At + 10) % 63);
    await checkHere(page, 1);
  }
  expect(errors).toEqual([]);
});

test('turns against a Kid in Classic Memory: the turn passes back and forth to the results', async ({
  page,
}) => {
  const errors = await openGame(page, 'speed=8&channel=game-2');
  await pickKid(page, 'Grandpa Lou');
  await selectClues(page, 'Classic Memory');
  await setMatchLengthShort(page);
  await startMode(page, 'Vs a Kid');
  await readyPrematch(page);
  await playUntilResults(page, 0);

  await expect(
    page.getByLabel('Match results').getByText(/What Grandpa Lou remembered/),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('hunting alone to the check limit: a loss, then a win', async ({ page }) => {
  const errors = await openGame(page, 'speed=8&channel=game-5');
  await startMode(page, 'Alone');
  await readyPrematch(page);
  await page.waitForTimeout(300);

  // Fast-forwards to the 75th check with a window.__hotColdMatch() mutation (the dev-only
  // accessor the controller already exposes): making 74 real checks first would be slow, and the
  // brief allows a dev-only hook here. This one misses: the flag stays hidden and is shown.
  const safeSquare = await matchSafeSquare(page);
  await placeSeatAndScore(page, safeSquare, 74);
  await checkHere(page, 0);
  await waitForResults(page);
  let results = page.getByLabel('Match results');
  await expect(results.getByText('0 flags', { exact: true })).toBeVisible();
  await expect(results.getByText('Found in 75 checks.')).toBeVisible();

  // Play again: this time the 75th check lands on the flag itself, for a win.
  await results.getByRole('button', { name: /Play again/ }).click();
  await readyPrematch(page);
  await page.waitForTimeout(300);
  const flag = await matchFlag(page);
  expect(flag).not.toBeNull();
  await placeSeatAndScore(page, flag as number, 74);
  await checkHere(page, 0);
  await waitForResults(page);
  results = page.getByLabel('Match results');
  await expect(results.getByText('1 flag', { exact: true })).toBeVisible();

  expect(errors).toEqual([]);
});

test('the clock (channel 8): it runs out and the results come', async ({ page }) => {
  const errors = await openGame(page, 'speed=8&channel=game-8');
  await setMatchLengthShort(page);
  await startMode(page, 'Alone');
  await readyPrematch(page);
  await waitForResults(page, 60_000);
  await expect(
    page.getByLabel('Match results').getByText('Found before the clock ran out.'),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('the look switcher: all three looks, from the menu and from the pause item', async ({
  page,
}) => {
  const errors = await openGame(page, 'speed=8');
  const menu = page.getByLabel('Hot & Cold game menu');
  for (const name of ['Tabletop', 'Radar', 'Polar'] as const) {
    await menu.getByRole('radio', { name, exact: true }).click();
    await page.waitForTimeout(400);
  }

  await startMode(page, 'Vs a Kid');
  await readyPrematch(page);
  await page.keyboard.press('Escape');
  const look = page.getByText(/^Look: /);
  await expect(look).toHaveText('Look: Polar Expedition');
  // The harness's pause dialog is a static snapshot (the Hall's own re-renders live), so each
  // cycle closes and reopens it to see the pause item's new label, as Trailblaze's own look-switch
  // test does.
  for (const next of ['Look: Tabletop Board', 'Look: Radar Room', 'Look: Polar Expedition']) {
    await look.click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page.getByText(/^Look: /)).toHaveText(next);
  }
  expect(errors).toEqual([]);
});

test('daily: the fog toggle is disabled, with its reason shown', async ({ page }) => {
  const errors = await openRun(page, 'mode=daily&speed=8');
  await expect(page.locator('.hc-hud')).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Game menu' }).click();
  await page.getByLabel('Hot & Cold game menu').getByText('Settings', { exact: true }).click();

  const sheet = page.getByRole('dialog', { name: 'Hot & Cold settings' });
  const fogRow = sheet.locator('[data-field="fog"]');
  await expect(fogRow.getByRole('radio', { name: 'Off' })).toBeDisabled();
  await expect(fogRow.getByRole('radio', { name: 'On' })).toBeDisabled();
  await expect(sheet.locator('[data-note-for="fog"]')).toHaveText(
    'The fog is off for the daily: everyone hunts the same field the same way.',
  );
  expect(errors).toEqual([]);
});

test('the Kid memory panel shows after a match against a Kid', async ({ page }) => {
  const errors = await openGame(page, 'speed=8');
  await setMatchLengthShort(page);
  await startMode(page, 'Vs a Kid');
  await readyPrematch(page);
  await waitForResults(page, 90_000);

  const results = page.getByLabel('Match results');
  const summary = results.getByText(/What .+ remembered/);
  await expect(summary).toBeVisible();
  await summary.click();
  await expect(results.getByText('Play in Classic Memory to see what')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the tutorial steps through to the end and back to the menu', async ({ page }) => {
  const errors = await openGame(page);
  await page.getByLabel('Hot & Cold game menu').getByText('How to play', { exact: true }).click();
  await expect(page.getByLabel('How to play')).toBeVisible();

  // The lesson field is fixed (src/screens/tutorial.ts): a clue on B2 (square 10), an arrow on D4
  // (30), a bomb on C3 (20) and the flag on F3 (23).
  await walkTo(page, 0, 10);
  await checkHere(page, 0);
  await walkTo(page, 0, 30);
  await checkHere(page, 0);
  await walkTo(page, 0, 20);
  await checkHere(page, 0);
  await page.waitForTimeout(500); // the bomb's ride home
  await walkTo(page, 0, 23);
  await checkHere(page, 0);

  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByLabel('Hot & Cold game menu')).toBeVisible();
  expect(errors).toEqual([]);
});

test('keyboard only: menu to match to results without the mouse', async ({ page }) => {
  const errors = await openGame(page, 'speed=8&channel=game-8');
  await page.keyboard.press('Enter'); // the menu's one button: play alone, against the clock
  await expect(page.getByLabel('Before the match')).toBeVisible();
  await page.keyboard.press('Enter'); // readies the one card
  await waitForResults(page, 30_000);
  expect(errors).toEqual([]);
});

test('mouse: click a square to walk there, click again to check', async ({ page }) => {
  const errors = await openGame(page, 'speed=8');
  await startMode(page, 'Alone');
  await readyPrematch(page);
  await page.waitForTimeout(400);

  const flag = await matchFlag(page);
  expect(flag).not.toBeNull();
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('no viewport size');
  const point = squareScreenPoint(flag as number, viewport);

  await page.mouse.click(point.x, point.y);
  for (let tries = 0; tries < 30; tries++) {
    if ((await matchSquare(page, 0)) === flag) break;
    await page.waitForTimeout(200);
  }
  expect(await matchSquare(page, 0)).toBe(flag);

  await page.mouse.click(point.x, point.y);
  await expect(page.locator('.hc-plate[data-seat="0"] .hc-score')).toHaveText('1', {
    timeout: 10_000,
  });
  expect(errors).toEqual([]);
});

test('a micro-challenge starts its run directly', async ({ page }) => {
  const errors = await openRun(page, 'mode=micro&micro=find-the-flag');
  await expect(page.getByLabel('Hot & Cold game menu')).toHaveCount(0);
  await page.waitForTimeout(2000);
  expect(errors).toEqual([]);
});

test('a challenge link opens on the pre-match cards', async ({ page }) => {
  const errors = await openRun(page, 'mode=challenge&challenge=5&channel=game-2');
  await expect(page.getByLabel('Before the match')).toBeVisible({ timeout: 30_000 });
  expect(errors).toEqual([]);
});

test('with reduced motion the menu and a match run cleanly', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await openGame(page, 'speed=8');
  await startMode(page, 'Vs a Kid');
  await readyPrematch(page);
  await page.waitForTimeout(3000);
  expect(errors).toEqual([]);
});

test('the Kid setting: Sharp Kids forget nothing and mix nothing up', async ({ page }) => {
  for (const kids of ['human', 'sharp'] as const) {
    const errors = await openGame(page, `speed=8&channel=game-2&kids=${kids}`);
    await pickKid(page, 'Grandpa Lou');
    await selectClues(page, 'Classic Memory');
    await setMatchLengthShort(page);
    await startMode(page, 'Vs a Kid');
    await readyPrematch(page);
    await playUntilResults(page, 0);

    const results = page.getByLabel('Match results');
    const summary = results.getByText(/What Grandpa Lou remembered/);
    await expect(summary).toBeVisible();
    await summary.click();
    if (kids === 'sharp') {
      await expect(results.getByText('Forgot 0', { exact: true })).toBeVisible();
      await expect(results.getByText('Mixed up 0', { exact: true })).toBeVisible();
    }
    expect(errors).toEqual([]);
  }
});
