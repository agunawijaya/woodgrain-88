/**
 * End-to-end tests for cartridge versions in the dev harness:
 * cycling to version places, playing chosen versions, lighting counter lamps,
 * and changing versions from pause settings.
 */
import { expect, test } from '@playwright/test';
import { collectErrors, counterText, skipIntro } from '../helpers.ts';

test.describe('Cartridge versions in harness', () => {
  test('plays version place 31 and marks counter lamp finished on results return', async ({
    page,
  }) => {
    // A dozen power cycles to reach place 31, then a whole match.
    test.slow();
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.goto('/harness.html#/');

    // From the Den, go to place 31 using Shift+P
    while ((await counterText(page)) !== '31') {
      const prev = await counterText(page);
      await page.keyboard.press('Shift+P');
      await expect.poll(() => counterText(page), { timeout: 10_000 }).not.toBe(prev);
    }

    // The card's kicker names the "Tall paddles" version
    await expect(page.locator('.game-card-kicker')).toContainText('Tall paddles');

    // Play from the card
    await page.locator('.game-card button[data-action="play"]').click();
    await expect(page.locator('.play-view')).toBeVisible();

    // The fake game's canvas reports data-version="tall"
    const canvas = page.locator('.fake-game-canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('data-version', 'tall');

    // Start against the bot and hold seat 1's paddle at the top: tall paddles
    // block most balls, so standing aside lets the bot win quickly.
    await page.keyboard.press('Enter');
    await expect(page.locator('.play-pause')).toBeVisible();
    await page.keyboard.down('w');

    const resultsDialog = page.locator('.dialog--results');
    await expect(resultsDialog).toBeVisible({ timeout: 30_000 });
    await page.keyboard.up('w');

    // Go Back to the Hall
    await page.keyboard.press('h');
    await expect(page.locator('.den')).toBeVisible();

    // Lamp 31 now has is-played
    const lamp31 = page.locator('[data-ref="counter-lamps"] .lamp[data-slot="31"]');
    await expect(lamp31).toHaveClass(/is-played/);

    // Hovering its cell shows a tooltip ending in "finished"
    await page.locator('.lamp-hit[data-slot="31"]').hover();
    const tooltip = page.locator('.den-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toHaveText(/finished$/);

    expect(errors).toEqual([]);
  });

  test('saves the version picked in the in-game settings and plays it on the next start', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.goto('/harness.html#/');

    // Ensure Den is tuned to slot 11 (fake game) and open it
    await page.locator('.cartridge[data-slot="11"]').click();
    await page.locator('.game-card button[data-action="play"]').click();
    await expect(page.locator('.play-view')).toBeVisible();

    // Start a run and open the pause menu
    await page.keyboard.press('Enter');
    await expect(page.locator('.play-pause')).toBeVisible();

    await page.keyboard.press('Escape');
    const pauseDialog = page.locator('.dialog--pause');
    await expect(pauseDialog).toBeVisible();

    // Open Settings from pause menu
    await pauseDialog.locator('button[data-item="settings"]').click();
    const settingsDialog = page.locator('.dialog--settings');
    await expect(settingsDialog).toBeVisible();

    // The run came from channel 11, the default version; pick the other one.
    await settingsDialog.locator('input[name="cartridgeVersion"][value="tall"]').check();

    // Close settings dialog
    await settingsDialog.locator('button[data-do="close"]').click();
    await expect(settingsDialog).not.toBeVisible();

    // Quit to the Hall from pause menu
    await pauseDialog.locator('button[data-item="hall"]').click();
    await expect(page.locator('.den')).toBeVisible();

    // Open the game without a Den channel, so the saved choice decides.
    await page.goto('/harness.html#/game/test-paddles');
    await expect(page.locator('.play-view')).toBeVisible();

    const canvas = page.locator('.fake-game-canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('data-version', 'tall');

    // Storage holds cartridgeVersion: 'standard'
    const storedVersion = await page.evaluate(() => {
      const raw = localStorage.getItem('wg88:settings');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        data?: { games?: Record<string, { cartridgeVersion?: string }> };
      };
      return parsed.data?.games?.['test-paddles']?.cartridgeVersion;
    });
    expect(storedVersion).toBe('tall');

    expect(errors).toEqual([]);
  });
});
