/**
 * End-to-end accessibility audits using axe-core across Hall views.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { collectErrors, skipIntro } from '../helpers.ts';

async function expectNoA11yViolations(page: Page, viewName: string): Promise<void> {
  // Contrast is judged on the settled screen, not halfway through a fade-in.
  // Looping animations (snow, the clock) never finish, so they are skipped.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
  const results = await new AxeBuilder({ page }).analyze();
  const seriousOrCritical = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(seriousOrCritical, `Accessibility violations on ${viewName}`).toEqual([]);
}

test.describe('Accessibility audits', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`Den has no serious or critical axe violations (${scheme})`, async ({ page }) => {
      const errors = collectErrors(page);
      await skipIntro(page);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');

      await expect(page.locator('.den')).toBeVisible();
      await expectNoA11yViolations(page, `The Den (${scheme})`);

      expect(errors).toEqual([]);
    });

    test(`List view has no serious or critical axe violations (${scheme})`, async ({ page }) => {
      const errors = collectErrors(page);
      await skipIntro(page);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('#/list');

      await expect(page.locator('.list-view')).toBeVisible();
      await expectNoA11yViolations(page, `List view (${scheme})`);

      expect(errors).toEqual([]);
    });

    test(`Details dialog has no serious or critical axe violations (${scheme})`, async ({
      page,
    }) => {
      const errors = collectErrors(page);
      await skipIntro(page);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');

      await page.locator('.game-card button[data-action="details"]').click();
      await expect(page.locator('.dialog--details')).toBeVisible();
      await expectNoA11yViolations(page, `Details dialog (${scheme})`);

      expect(errors).toEqual([]);
    });

    test(`Records page has no serious or critical axe violations (${scheme})`, async ({ page }) => {
      const errors = collectErrors(page);
      await skipIntro(page);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('#/records');

      await expect(page.locator('.page--records')).toBeVisible();
      await expectNoA11yViolations(page, `Records page (${scheme})`);

      expect(errors).toEqual([]);
    });

    test(`About page has no serious or critical axe violations (${scheme})`, async ({ page }) => {
      const errors = collectErrors(page);
      await skipIntro(page);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('#/about');

      await expect(page.locator('.page--about')).toBeVisible();
      await expectNoA11yViolations(page, `About page (${scheme})`);

      expect(errors).toEqual([]);
    });

    test(`Settings dialog has no serious or critical axe violations (${scheme})`, async ({
      page,
    }) => {
      const errors = collectErrors(page);
      await skipIntro(page);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');

      await page.locator('.topbar button[data-action="settings"]').click();
      await expect(page.locator('.dialog--settings')).toBeVisible();
      await expectNoA11yViolations(page, `Settings dialog (${scheme})`);

      expect(errors).toEqual([]);
    });
  }
});
