/**
 * End-to-end tests for challenge links and signature tampering verification.
 */
import { expect, test } from '@playwright/test';
import { collectErrors, skipIntro } from '../helpers.ts';

test.describe('Challenge links', () => {
  test('generates valid challenge link and verifies score to beat and tamper protection', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const errors = collectErrors(page);
    await skipIntro(page);
    await page.goto('/harness.html#/');

    // Start a play session
    await page.locator('.game-card button[data-action="play"]').click();
    await expect(page.locator('.play-view')).toBeVisible();
    await page.keyboard.press('Enter');

    // Await match finish to bring up results
    const resultsDialog = page.locator('.dialog--results');
    await expect(resultsDialog).toBeVisible({ timeout: 30_000 });

    // Use "Challenge a friend" to copy link
    await resultsDialog.locator('button[data-result="challenge"]').click();

    const challengeLink = await page.evaluate(() => navigator.clipboard.readText());
    expect(challengeLink).toContain('beat=');

    // Open the challenge link
    await page.goto(challengeLink);
    const challengeBanner = page.locator('.play-challenge');
    await expect(challengeBanner).toBeVisible();

    const scoreToBeat = /beat=(\d+)/.exec(challengeLink)?.[1];
    if (scoreToBeat === undefined) throw new Error('The challenge link has no score to beat');
    await expect(challengeBanner).toContainText(Number(scoreToBeat).toLocaleString('en-GB'));

    // Tamper with the challenge link by changing one digit of beat=
    const lastDigit = scoreToBeat.slice(-1);
    const tamperedDigit = lastDigit === '0' ? '1' : '0';
    const tamperedScore = `${scoreToBeat.slice(0, -1)}${tamperedDigit}`;
    const tamperedLink = challengeLink.replace(`beat=${scoreToBeat}`, `beat=${tamperedScore}`);

    // Opening tampered link must fail validation and open without .play-challenge
    await page.goto(tamperedLink);
    await expect(page.locator('.play-challenge')).not.toBeVisible();

    expect(errors).toEqual([]);
  });
});
