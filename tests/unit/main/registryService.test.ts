import { describe, expect, test, vi } from 'vitest';

const clientMocks = vi.hoisted(() => ({
  list: vi.fn(),
  status: vi.fn(),
  recent: vi.fn(),
}));

const storageMocks = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock('../../../src/main/services/agentConnect/client', () => ({
  createAgentConnectClient: () => ({
    providers: {
      list: clientMocks.list,
      status: clientMocks.status,
    },
    models: {
      recent: clientMocks.recent,
    },
  }),
}));

vi.mock('../../../src/main/services/storage', () => ({
  loadSettings: storageMocks.loadSettings,
  saveSettings: storageMocks.saveSettings,
}));

describe('agent connect registry service', () => {
  test('initializes registry from the agent connect client', async () => {
    clientMocks.list.mockResolvedValue([{ id: 'claude', name: 'Claude' }]);
    clientMocks.status.mockResolvedValue({
      providerId: 'claude',
      state: 'ready',
      installed: true,
    });
    clientMocks.recent.mockResolvedValue([{ id: 'sonnet-3.5', provider: 'claude' }]);
    storageMocks.loadSettings.mockReturnValue({});

    vi.resetModules();
    const { initializeProviderRegistry } =
      await import('../../../src/main/services/agentConnect/registryService');
    const registry = initializeProviderRegistry();

    await registry.initialize();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(clientMocks.list.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(clientMocks.status).toHaveBeenCalledWith('claude', { fast: true });
    expect(clientMocks.status.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(clientMocks.recent.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(storageMocks.saveSettings).toHaveBeenCalled();

    const snapshot = registry.getSnapshot();
    expect(snapshot.providers).toEqual([{ id: 'claude', name: 'Claude' }]);
    expect(snapshot.providerStatus.claude).toEqual({
      providerId: 'claude',
      state: 'ready',
      installed: true,
    });
    expect(snapshot.recentModels.claude).toEqual(['sonnet-3.5']);
    expect(snapshot.recentModels.codex).toBeUndefined();
    expect(snapshot.recentModelInfo.claude).toEqual([{ id: 'sonnet-3.5', provider: 'claude' }]);
    expect(snapshot.loading).toBe(false);
  });
});
