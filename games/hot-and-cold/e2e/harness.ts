/**
 * Helpers for driving Hot & Cold through its game harness (game.html): open
 * it with options, get from the menu into a running match, walk and check by
 * keyboard, and wait for the screens the controller puts up. Screens are
 * found by their accessible names, so the tests read like a player's path
 * through the game.
 *
 * Walking and checking read the live match through `window.__hotColdMatch`,
 * the dev-only accessor the game's controller already exposes (DEV builds
 * only); nothing here adds to the game itself. Clicking a square (the one
 * flow that drives the mouse) needs to know where a square lands on screen,
 * and the game does not expose its live camera for that, so `squareScreenPoint`
 * recomputes it: the table camera is a pure function of the look's framing
 * and the viewport's aspect (see `packages/arena/src/camera.ts`), so this
 * mirrors that math and the Polar Expedition look's framing
 * (`src/looks/polar/look.ts`, the menu's default) rather than needing a hook.
 */
import { expect, type Page } from '@playwright/test';
import { OrthographicCamera, Vector3 } from 'three';

const COLUMNS = 9;
const ROWS = 7;
const SQUARE_SIZE = 4;

/** Opens the harness; every page error fails the test that caused it. */
export async function openGame(page: Page, query = ''): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`/game.html?seed=7&${query}`);
  await expect(page.getByLabel('Hot & Cold game menu')).toBeVisible({ timeout: 30_000 });
  return errors;
}

/** Opens the harness for a run the Hall would open directly (daily, a challenge link, a
 *  micro-challenge): these skip the menu, so this does not wait for it. */
export async function openRun(page: Page, query: string): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`/game.html?seed=7&${query}`);
  return errors;
}

/** The results screen, once the match is over. */
export async function waitForResults(page: Page, timeout = 90_000): Promise<void> {
  await expect(page.getByLabel('Match results')).toBeVisible({ timeout });
}

export type LookId = 'polar' | 'tabletop' | 'radar';

const LOOK_MENU_LABEL: Readonly<Record<LookId, string>> = {
  polar: 'Polar',
  tabletop: 'Tabletop',
  radar: 'Radar',
};

/** On the menu, that the Look choice shows the requested look as the one picked. */
export async function expectMenuLook(page: Page, look: LookId): Promise<void> {
  await expect(
    page
      .getByLabel('Hot & Cold game menu')
      .getByRole('radio', { name: LOOK_MENU_LABEL[look], exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
}

/** Mid-match or at results, that the HUD (or the field behind the results cards) was built for
 *  the requested look: the HUD carries the look as `data-look` (`src/ui/hud.ts`). */
export async function expectLiveLook(page: Page, look: LookId): Promise<void> {
  await expect(page.locator('.hc-hud')).toHaveAttribute('data-look', look, { timeout: 15_000 });
}

/** The HUD's announced message (also read aloud for screen readers), for the toast a bomb or a
 *  capture puts up. */
export async function expectToast(page: Page, pattern: RegExp, timeout = 8_000): Promise<void> {
  await expect(page.locator('[role="status"]')).toHaveText(pattern, { timeout });
}

/** The menu's "Vs a Kid", "Two players" or "Alone" button, by its visible label. */
export async function startMode(page: Page, label: string): Promise<void> {
  await page
    .getByLabel('Hot & Cold game menu')
    .getByRole('button', { name: new RegExp(label) })
    .click();
}

/** Picks a Kid to play against, from the menu's "Pick your rival" photos. */
export async function pickKid(page: Page, name: string): Promise<void> {
  await page
    .getByLabel('Hot & Cold game menu')
    .getByRole('radio', { name: new RegExp(`^${name}:`) })
    .click();
}

/** Sets the menu's clues rule: Notebook (every clue stays) or Classic Memory (held to show). */
export async function selectClues(page: Page, label: 'Notebook' | 'Classic Memory'): Promise<void> {
  await page
    .getByLabel('Hot & Cold game menu')
    .getByRole('radio', { name: label, exact: true })
    .click();
}

/** Opens the menu's settings sheet, sets a short match (first to 5, 25 checks, a 30-tick clock),
 *  and closes it back to the menu. */
export async function setMatchLengthShort(page: Page): Promise<void> {
  await page.getByLabel('Hot & Cold game menu').getByText('Settings', { exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Hot & Cold settings' });
  await sheet.getByRole('radio', { name: 'Short', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
}

/** Readies the pre-match cards: clicking Start marks every seat ready at once. */
export async function readyPrematch(page: Page): Promise<void> {
  await expect(page.getByLabel('Before the match')).toBeVisible();
  await page.getByText('Start', { exact: true }).click();
  await expect(page.getByLabel('Before the match')).toBeHidden({ timeout: 15_000 });
}

/** The live match the controller exposes in DEV builds (menu backdrop, a lesson or a real match). */
export async function matchSquare(page: Page, seat: 0 | 1): Promise<number | null> {
  return page.evaluate((seatIndex) => {
    const hot = window as unknown as {
      __hotColdMatch?: () => { seats: { square: number }[] } | null;
    };
    return hot.__hotColdMatch?.()?.seats.at(seatIndex)?.square ?? null;
  }, seat);
}

/** Where the hidden flag really is, read from the live match (never shown to the player). */
export async function matchFlag(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const hot = window as unknown as { __hotColdMatch?: () => { flags: number[] } | null };
    return hot.__hotColdMatch?.()?.flags[0] ?? null;
  });
}

/** A square that is neither the flag nor a bomb, for a check that is meant to miss safely. */
export async function matchSafeSquare(page: Page): Promise<number> {
  return page.evaluate(() => {
    const hot = window as unknown as {
      __hotColdMatch?: () => { flags: number[]; board: { kinds: string[] } } | null;
    };
    const match = hot.__hotColdMatch?.();
    if (!match) return 0;
    for (let square = 0; square < match.board.kinds.length; square++) {
      if (!match.flags.includes(square) && match.board.kinds[square] !== 'bomb') return square;
    }
    return 0;
  });
}

/** Sets the live match's seat 1 straight onto a square and its hunt-for-hunt check total, so a
 *  test can reach the 75-check limit without actually making 75 checks. */
export async function placeSeatAndScore(page: Page, square: number, score: number): Promise<void> {
  await page.evaluate(
    ({ square, score }) => {
      interface SeatState {
        square: number;
        score: number;
      }
      const hot = window as unknown as {
        __hotColdMatch?: () => { seats: readonly [SeatState, SeatState] } | null;
      };
      const match = hot.__hotColdMatch?.();
      if (!match) return;
      match.seats[0].square = square;
      match.seats[0].score = score;
    },
    { square, score },
  );
}

const SEAT_KEYS = {
  0: {
    east: { 1: 'ArrowRight', [-1]: 'ArrowLeft' },
    south: { 1: 'ArrowDown', [-1]: 'ArrowUp' },
    fire: 'Enter',
  },
  1: {
    east: { 1: 'KeyD', [-1]: 'KeyA' },
    south: { 1: 'KeyS', [-1]: 'KeyW' },
    fire: 'Space',
  },
} as const;

/** The shortest signed step on a field that wraps round every edge, as the explorers do. */
function wrapSign(diff: number, size: number): -1 | 0 | 1 {
  const forward = ((diff % size) + size) % size;
  const shortest = forward > size / 2 ? forward - size : forward;
  return Math.sign(shortest) as -1 | 0 | 1;
}

/** Walks a seat to a square, a step at a time by keyboard, reading the live match after each step
 *  so the path always heads the shortest way round the field. */
export async function walkTo(page: Page, seat: 0 | 1, target: number): Promise<void> {
  const keys = SEAT_KEYS[seat];
  for (let guard = 0; guard < 24; guard++) {
    const at = await matchSquare(page, seat);
    if (at === null || at === target) return;
    const east = wrapSign((target % COLUMNS) - (at % COLUMNS), COLUMNS);
    const south = wrapSign(Math.floor(target / COLUMNS) - Math.floor(at / COLUMNS), ROWS);
    const held: string[] = [];
    if (east !== 0) held.push(keys.east[east]);
    if (south !== 0) held.push(keys.south[south]);
    for (const key of held) await page.keyboard.down(key);
    await page.waitForTimeout(180);
    for (const key of held) await page.keyboard.up(key);
    await page.waitForTimeout(80);
  }
}

/** Holds a seat's fire key long enough to check the square it stands on, then lets go. */
export async function checkHere(page: Page, seat: 0 | 1): Promise<void> {
  await page.waitForTimeout(150);
  await page.keyboard.down(SEAT_KEYS[seat].fire);
  await page.waitForTimeout(150);
  await page.keyboard.up(SEAT_KEYS[seat].fire);
  await page.waitForTimeout(150);
}

/** Taps a seat's fire key once, for a turn-based match where it is not always this seat's turn. */
export async function tapFire(page: Page, seat: 0 | 1): Promise<void> {
  await page.keyboard.down(SEAT_KEYS[seat].fire);
  await page.waitForTimeout(90);
  await page.keyboard.up(SEAT_KEYS[seat].fire);
  await page.waitForTimeout(90);
}

/** Keeps a seat checking until the results screen shows, for a match a Kid can also win. */
export async function playUntilResults(page: Page, seat: 0 | 1, maxTaps = 120): Promise<void> {
  for (let tap = 0; tap < maxTaps; tap++) {
    if (await page.getByLabel('Match results').isVisible()) return;
    await tapFire(page, seat);
  }
  await waitForResults(page);
}

// Mirrors the Polar Expedition look's framing and field height (`src/looks/polar/look.ts`) and
// the tabletop camera's pure math (`packages/arena/src/camera.ts`): both are plain functions of
// the viewport's aspect ratio, so this reproduces the same camera instead of needing the game to
// expose its live one.
const POLAR_FRAMING = { width: 50, depth: 31, tilt: 46, height: 10, margin: 0.01 };
const POLAR_FIELD_HEIGHT = 0.4;
const CAMERA_DISTANCE = 120;

function tableCamera(aspect: number): OrthographicCamera {
  const camera = new OrthographicCamera(-1, 1, 1, -1, 1, CAMERA_DISTANCE * 3);
  const tilt = (POLAR_FRAMING.tilt * Math.PI) / 180;
  const toCamera = new Vector3(0, Math.sin(tilt), Math.cos(tilt));
  camera.position.copy(toCamera.multiplyScalar(CAMERA_DISTANCE));
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);

  const halfDepthOnScreen = (POLAR_FRAMING.depth / 2) * Math.sin(tilt);
  const top = halfDepthOnScreen + POLAR_FRAMING.height * Math.cos(tilt);
  const bottom = -halfDepthOnScreen;
  const grow = 1 + POLAR_FRAMING.margin * 2;
  const contentHeight = (top - bottom) * grow;
  const contentWidth = POLAR_FRAMING.width * grow;
  const viewHeight = Math.max(contentHeight, contentWidth / aspect);
  const viewWidth = viewHeight * aspect;
  const contentMiddle = (top + bottom) / 2;
  const frustumBottom = contentMiddle - viewHeight / 2;
  camera.left = -viewWidth / 2;
  camera.right = viewWidth / 2;
  camera.bottom = frustumBottom;
  camera.top = frustumBottom + viewHeight;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return camera;
}

/** Where the Polar Expedition look (the menu's default) draws a square, in CSS pixels, so a test
 *  can click it. */
export function squareScreenPoint(
  square: number,
  viewport: { readonly width: number; readonly height: number },
): { readonly x: number; readonly y: number } {
  const camera = tableCamera(viewport.width / viewport.height);
  const column = square % COLUMNS;
  const row = Math.floor(square / COLUMNS);
  const x = (column - (COLUMNS - 1) / 2) * SQUARE_SIZE;
  const z = (row - (ROWS - 1) / 2) * SQUARE_SIZE;
  const projected = new Vector3(x, POLAR_FIELD_HEIGHT, z).project(camera);
  return {
    x: ((projected.x + 1) / 2) * viewport.width,
    y: ((1 - projected.y) / 2) * viewport.height,
  };
}
