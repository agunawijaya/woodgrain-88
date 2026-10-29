/**
 * Helpers for driving Trailblaze through its game harness (game.html): open
 * it with options, get from the menu into a running match, and wait for the
 * screens the controller puts up. Screens are found by their accessible
 * names, so the tests read like a player's path through the game.
 */
import { expect, type Page } from '@playwright/test';

/** Opens the harness; every page error fails the test that caused it. */
export async function openGame(page: Page, query = ''): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`/game.html?seed=7&${query}`);
  await expect(page.getByLabel('Trailblaze game menu')).toBeVisible({ timeout: 30_000 });
  return errors;
}

/** Enter on the menu's first mode, Enter on the cards, then the 3-2-1. */
export async function rideFromMenu(page: Page): Promise<void> {
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Pre-match lineup')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Pre-match lineup')).toBeHidden({ timeout: 10_000 });
}

/** The results screen, once the frozen board has had its moment. */
export async function waitForResults(page: Page, timeout = 110_000): Promise<void> {
  await expect(page.getByLabel('Match results')).toBeVisible({ timeout });
}
