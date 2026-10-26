/**
 * End-to-end tests for The Den's day and night appearance.
 */
import { expect, test } from '@playwright/test';
import { collectErrors, skipIntro } from '../helpers.ts';

test.describe('Den appearance', () => {
  test('reflects light color scheme as day', async ({ page }) => {
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');

    await expect(page.locator('.den')).toHaveAttribute('data-time', 'day');
    expect(errors).toEqual([]);
  });

  test('reflects dark color scheme as night', async ({ page }) => {
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    await expect(page.locator('.den')).toHaveAttribute('data-time', 'night');
    expect(errors).toEqual([]);
  });

  test('switches from day to night without a reload when system appearance changes', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');

    await expect(page.locator('.den')).toHaveAttribute('data-time', 'day');

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('.den')).toHaveAttribute('data-time', 'night');

    expect(errors).toEqual([]);
  });
});
