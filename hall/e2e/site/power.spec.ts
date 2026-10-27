/**
 * End-to-end tests for the Den's POWER lever and keyboard shortcuts.
 */
import { expect, test } from '@playwright/test';
import { collectErrors, counterText, skipIntro, tuneTo } from '../helpers.ts';

test.describe('POWER switch and Counter', () => {
  test('advances on click, advances on P, and steps back on Shift+P', async ({ page }) => {
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.goto('/');
    await tuneTo(page, 1);

    await page.locator('[data-ref="power"]').click();
    await expect.poll(() => counterText(page), { timeout: 10_000 }).toBe('02');

    await page.keyboard.press('p');
    await expect.poll(() => counterText(page), { timeout: 10_000 }).toBe('03');

    await page.keyboard.press('Shift+P');
    await expect.poll(() => counterText(page), { timeout: 10_000 }).toBe('02');

    expect(errors).toEqual([]);
  });

  test('wraps around from slot 01 to 32 on Shift+P', async ({ page }) => {
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.goto('/');
    await tuneTo(page, 1);

    await page.keyboard.press('Shift+P');
    await expect.poll(() => counterText(page), { timeout: 10_000 }).toBe('32');

    expect(errors).toEqual([]);
  });

  test('steps forward when dragged right by 40 px and back when dragged left', async ({ page }) => {
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.goto('/');
    await tuneTo(page, 1);

    const lever = page.locator('[data-ref="power"]');
    const box = await lever.boundingBox();
    if (!box) {
      throw new Error('POWER lever bounding box was not found');
    }

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    // Drag 40 px to the right to cycle forward to 02
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 40, startY);
    await page.mouse.up();
    await expect.poll(() => counterText(page), { timeout: 10_000 }).toBe('02');

    // Drag 40 px to the left to cycle back to 01
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX - 40, startY);
    await page.mouse.up();
    await expect.poll(() => counterText(page), { timeout: 10_000 }).toBe('01');

    expect(errors).toEqual([]);
  });
});
