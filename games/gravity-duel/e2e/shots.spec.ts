/**
 * The screenshots in docs/media/screens: every look, light and dark, at
 * 1280×720 and 1920×1080. Menu, mid-duel, the docking race and results come
 * from the game harness; the bank shot and the hit come from the hero page's
 * `scene=bank`, whose scripted round bends a missile round the star into the
 * blue ship at the same moment every time (the hit a fifth of a second after).
 * Only with SHOTS=1: `pnpm --filter @woodgrain-88/gravity-duel shots`.
 */
import { test } from '@playwright/test';
import { readyUp, startVsKid, waitForResults } from './harness.ts';

const LOOKS = ['deep', 'brass', 'paper', 'whirl'] as const;
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
          `${OUT}/${look}/${screen}-${String(size.width)}-${appearance}.png`;
        const game = `/game.html?seed=7&look=${look}&appearance=${appearance}`;

        await page.goto(game);
        await page.waitForTimeout(2500);
        await page.screenshot({ path: name('menu') });

        await page.goto(`${game}&speed=3&channel=game-4`);
        await page.waitForTimeout(2000);
        await startVsKid(page);
        await readyUp(page);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: name('mid-duel') });

        const bank = `/hero.html?look=${look}&scene=bank&appearance=${appearance}`;
        await page.goto(bank);
        await page.waitForFunction(
          () => document.body.dataset.ready ?? document.body.dataset.error,
        );
        await page.screenshot({ path: name('bank-shot') });

        await page.goto(`${bank}&t=0.2`);
        await page.waitForFunction(
          () => document.body.dataset.ready ?? document.body.dataset.error,
        );
        await page.screenshot({ path: name('hit') });

        await page.goto(`${game}&speed=20&channel=game-4`);
        await page.waitForTimeout(2000);
        await startVsKid(page);
        await readyUp(page);
        await waitForResults(page, 180_000);
        await page.waitForTimeout(500);
        await page.screenshot({ path: name('results') });

        await page.goto(`${game}&speed=3&channel=game-8`);
        await page.waitForTimeout(2000);
        await startVsKid(page);
        await readyUp(page);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: name('dock') });
      });
    }
  }
}
