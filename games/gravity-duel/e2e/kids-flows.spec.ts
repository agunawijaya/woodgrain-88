/**
 * The tutorial completes on the real engine, by keyboard, the way a player
 * would finish it. Named so it matches the `flows` project's test pattern in
 * `playwright.config.ts` and runs alongside `flows.spec.ts`.
 */
import { expect, test, type Page } from '@playwright/test';
import { openGame } from './harness.ts';

/** Each lesson starts afresh once the last one is passed; wait for it before pressing anything. */
async function atStep(page: Page, step: number): Promise<void> {
  await expect(page.getByText(`Step ${String(step)} of 7`)).toBeVisible({ timeout: 15_000 });
}

async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

test('the tutorial completes and returns to the game menu', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = await openGame(page);
  await page.getByText('How to play').first().click();

  await atStep(page, 1);
  await hold(page, 'ArrowLeft', 1500);

  await atStep(page, 2);
  await hold(page, 'ArrowUp', 1000);

  await atStep(page, 3);
  await hold(page, 'ArrowUp', 2000);
  await hold(page, 'ArrowRight', 1200);
  await hold(page, 'ArrowUp', 2000);

  await atStep(page, 4);
  await page.keyboard.press('Enter');

  // The star lesson moves on after a hit or three tries; a ship has one missile out at a time,
  // and it lives 128 ticks (2.56 s).
  await atStep(page, 5);
  for (let shot = 0; shot < 3; shot++) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2800);
  }

  // Down pulled alone toggles the cloak, and must be let go before it toggles again.
  await atStep(page, 6);
  await hold(page, 'ArrowDown', 100);
  await page.waitForTimeout(100);
  await hold(page, 'ArrowDown', 100);

  // The lesson's pod waits, still, straight ahead: a short burn and a coast dock with it.
  await atStep(page, 7);
  await hold(page, 'ArrowUp', 600);

  await expect(page.getByLabel('Gravity Duel game menu')).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});
