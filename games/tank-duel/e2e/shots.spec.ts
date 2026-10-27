/**
 * The screenshots in docs/media/screens, at 1280 × 720 and 1920 × 1080, by
 * day and by night: the menu, the commanders before a match, four matches
 * (a tank maze, invisible tanks, biplanes in the clouds, jets two against
 * two), the bank-shot kill, the results and the tutorial. Only with SHOTS=1.
 */
import { expect, test, type Page } from '@playwright/test';
import { openGame, startKidMatch } from './harness.ts';

const OUT = 'docs/media/screens';
const SIZES = [
  { name: '720p', width: 1280, height: 720 },
  { name: '1080p', width: 1920, height: 1080 },
] as const;
const APPEARANCES = ['light', 'dark'] as const;
/** The harness's key hint is for whoever runs it, not for the published screenshots. */
const HIDE_HARNESS = '.fake-shortcuts-hint { display: none !important; }';

test.skip(!process.env.SHOTS, 'screenshots only with SHOTS=1');

/** Plays a few seconds of a Kid match with seat 1 driving and firing, for a busy frame. */
async function liven(page: Page): Promise<void> {
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  await page.keyboard.press('Space');
  await page.waitForTimeout(1600);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('Space');
  await page.waitForTimeout(700);
}

for (const size of SIZES) {
  for (const appearance of APPEARANCES) {
    const shot = (page: Page, name: string) =>
      page.screenshot({
        path: `${OUT}/${name}-${size.name}-${appearance}.png`,
        style: HIDE_HARNESS,
      });

    test.describe(`${size.name} ${appearance}`, () => {
      test.use({ viewport: { width: size.width, height: size.height } });

      test('menu and pre-match', async ({ page }) => {
        await openGame(page, `appearance=${appearance}&channel=game-1&kid=lou`);
        await page.waitForTimeout(2500);
        await shot(page, 'menu');
        await page.keyboard.press('Enter');
        await expect(page.locator('.td-prematch')).toBeVisible();
        await page.waitForTimeout(1300);
        await shot(page, 'prematch');
      });

      for (const [name, channel] of [
        ['match-maze', 'game-3'],
        ['match-invisible', 'game-11'],
        ['match-biplanes', 'game-15'],
        ['match-jets-2v2', 'game-25'],
      ] as const) {
        test(name, async ({ page }) => {
          await openGame(page, `appearance=${appearance}&channel=${channel}&kid=dee`);
          await startKidMatch(page);
          await liven(page);
          await shot(page, name);
        });
      }

      test('results', async ({ page }) => {
        await openGame(page, `appearance=${appearance}&channel=game-6&kid=pip&speed=16`);
        await startKidMatch(page);
        await expect(page.locator('.td-results')).toBeVisible({ timeout: 60_000 });
        await page.waitForTimeout(2200);
        await shot(page, 'results');
      });

      test('tutorial', async ({ page }) => {
        await openGame(page, `appearance=${appearance}`);
        await page.locator('[data-link="how"]').click();
        for (let step = 0; step < 3; step++)
          await page.getByRole('button', { name: 'Skip this step' }).click();
        await page.keyboard.down('KeyD');
        await page.waitForTimeout(600);
        await page.keyboard.up('KeyD');
        await page.waitForTimeout(500);
        await shot(page, 'tutorial');
      });

      test('bank-shot kill', async ({ page }) => {
        await page.goto(`/hero.html?scene=kill&appearance=${appearance}`);
        await page.waitForTimeout(4000);
        await shot(page, 'bank-kill');
      });
    });
  }
}
