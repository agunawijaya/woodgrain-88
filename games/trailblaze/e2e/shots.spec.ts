/**
 * The screenshots in docs/media/screens: every look, light and dark, at
 * 1280×720 and 1920×1080. The game's own screens come from the harness; the
 * duel and the trap closing come from the hero page, whose scripted rounds put
 * long trails and a trap on the board at the same moment every time.
 * Only with SHOTS=1: `pnpm --filter @woodgrain-88/trailblaze shots`.
 */
import { test } from '@playwright/test';
import { rideFromMenu, waitForResults } from './harness.ts';

const LOOKS = ['neon', 'trains', 'mummy', 'ice'] as const;
const APPEARANCES = ['light', 'dark'] as const;
const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const;
const OUT = 'docs/media/screens';

test.skip(!process.env.SHOTS, 'screenshots only with SHOTS=1');

for (const look of LOOKS) {
  for (const appearance of APPEARANCES) {
    for (const size of SIZES) {
      test(`${look} ${appearance} ${String(size.width)}`, async ({ page }) => {
        test.setTimeout(240_000);
        await page.setViewportSize(size);
        const name = (screen: string) =>
          `${OUT}/${look}-${screen}-${String(size.width)}-${appearance}.png`;
        const game = `/game.html?seed=7&look=${look}&appearance=${appearance}`;

        await page.goto(game);
        await page.waitForTimeout(3500);
        await page.screenshot({ path: name('menu') });

        await page.keyboard.press('Enter');
        await page.waitForTimeout(1200);
        await page.screenshot({ path: name('prematch') });

        await page.goto(`${game}&speed=8`);
        await page.waitForTimeout(2500);
        await rideFromMenu(page);
        await waitForResults(page);
        await page.waitForTimeout(800);
        await page.screenshot({ path: name('results') });

        await page.goto(`${game}&channel=game-13`);
        await page.waitForTimeout(2500);
        await rideFromMenu(page);
        for (const key of ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
          await page.keyboard.down(key);
          await page.waitForTimeout(1500);
          await page.keyboard.up(key);
        }
        await page.screenshot({ path: name('doodle') });

        for (const scene of ['duel', 'trap'] as const) {
          await page.goto(`/hero.html?look=${look}&scene=${scene}&appearance=${appearance}`);
          await page.waitForFunction(
            () => document.body.dataset.ready ?? document.body.dataset.error,
          );
          await page.screenshot({ path: name(scene) });
        }
      });
    }
  }
}
