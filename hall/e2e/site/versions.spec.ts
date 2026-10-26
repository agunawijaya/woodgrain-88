/**
 * End-to-end tests for cartridge versions on the site:
 * picking versions in the details overlay, persistence across reload,
 * and reflecting versions in the Den's counter places and lamp tooltips.
 */
import { expect, test } from '@playwright/test';
import { collectErrors, counterText, skipIntro } from '../helpers.ts';

test.describe('Cartridge versions on site', () => {
  test('persists version selection in details overlay and shows version on place 31 and lamp tooltip', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.goto('/#/game/lane-hopper');

    // Pick Rabbit in the details overlay
    const detailsDialog = page.locator('.dialog--details');
    await expect(detailsDialog).toBeVisible();

    const rabbitRadio = detailsDialog.locator('input[name="cartridgeVersion"][value="rabbit"]');
    await rabbitRadio.check();
    await expect(rabbitRadio).toBeChecked();

    // Storage now holds rabbit
    const storedVersion = await page.evaluate(() => {
      const raw = localStorage.getItem('wg88:settings');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        data?: { games?: Record<string, { cartridgeVersion?: string }> };
      };
      return parsed.data?.games?.['lane-hopper']?.cartridgeVersion;
    });
    expect(storedVersion).toBe('rabbit');

    // After a reload the Rabbit radio is checked
    await page.reload();
    await expect(detailsDialog).toBeVisible();
    await expect(
      detailsDialog.locator('input[name="cartridgeVersion"][value="rabbit"]'),
    ).toBeChecked();

    // Close details dialog to return to the Den
    await detailsDialog.locator('.dialog-close').click();
    await expect(page.locator('.den')).toBeVisible();

    // Step to place 31
    while ((await counterText(page)) !== '31') {
      const prev = await counterText(page);
      await page.keyboard.press('Shift+P');
      await expect.poll(() => counterText(page), { timeout: 10_000 }).not.toBe(prev);
    }

    // Place 31's card kicker says "Rabbit version"
    await expect(page.locator('.game-card-kicker')).toContainText('Rabbit version');

    // Hovering lamp 31 shows a tooltip naming "Lane Hopper, Rabbit version"
    await page.locator('.lamp-hit[data-slot="31"]').hover();
    const tooltip = page.locator('.den-tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip).toContainText('Lane Hopper, Rabbit version');

    expect(errors).toEqual([]);
  });
});
