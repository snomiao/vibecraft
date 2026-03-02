import { expect, test, type Page } from '@playwright/test';
import { launchTestAppWithMockServer } from '../utils';

test.setTimeout(60_000);

const enterWorkspace = async (page: Page): Promise<void> => {
  await page.getByTestId('home-select-world').click();
  const worldItem = page.locator('[data-workspace-id]').first();
  await worldItem.click();
  await expect(page.getByTestId('workspace-canvas')).toBeVisible();
};

const openSettings = async (page: Page): Promise<void> => {
  await page.getByTestId('home-settings').click();
  await expect(page.locator('.settings-screen')).toBeVisible();
};

test.describe('Subscription Flow - License Gate Details', () => {
  test('license gate shows pairing option for existing subscribers', async () => {
    const { page, cleanup } = await launchTestAppWithMockServer({
      tutorialMode: false,
      mockServerScenario: 'expired',
    });

    try {
      await enterWorkspace(page);

      const licenseGate = page.locator('.license-gate-overlay');
      await expect(licenseGate).toBeVisible();

      const pairingLink = page.getByText('Already subscribed on another device?');
      await expect(pairingLink).toBeVisible();
      await pairingLink.click();

      await expect(page.getByLabel(/Pairing code/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Link device/i })).toBeVisible();
    } finally {
      await cleanup();
    }
  });
});

test.describe('Subscription Flow - Plan Selection', () => {
  test('annual plan is selected by default', async () => {
    const { page, cleanup } = await launchTestAppWithMockServer({
      tutorialMode: false,
      mockServerScenario: 'expired',
    });

    try {
      await enterWorkspace(page);

      await expect(page.locator('.license-gate-overlay')).toBeVisible();
      const planSelector = page.locator('.plan-selector');
      await expect(planSelector).toBeVisible();

      const annualCard = planSelector.locator('.plan-card').filter({ hasText: /year/i });
      await expect(annualCard).toHaveClass(/selected/);
    } finally {
      await cleanup();
    }
  });

  test('clicking monthly plan changes selection', async () => {
    const { page, cleanup } = await launchTestAppWithMockServer({
      tutorialMode: false,
      mockServerScenario: 'expired',
    });

    try {
      await enterWorkspace(page);

      await expect(page.locator('.license-gate-overlay')).toBeVisible();

      const planSelector = page.locator('.plan-selector');
      const monthlyCard = planSelector.getByRole('button', { name: /^Monthly/i });
      await monthlyCard.click();
      await expect(monthlyCard).toHaveClass(/selected/);

      const annualCard = planSelector.getByRole('button', { name: /Yearly/i });
      await expect(annualCard).not.toHaveClass(/selected/);
    } finally {
      await cleanup();
    }
  });
});

test.describe('Subscription Flow - Subscribe Overlay', () => {
  test('subscribe overlay can be dismissed', async () => {
    const { page, cleanup } = await launchTestAppWithMockServer({
      tutorialMode: false,
      mockServerScenario: 'trial',
    });

    try {
      await enterWorkspace(page);

      const trialBanner = page.locator('.trial-banner');
      await expect(trialBanner).toBeVisible();
      await trialBanner.locator('.trial-banner-subscribe').click();

      const overlay = page.locator('.subscribe-overlay');
      await expect(overlay).toBeVisible();

      await overlay.locator('.subscribe-close').click();
      await expect(overlay).toBeHidden();
    } finally {
      await cleanup();
    }
  });

  test('subscribe button shows pending state during checkout', async () => {
    const { page, cleanup } = await launchTestAppWithMockServer({
      tutorialMode: false,
      mockServerScenario: 'trial',
    });

    try {
      await enterWorkspace(page);

      const trialBanner = page.locator('.trial-banner');
      await expect(trialBanner).toBeVisible();
      await trialBanner.locator('.trial-banner-subscribe').click();

      const overlay = page.locator('.subscribe-overlay');
      await expect(overlay).toBeVisible();

      const subscribeButton = overlay.locator('.subscribe-button');
      await subscribeButton.click();

      await expect(subscribeButton).toContainText(/Opening checkout/i);
      await expect(subscribeButton).toBeDisabled();
    } finally {
      await cleanup();
    }
  });
});

test.describe('Subscription Flow - Settings Screen', () => {
  test('navigates to settings from home screen', async () => {
    const { page, cleanup } = await launchTestAppWithMockServer({
      tutorialMode: false,
      mockServerScenario: 'trial',
    });

    try {
      const settingsButton = page.getByTestId('home-settings');
      await expect(settingsButton).toBeVisible();
      await settingsButton.click();

      await expect(page.locator('.settings-screen')).toBeVisible();
      await expect(page.locator('.settings-header h1')).toContainText('Settings');
    } finally {
      await cleanup();
    }
  });

  test('settings button is hidden during tutorial', async () => {
    const { page, cleanup } = await launchTestAppWithMockServer({
      tutorialMode: true,
      mockServerScenario: 'trial',
    });

    try {
      const settingsButton = page.getByTestId('home-settings');
      await expect(settingsButton).toBeHidden();
      await expect(page.getByTestId('home-select-world')).toBeVisible();
    } finally {
      await cleanup();
    }
  });

  test('settings shows subscription status card with trial badge', async () => {
    const { page, cleanup } = await launchTestAppWithMockServer({
      tutorialMode: false,
      mockServerScenario: 'trial',
    });

    try {
      await openSettings(page);

      const statusBadge = page.locator('.settings-badge');
      await expect(statusBadge).toBeVisible();
      await expect(statusBadge).toContainText(/Trial/i);
    } finally {
      await cleanup();
    }
  });

  test('settings shows active badge for subscribers', async () => {
    const { page, cleanup } = await launchTestAppWithMockServer({
      tutorialMode: false,
      mockServerScenario: 'subscribed',
    });

    try {
      await openSettings(page);

      const statusBadge = page.locator('.settings-badge');
      await expect(statusBadge).toBeVisible();
      await expect(statusBadge).toContainText(/Active/i);
    } finally {
      await cleanup();
    }
  });

  test('settings shows subscribe section when not subscribed', async () => {
    const { page, cleanup } = await launchTestAppWithMockServer({
      tutorialMode: false,
      mockServerScenario: 'trial',
    });

    try {
      await openSettings(page);

      const subscribeSection = page.locator('.settings-card').filter({
        has: page.locator('.settings-card-title h3', { hasText: 'Subscribe' }),
      });
      await expect(subscribeSection).toBeVisible();

      await expect(page.locator('.plan-selector')).toBeVisible();
      await expect(page.locator('.settings-primary-btn')).toContainText(/Subscribe/i);
    } finally {
      await cleanup();
    }
  });

  test('settings hides subscribe section for active subscribers', async () => {
    const { page, cleanup } = await launchTestAppWithMockServer({
      tutorialMode: false,
      mockServerScenario: 'subscribed',
    });

    try {
      await openSettings(page);

      const subscribeSection = page.locator('.settings-card').filter({
        has: page.locator('.settings-card-title h3', { hasText: 'Subscribe' }),
      });
      await expect(subscribeSection).toBeHidden();
    } finally {
      await cleanup();
    }
  });

  test('settings shows manage billing for subscribers', async () => {
    const { page, cleanup } = await launchTestAppWithMockServer({
      tutorialMode: false,
      mockServerScenario: 'subscribed',
    });

    try {
      await openSettings(page);

      const manageBillingBtn = page.locator('.settings-link-btn', { hasText: /Manage billing/i });
      await expect(manageBillingBtn).toBeVisible();
    } finally {
      await cleanup();
    }
  });

  test('device pairing section expands and collapses', async () => {
    const { page, cleanup } = await launchTestAppWithMockServer({
      tutorialMode: false,
      mockServerScenario: 'trial',
    });

    try {
      await openSettings(page);

      const pairingHeader = page.locator('.settings-expandable-header');
      await expect(pairingHeader).toBeVisible();

      const pairingContent = page.locator('.settings-expandable-content');
      await expect(pairingContent).toBeHidden();

      await pairingHeader.click();
      await expect(pairingContent).toBeVisible();

      await pairingHeader.click();
      await expect(pairingContent).toBeHidden();
    } finally {
      await cleanup();
    }
  });

  test('non-subscriber can enter pairing code', async () => {
    const { page, cleanup } = await launchTestAppWithMockServer({
      tutorialMode: false,
      mockServerScenario: 'trial',
    });

    try {
      await openSettings(page);

      await page.locator('.settings-expandable-header').click();

      const pairingInput = page.locator('.settings-pairing-input input');
      await expect(pairingInput).toBeVisible();

      await pairingInput.fill('ABCD-1234');
      const linkButton = page.getByRole('button', { name: /Link/i });
      await expect(linkButton).toBeEnabled();
    } finally {
      await cleanup();
    }
  });

  test('subscriber can generate pairing code', async () => {
    const { page, cleanup } = await launchTestAppWithMockServer({
      tutorialMode: false,
      mockServerScenario: 'subscribed',
    });

    try {
      await openSettings(page);

      await page.locator('.settings-expandable-header').click();

      await expect(page.locator('.settings-device-count')).toBeVisible();
      const generateButton = page.getByRole('button', { name: /Generate code/i });
      await expect(generateButton).toBeVisible();
    } finally {
      await cleanup();
    }
  });

  test('home button in titlebar navigates back from settings', async () => {
    const { page, cleanup } = await launchTestAppWithMockServer({
      tutorialMode: false,
      mockServerScenario: 'trial',
    });

    try {
      await openSettings(page);

      const homeButton = page.locator('.titlebar-home-btn');
      await homeButton.click();

      await expect(page.locator('.home-screen')).toBeVisible();
      await expect(page.locator('.settings-screen')).toBeHidden();
    } finally {
      await cleanup();
    }
  });
});
