/**
 * Shared steps for the Hall's end-to-end tests: start without the intro, read
 * the Den's state, and collect console errors.
 */
import type { Page } from '@playwright/test';

/** Marks the intro as seen before the app boots, so tests start in the Den. */
export async function skipIntro(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const key = 'wg88:settings';
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, JSON.stringify({ v: 1, data: { introSeen: true } }));
    }
  });
}

/** The two flip digits of the Counter, e.g. "07". */
export async function counterText(page: Page): Promise<string> {
  const digits = await page
    .locator('[data-ref^="counter-digit-"] .flip-digit-text')
    .allTextContents();
  return digits.join('');
}

/** Collects console errors and uncaught exceptions for an assertion at the end of a test. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}
