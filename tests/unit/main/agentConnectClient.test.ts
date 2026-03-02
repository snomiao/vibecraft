import { describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listProviders: vi.fn(),
  getProviderStatus: vi.fn(),
  listRecentModelInfo: vi.fn(),
}));

vi.mock('../../../src/main/services/agentConnect/embeddedHost', () => ({
  listProviders: mocks.listProviders,
  getProviderStatus: mocks.getProviderStatus,
  listRecentModelInfo: mocks.listRecentModelInfo,
}));

describe('agent connect client', () => {
  test('proxies provider and model calls to the embedded host', async () => {
    const originalIntegration = process.env.VIBECRAFT_TEST_INTEGRATION;
    process.env.VIBECRAFT_TEST_INTEGRATION = '1';
    mocks.listProviders.mockResolvedValue([{ id: 'claude', name: 'Claude' }]);
    mocks.getProviderStatus.mockResolvedValue({
      providerId: 'claude',
      state: 'ready',
      installed: true,
    });
    mocks.listRecentModelInfo.mockResolvedValue([{ id: 'sonnet-3.5', provider: 'claude' }]);

    try {
      const { createAgentConnectClient } = await import('../../../src/main/services/agentConnect/client');
      const client = createAgentConnectClient();

      await expect(client.providers.list()).resolves.toEqual([{ id: 'claude', name: 'Claude' }]);
      await expect(client.providers.status('claude', { fast: true })).resolves.toEqual({
        providerId: 'claude',
        state: 'ready',
        installed: true,
      });
      await expect(client.models.recent('claude')).resolves.toEqual([
        { id: 'sonnet-3.5', provider: 'claude' },
      ]);

      expect(mocks.listProviders).toHaveBeenCalledTimes(1);
      expect(mocks.getProviderStatus).toHaveBeenCalledWith('claude', { fast: true });
      expect(mocks.listRecentModelInfo).toHaveBeenCalledWith('claude');
    } finally {
      if (originalIntegration === undefined) {
        delete process.env.VIBECRAFT_TEST_INTEGRATION;
      } else {
        process.env.VIBECRAFT_TEST_INTEGRATION = originalIntegration;
      }
    }
  });
});
