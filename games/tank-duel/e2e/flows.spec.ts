/**
 * Tank Duel's paths, end to end in the harness: the menu by keyboard, two
 * keyboard seats, a Kid on a tank, a biplane and a jet channel, pause and
 * resume, the results and their keys, the tutorial, and the runs the Hall
 * starts directly (micro-challenge, daily, challenge link). `speed` fast-
 * forwards the simulation so a whole match fits in a test.
 */
import { expect, test } from '@playwright/test';
import { expectView, harnessLog, openGame, startKidMatch } from './harness.ts';

test('the game menu works by keyboard alone, and Versus seats two keyboard players', async ({
  page,
}) => {
  const errors = await openGame(page, 'channel=game-3');
  await expect(page.locator('.td-band')).toHaveText('CH 03 · Straight · Old Quarter');
  await expect(page.locator('[data-mode="kid"]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-mode="versus"]')).toBeFocused();
  await page.keyboard.press('Enter');

  const cards = page.locator('.td-prematch-card');
  await expect(cards).toHaveCount(2);
  await page.keyboard.press('Space');
  await page.keyboard.press('Enter');
  await expectView(page, 'play');
  await expect(page.locator('.td-hud')).toBeVisible();
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ArrowUp');
  expect(errors).toEqual([]);
});

for (const channel of ['game-6', 'game-15', 'game-21']) {
  test(`a Kid plays ${channel} without a fault`, async ({ page }) => {
    const errors = await openGame(page, `channel=${channel}&kid=rosa`);
    await startKidMatch(page);
    await page.keyboard.press('Space');
    await page.waitForTimeout(3000);
    await expectView(page, 'play');
    expect(errors).toEqual([]);
  });
}

test('Escape pauses with the standard menu, and Resume carries on', async ({ page }) => {
  await openGame(page, 'kid=moss');
  await startKidMatch(page);
  await page.keyboard.press('Escape');
  const dialog = page.locator('.fake-chrome-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button')).toHaveText([
    'Resume',
    'Change channel',
    'How to play',
    'Settings',
    'Game menu',
    'Back to the Hall',
  ]);
  await dialog.getByRole('button', { name: 'Resume' }).click();
  await expect(dialog).toBeHidden();
  await expectView(page, 'play');
});

test('a finished match reports once and shows the results with their keys', async ({ page }) => {
  const errors = await openGame(page, 'kid=pip&speed=16');
  await startKidMatch(page);
  const results = page.locator('.td-results');
  await expect(results).toBeVisible({ timeout: 45_000 });
  await expect(results.getByRole('button')).toHaveText([
    /Play again/,
    /Game menu/,
    /Back to the Hall/,
  ]);
  const log = await harnessLog(page);
  expect(log.results).toHaveLength(1);
  expect(log.results[0]?.presentation).toBe('game');
  // At most one ending event: a win or a loss, or nothing for a draw.
  const endings = log.events.filter(
    (event) => event.type === 'match-won' || event.type === 'match-lost',
  );
  expect(endings.length).toBeLessThanOrEqual(1);

  await page.keyboard.press('KeyR');
  await expect(page.locator('.td-prematch')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the tutorial walks through six steps and returns to the menu', async ({ page }) => {
  await openGame(page);
  await page.locator('[data-link="how"]').click();
  const lesson = page.locator('.td-lesson');
  await expect(lesson.locator('h2')).toHaveText('Drive');
  for (let step = 0; step < 6; step++)
    await lesson.getByRole('button', { name: 'Skip this step' }).click();
  await expect(page.locator('.td-menu')).toBeVisible();
});

test('a micro-challenge starts at once, ends on its own and reports', async ({ page }) => {
  await openGame(page, 'mode=micro&micro=hit-three&speed=16');
  await expectView(page, 'play');
  await expect(page.locator('.td-menu')).toHaveCount(0);
  await expect
    .poll(async () => (await harnessLog(page)).results.length, { timeout: 30_000 })
    .toBe(1);
  await expect(page.locator('.td-results')).toHaveCount(0);
});

test('a daily run skips the menu and ends with the share line', async ({ page }) => {
  await openGame(page, 'mode=daily&daily=3&channel=game-7&speed=16');
  await expect(page.locator('.td-prematch')).toBeVisible();
  await expect(page.locator('.td-menu')).toHaveCount(0);
  await page.keyboard.press('Space');
  const share = page.locator('.td-results-share');
  await expect(share).toBeVisible({ timeout: 45_000 });
  await expect(share).toContainText("Woodgrain '88 #");
  await expect(share).toContainText('Tank Duel ch.7');
});

test('a challenge link shows the score to beat before the match', async ({ page }) => {
  await openGame(page, 'mode=challenge&challenge=9&channel=game-9');
  await expect(page.locator('.td-prematch')).toContainText('beat 9');
});

test('reduced motion plays without the stamp animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = await openGame(page, 'reduced=1&kid=lou');
  await page.keyboard.press('Enter');
  const stamp = page.locator('.td-prematch-card[data-side="1"] .td-ready-stamp');
  await expect(stamp).toBeVisible({ timeout: 5000 });
  expect(await stamp.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  expect(errors).toEqual([]);
});
