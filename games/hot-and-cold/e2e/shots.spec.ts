/**
 * The screenshots in docs/media/screens: every look, light and dark, at
 * 1280×720 and 1920×1080 — the menu, mid-hunt, the bomb moment, the capture
 * moment and the results. A fixed seed and the live match (read through
 * `window.__hotColdMatch`, the controller's own dev-only accessor) find the
 * bomb and the flag the same way on every run, so a re-run gives the same
 * pictures. Each screenshot is taken only after checking the picture it is
 * about to be: the requested look is the one showing, and a bomb or a
 * capture has actually put its toast up, so a wrong picture fails the test
 * rather than being saved under the wrong name. Only with SHOTS=1:
 * `pnpm --filter @woodgrain-88/hot-and-cold shots`.
 */
import { test, type Page } from '@playwright/test';
import {
  checkHere,
  expectLiveLook,
  expectMenuLook,
  expectToast,
  matchFlag,
  matchSquare,
  openGame,
  readyPrematch,
  setMatchLengthShort,
  startMode,
  walkTo,
  waitForResults,
  type LookId,
} from './harness.ts';

const LOOKS: readonly LookId[] = ['polar', 'tabletop', 'radar'];
const APPEARANCES = ['light', 'dark'] as const;
const SIZES = [
  { width: 1280, height: 720 },
  { width: 1920, height: 1080 },
] as const;
const OUT = 'docs/media/screens';
const SEED = 11;

test.skip(!process.env.SHOTS, 'screenshots only with SHOTS=1');

async function bombSquare(page: Page): Promise<number> {
  const at = await page.evaluate(() => {
    const hot = window as unknown as {
      __hotColdMatch?: () => { board: { kinds: string[] } } | null;
    };
    return hot.__hotColdMatch?.()?.board.kinds.indexOf('bomb') ?? -1;
  });
  if (at < 0) throw new Error('the field has no bomb square to walk onto');
  return at;
}

async function theFlag(page: Page): Promise<number> {
  const flag = await matchFlag(page);
  if (flag === null) throw new Error('the live match has no flag to walk onto');
  return flag;
}

/** Walks to and checks a square, retrying once if the toast never shows: a step is occasionally
 *  swallowed by the browser under load, and a retry is cheaper than a flaky screenshot. */
async function walkCheckAndAwaitToast(page: Page, square: number, toast: RegExp): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await walkTo(page, 0, square);
    await checkHere(page, 0);
    try {
      await expectToast(page, toast, attempt === 0 ? 3_000 : 8_000);
      return;
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
}

/** The blast and the capture's celebration are timed in real seconds (8 and 32 ticks), so at
 *  `speed=8` they are gone in under 0.2 s — too quick for a screenshot to land inside them. The
 *  bomb and capture moments are shot at the harness's normal speed instead; only the walk there
 *  loses the speed-up (the harness fixes its speed for the whole session, so the walk cannot keep
 *  it while the check and the screenshot slow down). */
async function atTheMomentsHeight(page: Page): Promise<void> {
  await page.waitForTimeout(300);
}

for (const look of LOOKS) {
  for (const appearance of APPEARANCES) {
    for (const size of SIZES) {
      test(`${look} ${appearance} ${String(size.width)}`, async ({ page }) => {
        test.setTimeout(240_000);
        await page.setViewportSize(size);
        const name = (screen: string) =>
          `${OUT}/${look}-${screen}-${String(size.width)}-${appearance}.png`;
        const query = `look=${look}&appearance=${appearance}&speed=8&seed=${String(SEED)}`;
        // No speed=8: the bomb's blast and the capture's celebration are too short at that speed
        // for a screenshot to land inside them (see atTheMomentsHeight).
        const normalQuery = `look=${look}&appearance=${appearance}&seed=${String(SEED)}`;

        await openGame(page, query);
        await expectMenuLook(page, look);
        await page.waitForTimeout(1200);
        await page.screenshot({ path: name('menu') });

        // Hunt: alone on the race channel, a few checks in, several clues uncovered.
        await page.goto(`/game.html?seed=${String(SEED)}&${query}&channel=game-1`);
        await startMode(page, 'Alone');
        await readyPrematch(page);
        await expectLiveLook(page, look);
        await page.waitForTimeout(500);
        for (let i = 0; i < 3; i++) {
          const at = await matchSquare(page, 0);
          if (at === null) break;
          await walkTo(page, 0, (at + 10) % 63);
          await checkHere(page, 0);
        }
        await page.waitForTimeout(400);
        await page.screenshot({ path: name('hunt') });

        // The bomb moment, at normal speed so the blast is still cratering when the shot is
        // taken: a fresh session, walk onto a bomb square and check it.
        await page.goto(`/game.html?${normalQuery}&channel=game-1`);
        await startMode(page, 'Alone');
        await readyPrematch(page);
        await expectLiveLook(page, look);
        await page.waitForTimeout(500);
        await walkCheckAndAwaitToast(page, await bombSquare(page), /Bomb!/);
        await atTheMomentsHeight(page);
        await page.screenshot({ path: name('bomb') });

        // The capture moment, at normal speed so the celebration is still playing (the flag up,
        // the field not yet re-dealt) when the shot is taken.
        await page.goto(`/game.html?${normalQuery}&channel=game-1`);
        await startMode(page, 'Alone');
        await readyPrematch(page);
        await expectLiveLook(page, look);
        await page.waitForTimeout(500);
        await walkCheckAndAwaitToast(page, await theFlag(page), /found the flag!/);
        await atTheMomentsHeight(page);
        await page.screenshot({ path: name('capture') });

        // Results: a short match, so a few finds reach them.
        await page.goto(`/game.html?seed=${String(SEED)}&${query}&channel=game-1`);
        await setMatchLengthShort(page);
        await startMode(page, 'Alone');
        await readyPrematch(page);
        await expectLiveLook(page, look);
        for (let round = 0; round < 20; round++) {
          if (await page.getByLabel('Match results').isVisible()) break;
          const roundFlag = await matchFlag(page);
          if (roundFlag !== null) {
            await walkTo(page, 0, roundFlag);
            await checkHere(page, 0);
          }
          await page.waitForTimeout(700);
        }
        await waitForResults(page, 60_000);
        await page.waitForTimeout(400);
        await page.screenshot({ path: name('results') });
      });
    }
  }
}
