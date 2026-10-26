/**
 * End-to-end tests verifying no external network requests are made.
 */
import { expect, test } from '@playwright/test';
import { collectErrors, counterText, skipIntro } from '../helpers.ts';

test.describe('Network isolation', () => {
  test('restricts all network traffic strictly to the page origin', async ({ page }) => {
    const errors = collectErrors(page);
    const requestedUrls: string[] = [];

    page.on('request', (request) => {
      requestedUrls.push(request.url());
    });

    await skipIntro(page);
    await page.goto('/');
    await expect(page.locator('.den')).toBeVisible();

    // Cycle the power switch three times
    await page.locator('[data-ref="power"]').click();
    await expect.poll(() => counterText(page), { timeout: 10_000 }).toBe('02');

    await page.locator('[data-ref="power"]').click();
    await expect.poll(() => counterText(page), { timeout: 10_000 }).toBe('03');

    await page.locator('[data-ref="power"]').click();
    await expect.poll(() => counterText(page), { timeout: 10_000 }).toBe('04');

    // Open the list view
    await page.locator('.topbar-switch button[data-action="list"]').click();
    await expect(page.locator('.list-view')).toBeVisible();

    // Verify all captured requests belong exclusively to the page's origin
    expect(requestedUrls.length).toBeGreaterThan(0);
    const origin = new URL(page.url()).origin;
    for (const url of requestedUrls) {
      expect(new URL(url).origin).toBe(origin);
    }

    expect(errors).toEqual([]);
  });
});
