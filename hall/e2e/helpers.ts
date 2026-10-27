/**
 * Shared steps for the Hall's end-to-end tests: start without the intro, read
 * the Den's state, and collect console errors.
 */
import { expect, type Page } from '@playwright/test';

/** The Counter's places: 30 games on the wall and two cartridge versions. */
const COUNTER_PLACES = 32;

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

/** Counter digits for a place, e.g. 7 → "07". */
export function placeDigits(place: number): string {
  return String(place).padStart(2, '0');
}

/**
 * Tunes the Den to a wall slot by choosing its label, as a player does. The Den starts on the day's
 * Power Cycle game, so a test that needs a known place starts here; focus is then let go so the
 * room's own keys (P) reach the Den.
 */
export async function tuneTo(page: Page, slot: number): Promise<void> {
  // By keyboard, as a player can: the last labels sit outside a 720p view in some rooms.
  await page.locator(`.cartridge[data-slot="${slot}"]`).focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => counterText(page), { timeout: 20_000 }).toBe(placeDigits(slot));
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
}

/** Flips the Counter with P or Shift+P, whichever way round is shorter, until it shows `place`. */
export async function stepTo(page: Page, place: number): Promise<void> {
  const den = page.locator('.den');
  let current = Number(await counterText(page));
  const forward = (place - current + COUNTER_PLACES) % COUNTER_PLACES;
  const direction = forward <= COUNTER_PLACES / 2 ? 1 : -1;
  const key = direction === 1 ? 'p' : 'Shift+P';
  while (current !== place) {
    // One flip at a time: like a person, wait for the set to settle before flipping again. Flipping
    // mid-cycle only queues the press, and on a slow machine the queue outlasts any short wait.
    await expect(den).not.toHaveClass(/\bis-(power-cycling|snowing)\b/, { timeout: 20_000 });
    await page.keyboard.press(key);
    current = ((current - 1 + direction + COUNTER_PLACES) % COUNTER_PLACES) + 1;
    await expect.poll(() => counterText(page), { timeout: 20_000 }).toBe(placeDigits(current));
  }
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
