/**
 * End-to-end tests for the first-visit Den intro sequence and skip behavior.
 */
import { expect, test } from '@playwright/test';
import { collectErrors } from '../helpers.ts';

test.describe('Den intro sequence', () => {
  test('plays on a fresh visit, skips on keypress within 1 s, and does not replay on next visit', async ({
    page,
  }) => {
    const errors = collectErrors(page);

    // Fresh visit without skipIntro shows the intro state
    await page.goto('/');
    await expect(page.locator('.den')).toHaveClass(/\bis-intro\b/);

    // Pressing any key skips the intro within 1 second
    await page.keyboard.press('Space');
    await expect(page.locator('.den')).not.toHaveClass(/\bis-intro\b/, { timeout: 1000 });

    // A second visit preserves introSeen in storage and does not show the intro again
    await page.goto('/');
    await expect(page.locator('.den')).toBeVisible();
    await expect(page.locator('.den')).not.toHaveClass(/\bis-intro\b/);

    expect(errors).toEqual([]);
  });
});
