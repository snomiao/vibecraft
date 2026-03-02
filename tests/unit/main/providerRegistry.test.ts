import { describe, expect, test, vi } from 'vitest';
import {
  createProviderRegistry,
  type ProviderRegistryClient,
  type ProviderRegistrySnapshot,
} from '../../../src/main/services/agentConnect/providerRegistry';

describe('provider registry', () => {
  test('initializes providers and status with cached refresh', async () => {
    const listMock = vi.fn().mockResolvedValue([
      { id: 'claude', name: 'Claude' },
      { id: 'codex', name: 'Codex' },
    ]);
    const statusMock = vi.fn().mockImplementation(async (providerId: string) => ({
      providerId,
      state: 'ready',
      installed: true,
    }));
    const recentMock = vi
      .fn()
      .mockImplementation(async (providerId: string) => [
        { id: `${providerId}-latest`, provider: providerId as 'claude' | 'codex' },
      ]);

    const client: ProviderRegistryClient = {
      providers: {
        list: listMock,
        status: statusMock,
      },
      models: {
        recent: recentMock,
      },
    };

    const updates: ProviderRegistrySnapshot[] = [];
    const registry = createProviderRegistry(client, {
      onUpdate: (snapshot) => updates.push(snapshot),
      cacheTtlMs: 1,
      refreshSpreadMs: 0,
    });

    await registry.initialize();

    const snapshot = registry.getSnapshot();
    expect(snapshot.loading).toBe(false);
    expect(snapshot.providers).toEqual([
      { id: 'claude', name: 'Claude' },
      { id: 'codex', name: 'Codex' },
    ]);
    expect(snapshot.providerStatus.claude).toEqual({
      providerId: 'claude',
      state: 'ready',
      installed: true,
    });
    expect(snapshot.providerStatus.codex).toEqual({
      providerId: 'codex',
      state: 'ready',
      installed: true,
    });
    expect(snapshot.recentModels.claude).toEqual(['claude-latest']);
    expect(snapshot.recentModels.codex).toEqual(['codex-latest']);
    expect(snapshot.recentModelInfo.claude).toEqual([{ id: 'claude-latest', provider: 'claude' }]);
    expect(snapshot.recentModelInfo.codex).toEqual([{ id: 'codex-latest', provider: 'codex' }]);
    expect(snapshot.updatedAt).not.toBeNull();

    expect(listMock).toHaveBeenCalledTimes(1);
    expect(statusMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(recentMock).toHaveBeenCalledTimes(2);
    expect(updates.length).toBeGreaterThan(0);
  });

  test('refreshes provider status on demand', async () => {
    const client: ProviderRegistryClient = {
      providers: {
        list: vi.fn().mockResolvedValue([]),
        status: vi.fn().mockResolvedValue({ providerId: 'cursor', state: 'installing' }),
      },
      models: {
        recent: vi.fn().mockResolvedValue([]),
      },
    };

    const registry = createProviderRegistry(client);

    const status = await registry.refreshProviderStatus('cursor');

    expect(status).toEqual({ providerId: 'cursor', state: 'installing' });
    expect(registry.getSnapshot().providerStatus.cursor).toEqual({
      providerId: 'cursor',
      state: 'installing',
    });
    expect(client.providers.list).not.toHaveBeenCalled();
  });
});
