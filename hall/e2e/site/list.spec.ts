/**
 * End-to-end tests for the Label Wall list view and filtering.
 */
import { expect, test } from '@playwright/test';
import { collectErrors, skipIntro } from '../helpers.ts';

test.describe('Label Wall list view', () => {
  test('opens via L key and List switch with 30 cards, and filters by Duels to 6', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.goto('/');

    // Pressing L opens the list view with all 30 games
    await page.keyboard.press('l');
    await expect(page.locator('.list-view')).toBeVisible();
    await expect(page.locator('.list-card')).toHaveCount(30);

    // Return to the Den and verify opening via the topbar List switch
    await page.locator('.topbar-switch button[data-action="den"]').click();
    await expect(page.locator('.den')).toBeVisible();

    await page.locator('.topbar-switch button[data-action="list"]').click();
    await expect(page.locator('.list-view')).toBeVisible();
    await expect(page.locator('.list-card')).toHaveCount(30);

    // The Duels filter chip narrows the list to 6 cards
    await page.locator('.filter-chip[data-group="family"][data-value="duels"]').click();
    await expect(page.locator('.list-card')).toHaveCount(6);

    expect(errors).toEqual([]);
  });

  test('opens list by default on a fresh visit at an 800x600 viewport', async ({ page }) => {
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/');

    await expect(page.locator('.list-view')).toBeVisible();
    await expect(page.locator('.list-card')).toHaveCount(30);

    expect(errors).toEqual([]);
  });
});
