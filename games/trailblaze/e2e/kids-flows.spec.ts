/**
 * The Den's Kid setting in Trailblaze: with Sharp Kids on, a rider that never
 * fumbles leaves no slip marks in its own "How it saw it" replay. Named so it
 * matches the `flows` project's test pattern in `playwright.config.ts` and
 * runs alongside `flows.spec.ts`. See `briefs/hc-e2e.md` §3.
 */
import { expect, test } from '@playwright/test';
import { openGame, rideFromMenu, waitForResults } from './harness.ts';

test('with Sharp Kids, Rosa’s replay shows no slip marks', async ({ page }) => {
  const errors = await openGame(page, 'speed=8&kids=sharp');
  await rideFromMenu(page);
  await waitForResults(page);

  const results = page.getByLabel('Match results');
  await results.getByText(/How Rosa saw it/).click();
  // Sharp Kids never fumble (slipRate 0, packages/kit/src/kids/reflex.ts), so no frame's own marks
  // (not the replay's static legend, which always shows one of each icon as a key) show a late or
  // a wrong turn; attention is unchanged, so a "missed rival turn" mark can still show and is not
  // a slip.
  const frameSlips = results.locator(
    '.tb-frame-marks .tb-mark-icon[aria-label="Slipped late"], ' +
      '.tb-frame-marks .tb-mark-icon[aria-label="Slipped wrong"]',
  );
  await expect(frameSlips).toHaveCount(0);
  expect(errors).toEqual([]);
});
