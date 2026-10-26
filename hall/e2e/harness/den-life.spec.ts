/**
 * End-to-end tests for Den Life features in the dev harness: jacket customization,
 * calendar, difficulty switches, channel dial remote input, growth and settings,
 * and navigation.
 */
import { expect, test } from '@playwright/test';
import { collectErrors, skipIntro } from '../helpers.ts';

test.describe('Den Life', () => {
  test('jacket manipulation by keyboard', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/harness.html?showcase=mid#/jacket');
    await expect(page.locator('.jacket-screen')).toBeVisible();

    const key = await page.locator('.sewn-patch').first().getAttribute('data-key');
    const patch = page.locator(`.sewn-patch[data-key="${key ?? ''}"]`);
    await patch.focus();
    const initialTransform = await patch.getAttribute('transform');
    expect(initialTransform).toBeTruthy();

    await page.keyboard.press('Enter');
    await expect(page.locator('.jacket-held-ring')).toBeVisible();

    await page.keyboard.press('ArrowRight');
    const transformAfterArrow = await patch.getAttribute('transform');
    expect(transformAfterArrow).not.toBe(initialTransform);

    await page.keyboard.press('r');
    const transformAfterR = await patch.getAttribute('transform');
    expect(transformAfterR).not.toBe(transformAfterArrow);

    await page.keyboard.press('Enter');
    await expect(page.locator('.jacket-held-ring')).toBeHidden();

    // Two steps back: the turn, then the move.
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await expect(patch).toHaveAttribute('transform', initialTransform ?? '');

    expect(errors).toEqual([]);
  });

  test('jacket manipulation by mouse', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/harness.html?showcase=mid#/jacket');
    await expect(page.locator('.jacket-screen')).toBeVisible();

    const patches = page.locator('.sewn-patch');
    const initialCount = await patches.count();
    expect(initialCount).toBeGreaterThan(0);

    const firstPatch = patches.first();
    const patchKey = await firstPatch.getAttribute('data-key');
    expect(patchKey).toBeTruthy();
    // Where it was sewn: free again once it is off, so the drop there sews rather than swaps.
    const spotBox = await firstPatch.boundingBox();

    await firstPatch.click();
    const dialog = page.locator('.dialog--patch');
    await expect(dialog).toBeVisible();

    await dialog.locator('button', { hasText: 'Take it off' }).click();
    await expect(dialog).toBeHidden();
    await expect(patches).toHaveCount(initialCount - 1);

    const drawerTile = page.locator(`.patch-tile[data-key="${patchKey}"]`);
    await expect(drawerTile).toBeVisible();
    // The drawer scrolls; the drag has to start on the tile itself.
    await drawerTile.scrollIntoViewIfNeeded();

    const tileBox = await drawerTile.boundingBox();
    expect(tileBox).not.toBeNull();
    expect(spotBox).not.toBeNull();

    const startX = (tileBox?.x ?? 0) + (tileBox?.width ?? 0) / 2;
    const startY = (tileBox?.y ?? 0) + (tileBox?.height ?? 0) / 2;
    const targetX = (spotBox?.x ?? 0) + (spotBox?.width ?? 0) / 2;
    const targetY = (spotBox?.y ?? 0) + (spotBox?.height ?? 0) / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(targetX, targetY, { steps: 5 });
    await page.mouse.up();

    await expect(patches).toHaveCount(initialCount);
    expect(errors).toEqual([]);
  });

  test('jacket export card downloads svg', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/harness.html?showcase=mid#/jacket');
    await expect(page.locator('.jacket-screen')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-do="export"]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.svg$/);

    expect(errors).toEqual([]);
  });

  test('calendar month view opens and flips months', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/harness.html?showcase=full#/');
    await expect(page.locator('.den')).toBeVisible();

    await page.locator('[data-ref="calendar"]').click();
    const dialog = page.locator('.dialog--calendar');
    await expect(dialog).toBeVisible();

    const days = dialog.locator('.cal-grid li');
    expect(await days.count()).toBeGreaterThanOrEqual(28);

    const initialMonth = await dialog.locator('.cal-month').innerText();
    await page.keyboard.press('PageUp');
    const updatedMonth = await dialog.locator('.cal-month').innerText();
    expect(updatedMonth).not.toBe(initialMonth);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('difficulty switches persist and reach active game session', async ({ page }) => {
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.goto('/harness.html#/');
    await expect(page.locator('.den')).toBeVisible();

    await page.keyboard.press(']');
    await expect(page.locator('[data-ref="switch-right"]')).toHaveAttribute(
      'aria-label',
      /A, hard/,
    );

    await page.reload();
    await expect(page.locator('.den')).toBeVisible();
    await expect(page.locator('[data-ref="switch-right"]')).toHaveAttribute(
      'aria-label',
      /A, hard/,
    );

    await page.goto('/harness.html#/play/test-paddles');
    await expect(page.locator('.play-view')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('.play-pause')).toBeVisible();

    await page.keyboard.press('Escape');
    const pauseDialog = page.locator('.dialog--pause');
    await expect(pauseDialog).toBeVisible();
    await expect(pauseDialog.locator('[data-switch="right"] strong')).toHaveText('A');

    expect(errors).toEqual([]);
  });

  test('channel dial tunes by number pad', async ({ page }) => {
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.goto('/harness.html#/play/test-catch-1');
    await expect(page.locator('.play-view')).toBeVisible();

    await page.locator('.play-channel').click();
    const dialDialog = page.locator('.dialog--dial');
    await expect(dialDialog).toBeVisible();

    await page.keyboard.press('1');
    await page.keyboard.press('2');

    const chip12 = dialDialog
      .locator('[data-pick]')
      .filter({ has: page.locator('.dial-chip-number', { hasText: /^12$/ }) });
    const channel12Id = await chip12.getAttribute('data-pick');
    expect(channel12Id).toBeTruthy();

    await page.keyboard.press('Enter');
    await expect(dialDialog).toBeHidden();

    await expect(page).toHaveURL(new RegExp(`ch=${channel12Id}`));
    await expect(page.locator('.play-channel')).toHaveText(/^CH 12/);

    expect(errors).toEqual([]);
  });

  test('growth displays items and clears on forget data', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/harness.html?showcase=full#/');
    await expect(page.locator('.den')).toBeVisible();

    await expect(page.locator('.growth-poster')).toHaveCount(4);

    await page.locator('.topbar button[data-action="settings"]').click();
    const settingsDialog = page.locator('.dialog--settings');
    await expect(settingsDialog).toBeVisible();

    await settingsDialog.locator('button[data-do="forget"]').click();
    const confirmDialog = page.locator('.dialog--confirm');
    await expect(confirmDialog).toBeVisible();

    await confirmDialog.locator('button[data-answer="yes"]').click();
    await expect(confirmDialog).toBeHidden();

    await settingsDialog.locator('button[data-do="close"]').click();
    await expect(settingsDialog).toBeHidden();

    await expect(page.locator('.growth-poster')).toHaveCount(0);
    await expect(page.locator('.growth-trophy')).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('navigation between Den and life screens', async ({ page }) => {
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.goto('/harness.html#/');
    await expect(page.locator('.den')).toBeVisible();

    // Corkboard -> Kids -> Back
    await page.locator('[data-ref="corkboard"]').click();
    await expect(page).toHaveURL(/#\/kids/);
    await expect(page.locator('.kids-screen')).toBeVisible();
    await page.locator('button[data-do="back"]').click();
    await expect(page).toHaveURL(/#\//);
    await expect(page.locator('.den')).toBeVisible();

    // Jacket -> Back
    await page.locator('[data-ref="jacket"]').click();
    await expect(page).toHaveURL(/#\/jacket/);
    await expect(page.locator('.jacket-screen')).toBeVisible();
    await page.locator('button[data-do="back"]').click();
    await expect(page).toHaveURL(/#\//);
    await expect(page.locator('.den')).toBeVisible();

    // Chalkboard -> Versus -> Back
    await page.locator('[data-ref="chalkboard"]').click();
    await expect(page).toHaveURL(/#\/versus/);
    await expect(page.locator('.versus-screen')).toBeVisible();
    await page.locator('button[data-do="back"]').click();
    await expect(page).toHaveURL(/#\//);
    await expect(page.locator('.den')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
