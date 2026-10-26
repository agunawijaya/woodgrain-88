/**
 * End-to-end tests for the Den's keyboard navigation and focus flow.
 */
import { expect, test } from '@playwright/test';
import { collectErrors, counterText, skipIntro } from '../helpers.ts';

test.describe('Den keyboard navigation', () => {
  test('navigates through TV, console, and wall, tunes on Enter, opens and closes details', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.goto('/');

    const tv = page.locator('[data-ref="tv"]');
    const power = page.locator('[data-ref="power"]');
    const reset = page.locator('[data-ref="reset"]');
    const switch1 = page.locator('[data-ref="switch-1"]');
    const switch2 = page.locator('[data-ref="switch-2"]');
    const firstCartridge = page.locator('.cartridge').first();

    // The top bar comes first; tab through it until the TV takes focus.
    const tvIsFocused = () => tv.evaluate((element) => element === document.activeElement);
    for (let presses = 0; presses < 20 && !(await tvIsFocused()); presses++) {
      await page.keyboard.press('Tab');
    }
    await expect(tv).toBeFocused();

    // Next Tab reaches POWER lever
    await page.keyboard.press('Tab');
    await expect(power).toBeFocused();

    // After console controls (RESET, switch-1, switch-2), Tab reaches the first wall cartridge
    await page.keyboard.press('Tab');
    await expect(reset).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(switch1).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(switch2).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(firstCartridge).toBeFocused();

    // ArrowRight moves focus along the row to the second cartridge
    const secondCartridge = page.locator('.cartridge').nth(1);
    await page.keyboard.press('ArrowRight');
    await expect(secondCartridge).toBeFocused();

    const slotAttr = await secondCartridge.getAttribute('data-slot');
    if (!slotAttr) {
      throw new Error('Cartridge missing data-slot');
    }
    const expectedCounter = slotAttr.padStart(2, '0');

    // Enter on a cartridge tunes the TV (Counter shows its slot) and moves focus into .game-card
    await page.keyboard.press('Enter');
    await expect.poll(() => counterText(page), { timeout: 10_000 }).toBe(expectedCounter);

    const detailsButton = page.locator('.game-card button[data-action="details"]');
    await expect(detailsButton).toBeFocused();

    const title = await page.locator('.game-card .game-card-title').textContent();
    if (!title) {
      throw new Error('Game card title was empty');
    }

    // Activating Details opens a .dialog titled with the game's name
    await page.keyboard.press('Enter');
    const dialog = page.locator('.dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.dialog-title')).toHaveText(title);

    // Escape closes it
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    expect(errors).toEqual([]);
  });
});
