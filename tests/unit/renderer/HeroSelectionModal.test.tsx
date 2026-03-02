import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { ProviderRegistrySnapshot } from '../../../src/shared/types';
import HeroSelectionModal from '../../../src/renderer/components/HeroSelectionModal';

const buildSnapshot = (overrides: Partial<ProviderRegistrySnapshot> = {}): ProviderRegistrySnapshot => ({
  providers: [
    { id: 'claude', name: 'Claude' },
    { id: 'codex', name: 'Codex' },
  ],
  providerStatus: {
    claude: { providerId: 'claude', state: 'missing', installed: false },
    codex: { providerId: 'codex', state: 'ready', installed: true },
  },
  recentModels: {},
  recentModelInfo: {},
  loading: false,
  updatedAt: Date.now(),
  ...overrides,
});

describe('HeroSelectionModal', () => {
  afterEach(() => {
    cleanup();
  });

  test('confirms the selected provider', async () => {
    const onConfirmProvider = vi.fn(async () => ({ ok: true }));
    const onInstallProvider = vi.fn(async () => ({ ok: true }));
    const onLoginProvider = vi.fn(async () => ({ ok: true }));
    const onRefreshProviderStatus = vi.fn(async () => ({ ok: true }));

    render(
      <HeroSelectionModal
        open
        providerSnapshot={buildSnapshot()}
        onConfirmProvider={onConfirmProvider}
        onInstallProvider={onInstallProvider}
        onLoginProvider={onLoginProvider}
        onRefreshProviderStatus={onRefreshProviderStatus}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select Codex' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => {
      expect(onConfirmProvider).toHaveBeenCalledWith('codex');
    });
  });

  test('installs a provider and refreshes status', async () => {
    const onConfirmProvider = vi.fn(async () => ({ ok: true }));
    const onInstallProvider = vi.fn(async () => ({ ok: true }));
    const onLoginProvider = vi.fn(async () => ({ ok: true }));
    const onRefreshProviderStatus = vi.fn(async () => ({ ok: true }));

    render(
      <HeroSelectionModal
        open
        providerSnapshot={buildSnapshot()}
        onConfirmProvider={onConfirmProvider}
        onInstallProvider={onInstallProvider}
        onLoginProvider={onLoginProvider}
        onRefreshProviderStatus={onRefreshProviderStatus}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Install Claude' }));

    await waitFor(() => {
      expect(onInstallProvider).toHaveBeenCalledWith('claude');
    });

    await waitFor(() => {
      expect(onRefreshProviderStatus).toHaveBeenCalledWith('claude', { force: true });
    });
  });
});
