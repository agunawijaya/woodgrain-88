/**
 * End-to-end tests for Den Life competitive modes in the dev harness:
 * Versus Night best-of series with bot opponent and Power Cycle Run transitions.
 */
import { expect, test } from '@playwright/test';
import { collectErrors, skipIntro } from '../helpers.ts';

test.describe('Den Life modes', () => {
  test('Versus Night, best of 3, with a Kid in seat 2', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.goto('/harness.html#/versus');
    await expect(page.locator('.versus-screen')).toBeVisible();

    // Pick "A Neighbourhood Kid", choose pip, best of 3
    await page.locator('input[type="radio"][name="seat2kind"][value="kid"]').check();
    await page.locator('select[name="kid"]').selectOption('pip');
    await page.locator('input[type="radio"][name="bestOf"][value="3"]').check();

    // Untick every pool checkbox except test-paddles
    const poolCheckboxes = page.locator('input[type="checkbox"][name="pool"]');
    const poolCount = await poolCheckboxes.count();
    for (let i = 0; i < poolCount; i++) {
      const checkbox = poolCheckboxes.nth(i);
      const value = await checkbox.inputValue();
      if (value === 'test-paddles') {
        await checkbox.check();
      } else {
        await checkbox.uncheck();
      }
    }

    // Start the night
    await page.locator('.versus-setup button[type="submit"]').click();

    // Loop until .versus-stage.is-crowned is visible
    while (!(await page.locator('.versus-stage.is-crowned').isVisible())) {
      // 1. Click "Draw game N"
      await page.locator('.versus-stage button[data-do="draw"]').click();

      // 2. Wait for "Play game N"
      const playButton = page.locator('.versus-stage button[data-do="play"]');
      await expect(playButton).toBeVisible({ timeout: 15_000 });

      // 3. Click it, press Enter to start the match
      await playButton.click();
      await expect(page.locator('.play-view')).toBeVisible();
      await page.keyboard.press('Enter');

      // 4. Wait for .dialog--results, then click [data-result="versus"]
      const resultsDialog = page.locator('.dialog--results');
      await expect(resultsDialog).toBeVisible({ timeout: 45_000 });
      await resultsDialog.locator('button[data-result="versus"]').click();
      await expect(page.locator('.versus-screen')).toBeVisible();
    }

    // The finished night lists every game played: at least two, more if the idle seat 1 won one or a game was drawn.
    expect(await page.locator('.series-games li').count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator('.versus-stage button[data-do="rematch"]')).toBeVisible();

    // #/records lists a rivalry
    await page.goto('/harness.html#/records');
    await expect(page.locator('.page--records')).toBeVisible();
    await expect(page.locator('.records-rivalries li')).toHaveCount(1);

    expect(errors).toEqual([]);
  });

  test('Power Cycle Run through five transitions', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.goto('/harness.html#/run');
    await expect(page.locator('.run-card')).toBeVisible();

    // Click "Start a run" ([data-do="free"])
    await page.locator('.run-card button[data-do="free"]').click();

    for (let round = 1; round <= 5; round++) {
      // 1. Wait for the goal card's [data-do="go"] and kicker text "Round N of 5"
      const goButton = page.locator('.run-card button[data-do="go"]');
      await expect(goButton).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('.run-card-kicker')).toHaveText(`Round ${round} of 5`);

      // 2. Click Go
      await goButton.click();

      // 3. Wait for .run-round-hud
      await expect(page.locator('.run-round-hud')).toBeVisible({ timeout: 10_000 });

      // 4. Press Escape, choose "Back to the Hall" in pause menu, accept leave confirmation
      await page.keyboard.press('Escape');
      const pauseDialog = page.locator('.dialog--pause');
      await expect(pauseDialog).toBeVisible();
      await pauseDialog.locator('button[data-item="hall"]').click();

      // The game asks first only when the round has something to lose.
      const confirmDialog = page.locator('.dialog--confirm');
      await expect(confirmDialog.or(page.locator('.den'))).toBeVisible();
      if (await confirmDialog.isVisible())
        await confirmDialog.locator('button[data-answer="yes"]').click();

      // Back in the Den
      await expect(page.locator('.den')).toBeVisible();

      // 5. Go to #/run again
      await page.goto('/harness.html#/run');
    }

    // After the fifth, .run-slates li has 5 items and .run-share contains "0/5"
    await expect(page.locator('.run-slates li')).toHaveCount(5);
    await expect(page.locator('.run-share')).toContainText('0/5');

    expect(errors).toEqual([]);
  });
});
