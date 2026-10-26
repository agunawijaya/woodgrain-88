/**
 * End-to-end tests for unsaved play protection on browser Back navigation.
 */
import { expect, test } from '@playwright/test';
import { collectErrors, skipIntro } from '../helpers.ts';

test.describe('Leave game confirmation', () => {
  test('confirms before leaving when points have been scored, and preserves play view on Keep playing', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.goto('/harness.html#/');

    // Enter play session
    await page.locator('.game-card button[data-action="play"]').click();
    await expect(page.locator('.play-view')).toBeVisible();

    // Start active match
    await page.keyboard.press('Enter');
    await expect(page.locator('.play-pause')).toBeVisible();

    // Wait until the first point is scored (manifested by the first-point patch toast and progress store)
    await expect(page.locator('.toast')).toContainText('On the Board', { timeout: 20_000 });

    // Attempt navigating back via browser history
    await page.goBack();

    // Confirmation dialog must appear because match progress would be lost
    const confirmDialog = page.locator('.dialog--confirm');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.locator('.dialog-title')).toHaveText('Leave this game?');

    // Choosing "Keep playing" cancels leaving and keeps the game session active
    await confirmDialog.locator('button[data-answer="no"]').click();
    await expect(confirmDialog).not.toBeVisible();
    await expect(page.locator('.play-view')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
