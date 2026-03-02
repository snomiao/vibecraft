import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import TerminalEntity from '../../../src/renderer/components/canvas/TerminalEntity';

const getXtermInstances = (): Array<{
  write: (data: string) => void;
}> =>
  (globalThis as unknown as { __xtermInstances?: Array<{ write: (data: string) => void }> })
    .__xtermInstances ?? [];

vi.mock('xterm', () => {
  class Terminal {
    options = { disableStdin: false };
    cols = 80;
    rows = 24;
    write = vi.fn();
    private onDataHandler: ((data: string) => void) | null = null;

    constructor() {
      const global = globalThis as unknown as { __xtermInstances?: Terminal[] };
      if (!global.__xtermInstances) {
        global.__xtermInstances = [];
      }
      global.__xtermInstances.push(this);
    }

    open() {}
    loadAddon() {}
    onData(handler: (data: string) => void) {
      this.onDataHandler = handler;
      return { dispose: () => {} };
    }
    focus() {}
    dispose() {}
  }

  return { Terminal };
});

vi.mock('xterm-addon-fit', () => {
  class FitAddon {
    fit = vi.fn();
  }
  return { FitAddon };
});

vi.mock('../../../src/renderer/hooks/useXtermMouseScaleFix', () => ({
  useXtermMouseScaleFix: () => {},
}));

beforeEach(() => {
  (globalThis as unknown as { __xtermInstances?: unknown[] }).__xtermInstances = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0);
    return 0;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TerminalEntity persistence', () => {
  test('restores history and starts a session on mount', async () => {
    const history = 'restored history';
    window.electronAPI.getTerminalHistory = vi.fn(async () => ({ success: true, history }));
    window.electronAPI.startTerminalSession = vi.fn(async () => ({ success: true, sessionToken: 'token-1' }));

    render(
      <TerminalEntity
        terminalId="terminal-1"
        workspacePath="/tmp/workspace"
        originName="Terminal"
        startPath="project"
        x={0}
        y={0}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(window.electronAPI.startTerminalSession).toHaveBeenCalled();
    });

    const [call] = (window.electronAPI.startTerminalSession as ReturnType<typeof vi.fn>).mock.calls as Array<
      [unknown]
    >;
    expect(call?.[0]).toMatchObject({
      terminalId: 'terminal-1',
      workspacePath: '/tmp/workspace',
      relativePath: 'project',
      cols: 80,
      rows: 24,
      reuseIfRunning: true,
    });

    const [terminal] = getXtermInstances();
    expect(terminal).toBeTruthy();
    expect(terminal.write).toHaveBeenCalledWith(history);
  });

  test('falls back to workspace root when start path fails and persists cwd', async () => {
    type StartSessionArgs = Parameters<typeof window.electronAPI.startTerminalSession>[0];
    type StartSessionResult = Awaited<ReturnType<typeof window.electronAPI.startTerminalSession>>;
    const startTerminalSession = vi.fn((payload: StartSessionArgs) => {
      void payload;
      return Promise.resolve({ success: true, sessionToken: 'token-2' } as StartSessionResult);
    });
    startTerminalSession
      .mockResolvedValueOnce({ success: false, error: 'Folder path missing' })
      .mockResolvedValueOnce({ success: true, sessionToken: 'token-2' });
    window.electronAPI.startTerminalSession = startTerminalSession;
    window.electronAPI.updateTerminal = vi.fn(async () => ({ success: true }));
    window.electronAPI.getTerminalHistory = vi.fn(async () => ({ success: true, history: '' }));

    render(
      <TerminalEntity
        terminalId="terminal-2"
        workspacePath="/tmp/workspace"
        originName="Terminal"
        startPath="missing/path"
        x={0}
        y={0}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(startTerminalSession).toHaveBeenCalledTimes(2);
    });

    expect(startTerminalSession.mock.calls[0]?.[0]).toMatchObject({
      terminalId: 'terminal-2',
      relativePath: 'missing/path',
      reuseIfRunning: true,
    });
    expect(startTerminalSession.mock.calls[1]?.[0]).toMatchObject({
      terminalId: 'terminal-2',
      relativePath: '.',
      reuseIfRunning: true,
    });

    await waitFor(() => {
      expect(window.electronAPI.updateTerminal).toHaveBeenCalledWith('/tmp/workspace', 'terminal-2', {
        lastKnownCwd: '.',
      });
    });
  });

  test('reattaches when remounting the terminal view', async () => {
    type StartSessionArgs = Parameters<typeof window.electronAPI.startTerminalSession>[0];
    const startTerminalSession = vi.fn((payload: StartSessionArgs) => {
      void payload;
      return Promise.resolve({ success: true, sessionToken: 'token-3' });
    });
    window.electronAPI.startTerminalSession = startTerminalSession;
    window.electronAPI.getTerminalHistory = vi.fn(async () => ({ success: true, history: '' }));

    const { unmount } = render(
      <TerminalEntity
        terminalId="terminal-3"
        workspacePath="/tmp/workspace"
        originName="Terminal"
        startPath="project"
        x={0}
        y={0}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(startTerminalSession).toHaveBeenCalledTimes(1);
    });

    unmount();
    render(
      <TerminalEntity
        terminalId="terminal-3"
        workspacePath="/tmp/workspace"
        originName="Terminal"
        startPath="project"
        x={0}
        y={0}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(startTerminalSession).toHaveBeenCalledTimes(2);
    });

    const calls = startTerminalSession.mock.calls as Array<[StartSessionArgs]>;
    expect(calls[0]?.[0]).toMatchObject({ reuseIfRunning: true });
    expect(calls[1]?.[0]).toMatchObject({ reuseIfRunning: true });
  });
});
