/**
 * Shared steps for the Tank Duel end-to-end tests: open the harness with a
 * query, read what the fake context recorded, and walk the usual paths.
 */
import { expect, type Page } from '@playwright/test';

interface HarnessLog {
  readonly view: string;
  readonly events: readonly { type: string }[];
  readonly results: readonly { score: number; scoreLabel: string; presentation: string }[];
}

/** What the harness page exposes; read through this so the page's own types stay its own. */
type HarnessWindow = Window & { __tank?: { log: HarnessLog } };

/** Opens the harness and waits for the game to mount; page errors fail the test. */
export async function openGame(page: Page, query = ''): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`/game.html${query ? `?${query}` : ''}`);
  await page.waitForFunction(() => (window as HarnessWindow).__tank?.log !== undefined);
  return errors;
}

export function harnessLog(page: Page): Promise<HarnessLog> {
  return page.evaluate(() => {
    const log = (window as HarnessWindow).__tank?.log;
    if (!log) throw new Error('the harness has not mounted the game');
    return { view: log.view, events: [...log.events], results: [...log.results] };
  });
}

export async function expectView(page: Page, view: string): Promise<void> {
  await expect.poll(async () => (await harnessLog(page)).view).toBe(view);
}

/** From the game menu: Vs a Kid with Enter, then seat 1 says ready with Space. */
export async function startKidMatch(page: Page): Promise<void> {
  await expect(page.locator('.td-menu')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator('.td-prematch')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.locator('.td-prematch')).toBeHidden({ timeout: 10_000 });
  await expectView(page, 'play');
}
