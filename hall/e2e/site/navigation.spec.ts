/**
 * End-to-end tests for hash routing, history, and page rendering.
 */
import { expect, test } from '@playwright/test';
import { collectErrors, skipIntro } from '../helpers.ts';

test.describe('Navigation and routing', () => {
  test('updates URL on opening Details and closes dialog on browser Back', async ({ page }) => {
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.goto('/');

    await page.locator('.game-card button[data-action="details"]').click();
    await expect(page).toHaveURL(/#\/details\/[a-z0-9-]+/);
    await expect(page.locator('.dialog')).toBeVisible();

    await page.goBack();
    // Back lands on the Den, which is "/" or "#/" depending on how it was opened.
    await expect(page).toHaveURL(/\/(#\/)?$/);
    await expect(page.locator('.dialog')).not.toBeVisible();

    expect(errors).toEqual([]);
  });

  test('renders h1 on Records and About pages', async ({ page }) => {
    const errors = collectErrors(page);
    await skipIntro(page);

    await page.goto('#/records');
    await expect(page.locator('.page--records h1')).toHaveText('Records');

    await page.goto('#/about');
    await expect(page.locator('.page--about h1')).toHaveText("About Woodgrain '88");

    expect(errors).toEqual([]);
  });

  test('redirects an unknown hash route back to the Den', async ({ page }) => {
    const errors = collectErrors(page);
    await skipIntro(page);

    await page.goto('#/lost-in-time');
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.locator('.den')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
