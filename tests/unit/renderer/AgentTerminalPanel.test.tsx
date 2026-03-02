import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import AgentTerminalPanel from '../../../src/renderer/components/AgentTerminalPanel';
import type { CommandInvocation, CommandRunResult } from '../../../src/shared/commands';
import type { AgentConnectEventPayload } from '../../../src/shared/types';

afterEach(() => {
  cleanup();
});

describe('AgentTerminalPanel', () => {
  test('shows provider and model in the header dropdown and loads recent models eagerly', async () => {
    const modelsRecent = vi.fn(async () => [{ id: 'opus', provider: 'claude' as const }]);
    window.electronAPI.agentConnectModelsRecent = modelsRecent;

    render(
      <AgentTerminalPanel
        agentId="agent-0"
        agentName="Claude"
        agentProvider="claude"
        agentModel="sonnet-3.5"
        agentPresenceStatus="offline"
        workspacePath="/tmp/workspace"
        attachedRelativePath="project"
        runCommand={vi.fn(async () => ({ ok: true }))}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(modelsRecent).toHaveBeenCalledWith('claude', undefined);
    });

    await screen.findByRole('option', { name: 'Claude · sonnet-3.5' });
    await screen.findByRole('option', { name: 'Claude · opus' });
  });

  test('forces a background model refresh when the selector is focused', async () => {
    let resolveForced: (models: Array<{ id: string; provider: 'claude' }>) => void = () => {};
    const forcedPromise = new Promise<Array<{ id: string; provider: 'claude' }>>((resolve) => {
      resolveForced = resolve;
    });
    const modelsRecent = vi.fn(async (_provider: string, options?: { force?: boolean }) =>
      options?.force ? forcedPromise : [{ id: 'sonnet-3.5', provider: 'claude' as const }]
    );
    window.electronAPI.agentConnectModelsRecent = modelsRecent;

    render(
      <AgentTerminalPanel
        agentId="agent-refresh"
        agentName="Claude"
        agentProvider="claude"
        agentModel=""
        agentPresenceStatus="offline"
        workspacePath="/tmp/workspace"
        attachedRelativePath="project"
        runCommand={vi.fn(async () => ({ ok: true }))}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(modelsRecent).toHaveBeenCalledWith('claude', undefined);
    });

    const select = screen.getByLabelText('Agent model');
    await userEvent.click(select);

    await waitFor(() => {
      expect(modelsRecent).toHaveBeenCalledWith('claude', { force: true });
    });

    await screen.findByText('Updating…');

    resolveForced([{ id: 'opus', provider: 'claude' as const }]);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Claude · opus' })).toBeInTheDocument();
    });
  });

  test('retries model refresh after a forced refresh fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let forcedCalls = 0;
    const modelsRecent = vi.fn(async (_provider: string, options?: { force?: boolean }) => {
      if (!options?.force) {
        return [{ id: 'sonnet-3.5', provider: 'claude' as const }];
      }
      forcedCalls += 1;
      if (forcedCalls === 1) {
        throw new Error('forced refresh failed');
      }
      return [{ id: 'opus', provider: 'claude' as const }];
    });
    window.electronAPI.agentConnectModelsRecent = modelsRecent;

    try {
      render(
        <AgentTerminalPanel
          agentId="agent-refresh-retry"
          agentName="Claude"
          agentProvider="claude"
          agentModel=""
          agentPresenceStatus="offline"
          workspacePath="/tmp/workspace"
          attachedRelativePath="project"
          runCommand={vi.fn(async () => ({ ok: true }))}
          onClose={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(modelsRecent).toHaveBeenCalledWith('claude', undefined);
      });

      const select = screen.getByLabelText('Agent model');
      await userEvent.click(select);

      await waitFor(() => {
        expect(modelsRecent).toHaveBeenCalledWith('claude', { force: true });
      });

      await userEvent.click(select);

      await waitFor(() => {
        expect(modelsRecent).toHaveBeenCalledTimes(3);
      });
    } finally {
      errorSpy.mockRestore();
    }
  });

  test('renders a fixed overlay with a close button', () => {
    render(
      <AgentTerminalPanel
        agentId="agent-1"
        agentName="Claude"
        agentProvider="claude"
        agentModel="sonnet-3.5"
        agentPresenceStatus="offline"
        workspacePath="/tmp/workspace"
        attachedRelativePath="project"
        runCommand={vi.fn(async () => ({ ok: true }))}
        onClose={vi.fn()}
      />
    );

    const panel = screen.getByTestId('agent-terminal');
    expect(panel).toHaveStyle({
      position: 'fixed',
    });
    expect(panel.style.left).toBeTruthy();
    expect(panel.style.top).toBe('50px');
    expect(panel.style.width).toBeTruthy();
    expect(panel.style.height).toBeTruthy();

    expect(screen.getByRole('button', { name: 'Close agent terminal' })).toBeInTheDocument();
  });

  test('enables input when the agent is attached', () => {
    render(
      <AgentTerminalPanel
        agentId="agent-2"
        agentName="Codex"
        agentProvider="codex"
        agentModel="gpt-4o"
        agentPresenceStatus="offline"
        workspacePath="/tmp/workspace"
        attachedRelativePath="project"
        runCommand={vi.fn(async () => ({ ok: true }))}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('textbox')).toBeEnabled();
  });

  test('updates the agent model on selection change', async () => {
    window.electronAPI.agentConnectModelsRecent = vi.fn(async () => [
      { id: 'gpt-4o', provider: 'codex' as const },
    ]);
    const runCommand = vi.fn(async () => ({ ok: true }));

    render(
      <AgentTerminalPanel
        agentId="agent-3"
        agentName="Codex"
        agentProvider="codex"
        agentModel="gpt-4o-mini"
        agentPresenceStatus="offline"
        workspacePath="/tmp/workspace"
        attachedRelativePath="project"
        runCommand={runCommand}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(window.electronAPI.agentConnectModelsRecent).toHaveBeenCalledWith('codex', undefined);
    });

    await screen.findByRole('option', { name: 'Codex · gpt-4o' });
    const select = screen.getByLabelText('Agent model');
    await userEvent.selectOptions(select, 'gpt-4o');

    await waitFor(() => {
      expect(runCommand).toHaveBeenCalledWith({
        id: 'set-agent-model',
        source: 'ui',
        args: { agentId: 'agent-3', model: 'gpt-4o' },
      });
    });
  });

  test('shows reasoning options for codex models and updates selection', async () => {
    window.electronAPI.agentConnectModelsRecent = vi.fn(async () => [
      {
        id: 'gpt-4o',
        provider: 'codex' as const,
        reasoningEfforts: [
          { id: 'low', label: 'Low' },
          { id: 'high', label: 'High' },
        ],
        defaultReasoningEffort: 'low',
      },
    ]);
    const runCommand = vi.fn(async () => ({ ok: true }));

    render(
      <AgentTerminalPanel
        agentId="agent-4"
        agentName="Codex"
        agentProvider="codex"
        agentModel="gpt-4o"
        agentPresenceStatus="offline"
        workspacePath="/tmp/workspace"
        attachedRelativePath="project"
        runCommand={runCommand}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'High' })).toBeInTheDocument();
    });

    const select = screen.getByLabelText('Reasoning level');
    await userEvent.selectOptions(select, 'high');

    await waitFor(() => {
      expect(runCommand).toHaveBeenCalledWith({
        id: 'set-agent-reasoning-effort',
        source: 'ui',
        args: { agentId: 'agent-4', reasoningEffort: 'high' },
      });
    });
  });

  test('queues prompts while streaming and sends the next prompt after the run ends', async () => {
    let eventHandler: (payload: AgentConnectEventPayload) => void = () => {};
    window.electronAPI.onAgentConnectEvent = vi.fn((handler: (payload: AgentConnectEventPayload) => void) => {
      eventHandler = handler;
      return () => {};
    });

    const runCommand = vi.fn<(command: CommandInvocation) => Promise<CommandRunResult>>(
      () => new Promise<CommandRunResult>(() => {})
    );

    render(
      <AgentTerminalPanel
        agentId="agent-queue"
        agentName="Codex"
        agentProvider="codex"
        agentModel="gpt-4o"
        agentPresenceStatus="offline"
        workspacePath="/tmp/workspace"
        attachedRelativePath="project"
        runCommand={runCommand}
        onClose={vi.fn()}
      />
    );

    const input = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: 'Send' });

    await userEvent.type(input, 'First prompt');
    await userEvent.click(sendButton);

    await waitFor(() => {
      expect(runCommand).toHaveBeenCalledTimes(1);
    });

    expect(input).toBeEnabled();

    await userEvent.type(input, 'Second prompt');
    const queueButton = screen.getByRole('button', { name: 'Queue' });
    await userEvent.click(queueButton);

    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('');

    const firstCall = runCommand.mock.calls[0]?.[0];
    const runId = (firstCall?.args as { runId?: string } | undefined)?.runId ?? 'run-1';
    eventHandler({
      unit: { type: 'agent', id: 'agent-queue' },
      runId,
      event: { type: 'final' },
    });

    await waitFor(() => {
      expect(runCommand).toHaveBeenCalledTimes(2);
    });
  });

  test('keeps the cancel button visible after reopening when agent is working', () => {
    const props = {
      agentId: 'agent-working',
      agentName: 'Codex',
      agentProvider: 'codex' as const,
      agentModel: 'gpt-4o',
      agentPresenceStatus: 'working' as const,
      workspacePath: '/tmp/workspace',
      attachedRelativePath: 'project',
      runCommand: vi.fn(async () => ({ ok: true })),
      onClose: vi.fn(),
    };

    const { unmount } = render(<AgentTerminalPanel {...props} />);
    expect(screen.getByRole('button', { name: 'Cancel run' })).toBeInTheDocument();

    unmount();
    render(<AgentTerminalPanel {...props} />);
    expect(screen.getByRole('button', { name: 'Cancel run' })).toBeInTheDocument();
  });

  test('restores tool expansion state after closing and reopening', async () => {
    const entries = [
      {
        id: 'tool-1',
        type: 'tool' as const,
        title: 'Run build',
        input: 'bun build',
        output: 'ok',
        expanded: false,
      },
    ];
    let storedViewState = {
      expandedEntryIds: ['tool-1'],
      searchOpen: true,
      searchQuery: 'build',
      activeMatchIndex: 0,
      renderWindow: { start: 0, end: 1 },
      autoScrollPinned: false,
      scrollTop: 120,
      contextUsage: { context_window: 100, context_remaining_tokens: 80 },
      lastRunDuration: 5000,
      agentStatus: 'idle' as const,
      toolStatus: null,
      queuedPrompts: ['next'],
    };

    window.electronAPI.getAgentTerminalState = vi.fn(async () => ({
      success: true,
      state: { entries, viewState: storedViewState },
    }));
    window.electronAPI.setAgentTerminalState = vi.fn(async (_workspacePath, _agentId, state) => {
      storedViewState = { ...(storedViewState ?? {}), ...(state.viewState ?? {}) };
      return { success: true };
    });

    const props = {
      agentId: 'agent-view',
      agentName: 'Claude',
      agentProvider: 'claude' as const,
      agentModel: 'sonnet',
      agentPresenceStatus: 'offline' as const,
      workspacePath: '/tmp/workspace',
      attachedRelativePath: 'project',
      runCommand: vi.fn(async () => ({ ok: true })),
      onClose: vi.fn(),
    };

    const { unmount } = render(<AgentTerminalPanel {...props} />);

    const summary = await screen.findByText((_, node) => {
      return (
        node?.tagName.toLowerCase() === 'summary' &&
        (node.textContent?.toLowerCase().includes('bun build') ?? false)
      );
    });
    const details = summary.closest('details');
    expect(details?.open).toBe(true);

    await userEvent.click(summary);
    expect(details?.open).toBe(false);

    await waitFor(() => {
      expect(storedViewState.expandedEntryIds ?? []).not.toContain('tool-1');
    });

    unmount();
    render(<AgentTerminalPanel {...props} />);

    const summaryAfter = await screen.findByText((_, node) => {
      return (
        node?.tagName.toLowerCase() === 'summary' &&
        (node.textContent?.toLowerCase().includes('bun build') ?? false)
      );
    });
    const detailsAfter = summaryAfter.closest('details');
    expect(detailsAfter?.open).toBe(false);
  });
});
