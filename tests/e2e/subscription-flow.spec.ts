import { expect, test } from '@playwright/test';
import { launchTestAppWithMockServer } from './utils';

test.setTimeout(60_000);

test.describe('Subscription Flow - Smoke', () => {
  test('trial users see banner and can open subscribe overlay', async () => {
    const { page, cleanup } = await launchTestAppWithMockServer({
      tutorialMode: false,
      mockServerScenario: 'trial',
      startInWorkspace: true,
    });

    try {
      const trialBanner = page.locator('.trial-banner');
      await expect(trialBanner).toBeVisible();
      await expect(trialBanner).toContainText(/remaining/i);

      await trialBanner.locator('.trial-banner-subscribe').click();
      await expect(page.locator('.subscribe-overlay')).toBeVisible();
    } finally {
      await cleanup();
    }
  });

  test('expired users see license gate with plans', async () => {
    const { page, cleanup } = await launchTestAppWithMockServer({
      tutorialMode: false,
      mockServerScenario: 'expired',
      startInWorkspace: true,
    });

    try {
      const licenseGate = page.locator('.license-gate-overlay');
      await expect(licenseGate).toBeVisible();
      await expect(page.locator('.plan-selector')).toBeVisible();
      await expect(page.locator('.plan-card')).toHaveCount(2);
      await expect(page.getByRole('button', { name: /^Subscribe$/i })).toBeVisible();
    } finally {
      await cleanup();
    }
  });

  test('subscribed users enter workspace without license gate', async () => {
    const { page, cleanup } = await launchTestAppWithMockServer({
      tutorialMode: false,
      mockServerScenario: 'subscribed',
      startInWorkspace: true,
    });

    try {
      await expect(page.locator('.license-gate-overlay')).toBeHidden();
      await expect(page.locator('.trial-banner')).toBeHidden();
    } finally {
      await cleanup();
    }
  });
});
