/**
 * Helpers for driving Gravity Duel through its game harness (game.html): the
 * real module mounted with a faithful fake of the Hall's context and chrome
 * (`src/dev/game.ts`, `src/dev/fake-context.ts`). Screens are found the way a
 * player would reach them, by keyboard: the menu focuses its primary start
 * button on show (Enter starts it), the pre-match cards (`.gd-prematch`)
 * ready on Enter or Space, and the results (`.gd-results`) carry R (play
 * again / rematch) and H (back to the Hall), with `data-action`s on the
 * buttons themselves.
 *
 * A few flows (a star swallow, a Hot Landing, a cloak fuel-out, mutual
 * reload) are engine behaviour that would take real skill to bring about by
 * play; those drive the wireframe bench instead (`play.html`, `window.__gravityDuel`),
 * poking the live `Match` object directly, as the brief allows.
 */
import { expect, type Page } from '@playwright/test';
import type { Match } from '../src/engine/types.ts';
import type { MatchSession } from '../src/session/match-session.ts';

declare global {
  interface Window {
    /** The wireframe bench's own hook (`src/dev/play.ts`), for poking the live match directly. */
    __gravityDuel?: {
      readonly match: Match | undefined;
      readonly session: MatchSession | null;
      readonly stage?: unknown;
    };
  }
}

/** Opens the harness on the game menu; every page error fails the test that caused it. */
export async function openGame(page: Page, query = ''): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`/game.html?seed=7&${query}`);
  await expect(page.getByLabel('Gravity Duel game menu')).toBeVisible({ timeout: 30_000 });
  return errors;
}

/**
 * Opens the harness on a run the Hall started directly (Daily, a challenge
 * link or a micro-challenge): these skip the game menu outright, straight to
 * the pre-match cards or, for a micro-challenge, the match itself.
 */
export async function openRun(page: Page, query: string): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`/game.html?seed=7&${query}`);
  await page.waitForFunction(() => window.__gravityDuelHarness !== undefined, {
    timeout: 30_000,
  });
  return errors;
}

/** Opens the wireframe-with-a-look bench, for poking the engine directly. */
export async function openBench(page: Page, query = ''): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`/play.html?${query}`);
  await page.waitForFunction(() => document.body.dataset.ready === 'true', { timeout: 30_000 });
  return errors;
}

/** The menu focuses its primary start button on show; Enter starts "vs a Kid". */
export async function startVsKid(page: Page): Promise<void> {
  await page.keyboard.press('Enter');
}

/** "Versus" (two people) has no key of its own yet: the menu's own button. */
export async function startVersus(page: Page): Promise<void> {
  await page.getByLabel('Gravity Duel game menu').locator('[data-start="friend"]').click();
}

/** "Fly solo" (solo docking): the menu's own button. */
export async function startSolo(page: Page): Promise<void> {
  await page.getByLabel('Gravity Duel game menu').locator('[data-start="solo"]').click();
}

/**
 * Readies up on the pre-match cards and waits for the match to begin. Solo
 * docking is getting the same cards as a duel; if they do not appear (an
 * older build, or a run that skips them outright) this just carries on.
 */
export async function readyUp(page: Page): Promise<void> {
  const prematch = page.locator('.gd-prematch');
  if (await prematch.isVisible().catch(() => false)) {
    await page.keyboard.press('Enter');
    await expect(prematch).toBeHidden({ timeout: 15_000 });
  }
}

/** The results screen, once the frozen board has had its moment. */
export async function waitForResults(page: Page, timeout = 150_000): Promise<void> {
  await expect(page.locator('.gd-results')).toBeVisible({ timeout });
}

/** The results buttons' `data-action`s, in the order they sit on the panel. */
export async function resultsActionOrder(page: Page): Promise<string[]> {
  return page
    .locator('.gd-results [data-action]')
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset.action ?? ''));
}
