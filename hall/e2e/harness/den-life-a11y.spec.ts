/**
 * End-to-end accessibility audits using axe-core across Den Life views and dialogs.
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

test.describe('Den Life accessibility audits', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`Jacket screen has no serious or critical axe violations (${scheme})`, async ({
      page,
    }) => {
      const errors = collectErrors(page);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/harness.html?showcase=full#/jacket');

      await expect(page.locator('.jacket-screen')).toBeVisible();
      await expectNoA11yViolations(page, `Jacket screen (${scheme})`);

      expect(errors).toEqual([]);
    });

    test(`Kids screen has no serious or critical axe violations (${scheme})`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/harness.html?showcase=mid#/kids');

      await expect(page.locator('.kids-screen')).toBeVisible();
      await expectNoA11yViolations(page, `Kids screen (${scheme})`);

      expect(errors).toEqual([]);
    });

    test(`Versus Night screen has no serious or critical axe violations (${scheme})`, async ({
      page,
    }) => {
      const errors = collectErrors(page);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/harness.html?showcase=full#/versus');

      await expect(page.locator('.versus-screen')).toBeVisible();
      await expectNoA11yViolations(page, `Versus Night screen (${scheme})`);

      expect(errors).toEqual([]);
    });

    test(`Versus setup form has no serious or critical axe violations (${scheme})`, async ({
      page,
    }) => {
      const errors = collectErrors(page);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/harness.html?showcase=new#/versus');

      await expect(page.locator('.versus-setup')).toBeVisible();
      await expectNoA11yViolations(page, `Versus setup form (${scheme})`);

      expect(errors).toEqual([]);
    });

    test(`Calendar dialog has no serious or critical axe violations (${scheme})`, async ({
      page,
    }) => {
      const errors = collectErrors(page);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/harness.html?showcase=full#/');

      await expect(page.locator('.den')).toBeVisible();
      await page.locator('[data-ref="calendar"]').click();
      await expect(page.locator('.dialog--calendar')).toBeVisible();
      await expectNoA11yViolations(page, `Calendar dialog (${scheme})`);

      expect(errors).toEqual([]);
    });

    test(`Channel dial has no serious or critical axe violations (${scheme})`, async ({ page }) => {
      const errors = collectErrors(page);
      await skipIntro(page);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/harness.html#/play/test-catch-1');

      await expect(page.locator('.play-view')).toBeVisible();
      await page.locator('.play-channel').click();
      await expect(page.locator('.dialog--dial')).toBeVisible();
      await expectNoA11yViolations(page, `Channel dial (${scheme})`);

      expect(errors).toEqual([]);
    });

    test(`Patch up-close dialog has no serious or critical axe violations (${scheme})`, async ({
      page,
    }) => {
      const errors = collectErrors(page);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/harness.html?showcase=full#/jacket');

      await expect(page.locator('.jacket-screen')).toBeVisible();
      await page.locator('.sewn-patch').first().click();
      await expect(page.locator('.dialog--patch')).toBeVisible();
      await expectNoA11yViolations(page, `Patch dialog (${scheme})`);

      expect(errors).toEqual([]);
    });
  }
});
