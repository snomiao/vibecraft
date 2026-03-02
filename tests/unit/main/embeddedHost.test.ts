import { beforeEach, describe, expect, test, vi } from 'vitest';

const requestMock = vi.fn();
const eventHandlers = new Set<(notification: { method: string; params?: Record<string, unknown> }) => void>();

vi.mock('@agentconnect/host', () => ({
  createHostBridge: () => ({
    request: requestMock,
    onEvent: (handler: (notification: { method: string; params?: Record<string, unknown> }) => void) => {
      eventHandlers.add(handler);
      return () => {
        eventHandlers.delete(handler);
      };
    },
  }),
}));

describe('embedded host', () => {
  beforeEach(() => {
    requestMock.mockReset();
    eventHandlers.clear();
    vi.resetModules();
  });

  test('runProviderPrompt falls back to create when resume session is missing', async () => {
    requestMock.mockImplementation(async (method: string) => {
      if (method === 'acp.sessions.resume') {
        throw new Error('AC_ERR_INVALID_ARGS: Unknown session');
      }
      if (method === 'acp.sessions.create') {
        return { sessionId: 'sess-new' };
      }
      if (method === 'acp.sessions.send') {
        for (const handler of eventHandlers) {
          handler({
            method: 'acp.session.event',
            params: { sessionId: 'sess-new', type: 'final', data: {} },
          });
          handler({
            method: 'acp.session.event',
            params: {
              sessionId: 'sess-new',
              type: 'summary',
              data: { summary: 'Summary', source: 'prompt' },
            },
          });
        }
        return { accepted: true };
      }
      throw new Error(`Unexpected method: ${method}`);
    });

    const { runProviderPrompt } = await import('../../../src/main/services/agentConnect/embeddedHost');

    const result = await runProviderPrompt(
      'claude',
      { prompt: 'Hello', resumeSessionId: 'sess-old' },
      () => {}
    );

    expect(result.sessionId).toBe('sess-new');
    expect(requestMock.mock.calls.map((call) => call[0])).toEqual([
      'acp.sessions.resume',
      'acp.sessions.create',
      'acp.sessions.send',
    ]);
    expect(requestMock).toHaveBeenCalledWith(
      'acp.sessions.create',
      expect.objectContaining({ provider: 'claude', mcpServers: null })
    );
    expect(requestMock).toHaveBeenCalledWith(
      'acp.sessions.resume',
      expect.objectContaining({ sessionId: 'sess-old', mcpServers: null })
    );
    expect(requestMock).toHaveBeenCalledWith(
      'acp.sessions.send',
      expect.objectContaining({ sessionId: 'sess-new', mcpServers: null })
    );
  });

  test('runProviderPrompt forwards mcpServers to create and send requests', async () => {
    requestMock.mockImplementation(async (method: string) => {
      if (method === 'acp.sessions.create') {
        return { sessionId: 'sess-new' };
      }
      if (method === 'acp.sessions.send') {
        for (const handler of eventHandlers) {
          handler({
            method: 'acp.session.event',
            params: { sessionId: 'sess-new', type: 'final', data: {} },
          });
          handler({
            method: 'acp.session.event',
            params: {
              sessionId: 'sess-new',
              type: 'summary',
              data: { summary: 'Summary', source: 'prompt' },
            },
          });
        }
        return { accepted: true };
      }
      throw new Error(`Unexpected method: ${method}`);
    });

    const { runProviderPrompt } = await import('../../../src/main/services/agentConnect/embeddedHost');
    const mcpServers = {
      'vibecraft-core': {
        command: 'node',
        args: ['vibecraft/scripts/vibecraft-mcp.mjs'],
      },
    };

    const result = await runProviderPrompt(
      'claude',
      {
        prompt: 'Hello',
        mcpServers,
      },
      () => {}
    );

    expect(result.sessionId).toBe('sess-new');
    expect(requestMock).toHaveBeenCalledWith(
      'acp.sessions.create',
      expect.objectContaining({ provider: 'claude', mcpServers })
    );
    expect(requestMock).toHaveBeenCalledWith(
      'acp.sessions.send',
      expect.objectContaining({ sessionId: 'sess-new', mcpServers })
    );
  });

  test('runProviderPrompt forwards system prompt to create and resume requests', async () => {
    requestMock.mockImplementation(async (method: string) => {
      if (method === 'acp.sessions.resume') {
        return { sessionId: 'sess-existing' };
      }
      if (method === 'acp.sessions.send') {
        for (const handler of eventHandlers) {
          handler({
            method: 'acp.session.event',
            params: { sessionId: 'sess-existing', type: 'final', data: {} },
          });
          handler({
            method: 'acp.session.event',
            params: {
              sessionId: 'sess-existing',
              type: 'summary',
              data: { summary: 'Summary', source: 'prompt' },
            },
          });
        }
        return { accepted: true };
      }
      throw new Error(`Unexpected method: ${method}`);
    });

    const { runProviderPrompt } = await import('../../../src/main/services/agentConnect/embeddedHost');
    const system = 'Hero instructions';

    const result = await runProviderPrompt(
      'claude',
      {
        prompt: 'Hello',
        resumeSessionId: 'sess-existing',
        system,
      },
      () => {}
    );

    expect(result.sessionId).toBe('sess-existing');
    expect(requestMock).toHaveBeenCalledWith(
      'acp.sessions.resume',
      expect.objectContaining({ sessionId: 'sess-existing', system })
    );
    expect(requestMock).toHaveBeenCalledWith(
      'acp.sessions.send',
      expect.objectContaining({ sessionId: 'sess-existing' })
    );
  });
});
