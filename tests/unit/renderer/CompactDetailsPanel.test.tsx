import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import CompactDetailsPanel from '../../../src/renderer/components/hud/CompactDetailsPanel';
import type { Hero, WorldEntity } from '../../../src/shared/types';

const createHero = (overrides?: Partial<Hero>): WorldEntity =>
  ({
    id: 'hero',
    name: 'Hero',
    provider: 'claude',
    model: '',
    x: 100,
    y: 100,
    type: 'hero',
    entityKind: 'unit',
    ...overrides,
  }) as WorldEntity;

describe('CompactDetailsPanel', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test('stops automatic model lookup retries after an initial failure', async () => {
    const lookupMock = vi
      .spyOn(window.electronAPI, 'agentConnectModelsRecent')
      .mockRejectedValue(new Error('provider unavailable'));

    render(<CompactDetailsPanel entity={createHero()} terminalProcess={null} />);

    await waitFor(() => {
      expect(lookupMock).toHaveBeenCalledTimes(1);
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(lookupMock).toHaveBeenCalledTimes(1);
  });

  test('includes a default option when hero model is empty and provider models are present', async () => {
    vi.spyOn(window.electronAPI, 'agentConnectModelsRecent').mockResolvedValue([
      {
        id: 'claude-opus-4-6',
        provider: 'claude',
        displayName: 'claude-opus-4-6',
      },
    ]);
    const onHeroModelCommit = vi.fn().mockResolvedValue({ ok: false, error: 'model set failed' });

    render(
      <CompactDetailsPanel
        entity={createHero({ model: '' })}
        terminalProcess={null}
        onHeroModelCommit={onHeroModelCommit}
      />
    );

    await waitFor(() => {
      expect(onHeroModelCommit).toHaveBeenCalledWith('claude-opus-4-6');
    });

    const select = screen.getByLabelText('Hero model') as HTMLSelectElement;
    expect(select.value).toBe('');
    expect(within(select).getByRole('option', { name: 'default' })).toHaveValue('');
  });
});
