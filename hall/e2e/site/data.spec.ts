/**
 * End-to-end tests for save data export and import.
 */
import { expect, test } from '@playwright/test';
import { collectErrors, skipIntro } from '../helpers.ts';

test.describe('Settings save data transfer', () => {
  test('exports JSON save file and imports it in a fresh context', async ({ page }) => {
    // Two browsers in one test, so give it room; both work from the About
    // page, where no picture tube competes with the other workers for the CPU.
    test.slow();
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.goto('/#/about');

    await page.locator('.topbar button[data-action="settings"]').click();
    await expect(page.locator('.dialog--settings')).toBeVisible();
    // A setting the fresh browser would not pick by itself, to prove the round trip.
    await page.getByRole('radio', { name: 'Night' }).check();

    const downloadPromise = page.waitForEvent('download');
    await page.locator('button[data-do="export"]').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.json$/);

    const browser = page.context().browser();
    if (!browser) {
      throw new Error('Browser instance was not available');
    }
    const freshContext = await browser.newContext();
    const freshPage = await freshContext.newPage();
    const freshErrors = collectErrors(freshPage);

    await skipIntro(freshPage);
    await freshPage.goto('/#/about');

    await freshPage.locator('.topbar button[data-action="settings"]').click();
    await expect(freshPage.locator('.dialog--settings')).toBeVisible();

    await freshPage.locator('input[data-do="import"]').setInputFiles(await download.path());

    const confirmDialog = freshPage.locator('.dialog--confirm');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.locator('.dialog-title')).toHaveText('Import this save?');

    await confirmDialog.locator('button[data-answer="yes"]').click();
    await expect(confirmDialog).toBeHidden();

    // The toast is gone in a few seconds; the imported Night setting is not.
    await freshPage.reload();
    await expect(freshPage.locator('html')).toHaveAttribute('data-appearance', 'dark');

    expect(freshErrors).toEqual([]);
    await freshContext.close();

    expect(errors).toEqual([]);
  });
});
