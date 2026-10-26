/**
 * End-to-end tests for the complete game play loop in the harness.
 */
import { expect, test } from '@playwright/test';
import { collectErrors, skipIntro } from '../helpers.ts';

test.describe('Game play loop', () => {
  test('drives through play, pause menu, results dialog, and keyboard exits', async ({ page }) => {
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.goto('/harness.html#/');

    // From the Den, clicking Play opens the game view on the menu screen
    await page.locator('.game-card button[data-action="play"]').click();
    await expect(page.locator('.play-view')).toBeVisible();
    await expect(page.locator('.play-back')).toBeVisible();

    // Escape on the game menu returns to the Den
    await page.keyboard.press('Escape');
    await expect(page.locator('.den')).toBeVisible();

    // Opening Play again and pressing Enter starts gameplay
    await page.locator('.game-card button[data-action="play"]').click();
    await expect(page.locator('.play-view')).toBeVisible();
    await page.keyboard.press('Enter');

    // During active play, the pause button is visible and back button is hidden
    await expect(page.locator('.play-pause')).toBeVisible();
    await expect(page.locator('.play-back')).toBeHidden();

    // Escape during play opens the pause menu
    await page.keyboard.press('Escape');
    const pauseDialog = page.locator('.dialog--pause');
    await expect(pauseDialog).toBeVisible();

    // Buttons must appear in the specified order
    const buttonTexts = await pauseDialog.locator('.menu-list button').allInnerTexts();
    expect(buttonTexts.map((text) => text.trim())).toEqual([
      'Resume',
      'Restart the match',
      'How to play',
      'Settings',
      'Game menu',
      'Back to the Hall',
    ]);

    // Resuming closes the pause dialog and continues play
    await pauseDialog.locator('button[data-item="resume"]').click();
    await expect(pauseDialog).not.toBeVisible();

    // Await the match conclusion (bot scores 3 points within 30 s)
    const resultsDialog = page.locator('.dialog--results');
    await expect(resultsDialog).toBeVisible({ timeout: 30_000 });

    // Results buttons appear in specified order
    const resultButtons = resultsDialog.locator('.menu-list--row button');
    await expect(resultButtons).toHaveCount(3);
    await expect(resultButtons.nth(0)).toHaveAttribute('data-result', 'again');
    await expect(resultButtons.nth(0)).toContainText('Play again');
    await expect(resultButtons.nth(1)).toHaveAttribute('data-result', 'menu');
    await expect(resultButtons.nth(1)).toContainText('Game menu');
    await expect(resultButtons.nth(2)).toHaveAttribute('data-result', 'hall');
    await expect(resultButtons.nth(2)).toContainText('Back to the Hall');

    // Pressing H on the results dialog returns to the Den
    await page.keyboard.press('h');
    await expect(page.locator('.den')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
