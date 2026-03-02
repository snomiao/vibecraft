import { expect, test } from '@playwright/test';
import { launchTestApp } from './utils';
import { isSupportedAgentProvider } from '../../src/shared/providers';
import type { AgentProvider, ProviderDescriptor } from '../../src/shared/types';

test.setTimeout(120_000);

test('provider registry refreshes in live integration mode', async () => {
  const { page, cleanup } = await launchTestApp({ integrationMode: true, startInWorkspace: true });
  page.setDefaultTimeout(15_000);

  try {
    await expect(page.getByTestId('workspace-canvas')).toBeVisible();

    const snapshot = await page.evaluate(async () => {
      return await window.electronAPI.agentConnectProvidersRefresh({ force: true });
    });

    const providers = snapshot.providers.filter(
      (provider): provider is ProviderDescriptor & { id: AgentProvider } =>
        isSupportedAgentProvider(provider.id)
    );

    expect(providers.length).toBeGreaterThan(0);

    const providerStatuses = await Promise.all(
      providers.map(async (provider) => {
        return await page.evaluate(async (providerId) => {
          return await window.electronAPI.agentConnectProviderStatus(providerId, { force: true });
        }, provider.id);
      })
    );

    const resolvedStatuses = providerStatuses.filter(Boolean);
    expect(resolvedStatuses.length).toBeGreaterThan(0);

    const providerForModels = providers.find((_, index) => {
      const status = providerStatuses[index];
      return status ? status.installed !== false : false;
    });

    if (providerForModels) {
      const models = await page.evaluate(async (id) => {
        return await window.electronAPI.agentConnectModelsRecent(id);
      }, providerForModels.id);
      expect(Array.isArray(models)).toBe(true);
    }
  } finally {
    await cleanup();
  }
});
