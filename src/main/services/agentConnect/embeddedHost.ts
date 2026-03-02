import type {
  AgentConnectBridge,
  ProviderId,
  ProviderInfo,
  SessionEvent,
  ModelInfo,
} from '@agentconnect/host';
import { createHostBridge } from '@agentconnect/host';
import { app } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { logger } from '../../logger';
import type {
  AgentModelInfo,
  AgentProvider,
  McpServerConfig,
  ProviderDescriptor,
  ProviderStatus,
} from '../../../shared/types';
import { isSupportedAgentProvider } from '../../../shared/providers';

type RunPromptOptions = {
  prompt: string;
  resumeSessionId?: string | null;
  model?: string;
  reasoningEffort?: string;
  system?: string;
  mcpServers?: Record<string, McpServerConfig>;
  repoRoot?: string;
  cwd?: string;
  signal?: AbortSignal;
};
type RunPromptResult = { sessionId: string | null };

const log = logger.scope('agentconnect:embedded');

let bridge: AgentConnectBridge | null = null;
let bridgeUnsubscribe: (() => void) | null = null;
const sessionListeners = new Map<string, Set<(event: SessionEvent) => void>>();

const ensureUserPath = (): void => {
  const delimiter = path.delimiter;
  const existing = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  const seen = new Set<string>();
  const home = os.homedir();
  const preferred = [
    path.join(home, '.bun', 'bin'),
    path.join(home, '.local', 'bin'),
    path.join(home, '.cargo', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
  ];
  const next: string[] = [];
  const appendExisting = () => {
    for (const entry of existing) {
      if (!entry || seen.has(entry)) continue;
      next.push(entry);
      seen.add(entry);
    }
  };
  const appendPreferredMissing = () => {
    for (const candidate of preferred) {
      if (seen.has(candidate)) continue;
      if (fs.existsSync(candidate)) {
        next.push(candidate);
        seen.add(candidate);
      }
    }
  };
  if (existing.length > 0) {
    appendExisting();
    appendPreferredMissing();
  } else {
    appendPreferredMissing();
  }
  process.env.PATH = next.join(delimiter);
};

const resolveAgentConnectBasePath = (): string => {
  let basePath = '';
  if (typeof app?.getPath === 'function') {
    basePath = app.getPath('userData');
  }
  if (!basePath) {
    basePath = path.join(os.tmpdir(), 'vibecraft-agentconnect');
  }
  fs.mkdirSync(basePath, { recursive: true });
  return basePath;
};

const getBridge = (): AgentConnectBridge => {
  if (!bridge) {
    ensureUserPath();
    bridge = createHostBridge({
      mode: 'embedded',
      logSpawn: false,
      basePath: resolveAgentConnectBasePath(),
    });
  }
  if (!bridgeUnsubscribe && bridge.onEvent) {
    bridgeUnsubscribe = bridge.onEvent((notification) => {
      if (notification.method !== 'acp.session.event') return;
      const params = notification.params as
        | { sessionId?: string; type?: string; data?: Record<string, unknown> }
        | undefined;
      const sessionId = params?.sessionId;
      const type = params?.type;
      if (!sessionId || !type) return;
      const handlers = sessionListeners.get(sessionId);
      if (!handlers || handlers.size === 0) return;
      const event = { type, ...(params?.data ?? {}) } as SessionEvent;
      handlers.forEach((handler) => handler(event));
    });
  }
  return bridge;
};

const mapStatus = (info: ProviderInfo): ProviderStatus => {
  if (!info.installed) {
    return {
      providerId: info.id,
      state: 'missing',
      installed: false,
      message: info.updateMessage,
    };
  }
  if (info.updateInProgress) {
    return {
      providerId: info.id,
      state: 'installing',
      installed: true,
      message: info.updateMessage ?? 'Updating',
    };
  }
  if (!info.loggedIn) {
    return {
      providerId: info.id,
      state: 'error',
      installed: true,
      message: 'Login required',
    };
  }
  return {
    providerId: info.id,
    state: 'ready',
    installed: true,
    message: info.updateMessage,
  };
};

const request = async <T>(method: string, params?: Record<string, unknown>): Promise<T> => {
  const host = getBridge();
  return host.request(method, params) as Promise<T>;
};

const isUnknownSessionError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes('ac_err_invalid_args') && message.includes('unknown session');
};

const resolveSessionMcpServers = (
  mcpServers?: Record<string, McpServerConfig>
): Record<string, McpServerConfig> | null => {
  if (!mcpServers || Object.keys(mcpServers).length === 0) return null;
  return mcpServers;
};

export const listProviders = async (): Promise<ProviderDescriptor[]> => {
  const response = await request<{ providers?: ProviderInfo[] }>('acp.providers.list');
  const providers = (response.providers ?? []).filter((provider) => isSupportedAgentProvider(provider.id));
  return providers.map((provider) => ({ id: provider.id, name: provider.name }));
};

export const getProviderStatus = async (
  providerId: ProviderId | string,
  options?: { fast?: boolean; force?: boolean }
): Promise<ProviderStatus> => {
  try {
    const response = await request<{ provider: ProviderInfo }>('acp.providers.status', {
      provider: providerId,
      options,
    });
    return mapStatus(response.provider);
  } catch (error) {
    return {
      providerId,
      state: 'unknown',
      message: error instanceof Error ? error.message : 'Failed to load provider status',
    };
  }
};

export const ensureProviderInstalled = async (providerId: ProviderId | string): Promise<ProviderStatus> => {
  await request('acp.providers.ensureInstalled', { provider: providerId });
  const response = await request<{ provider: ProviderInfo }>('acp.providers.status', {
    provider: providerId,
  });
  return mapStatus(response.provider);
};

export const loginProvider = async (
  providerId: ProviderId | string,
  options?: Record<string, unknown>
): Promise<{ loggedIn: boolean }> => {
  const response = await request<{ loggedIn: boolean }>('acp.providers.login', {
    provider: providerId,
    options,
  });
  return response;
};

export const listRecentModelInfo = async (providerId: ProviderId | string): Promise<AgentModelInfo[]> => {
  const recentResponse = await request<{ models?: ModelInfo[] }>('acp.models.recent', {
    provider: providerId,
  });
  const recent = recentResponse.models ?? [];
  const normalize = (models: ModelInfo[]): AgentModelInfo[] =>
    models
      .filter((model) => isSupportedAgentProvider(model.provider))
      .map((model) => ({ ...model, provider: model.provider as AgentProvider }));

  let listed: ModelInfo[] = [];
  try {
    const listResponse = await request<{ models?: ModelInfo[] }>('acp.models.list', {
      provider: providerId,
    });
    listed = listResponse.models ?? [];
  } catch {
    if (recent.length > 0) {
      return normalize(recent);
    }
  }
  if (recent.length === 0) {
    return normalize(listed);
  }
  if (listed.length === 0) {
    return normalize(recent);
  }
  const listedById = new Map(listed.map((model) => [model.id, model]));
  const merged = recent.map((model) => listedById.get(model.id) ?? model);
  return normalize(merged);
};

export const resolveProviderForModel = async (model: string | undefined): Promise<ProviderId> => {
  if (!model) {
    throw new Error('Model is required to resolve provider');
  }
  const response = await request<{ model: ModelInfo }>('acp.models.info', { model });
  return response.model.provider;
};

export const runProviderPrompt = async (
  providerId: ProviderId,
  options: Omit<RunPromptOptions, 'onEvent'>,
  onEvent: (event: SessionEvent) => void,
  onSessionId?: (sessionId: string) => void
): Promise<RunPromptResult> => {
  const summaryWaitMs = 10000;
  const sessionId = options.resumeSessionId ?? null;
  const signal = options.signal;
  const abortHandler = signal ? () => void handleAbort() : null;
  let activeSessionId: string | null = null;
  let cancelRequested = false;
  let finished = false;
  let sawFinal = false;
  let sawSummary = false;
  let finalTimer: NodeJS.Timeout | null = null;
  let resolveDone: (() => void) | null = null;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const markDone = () => {
    if (finished) return;
    finished = true;
    if (finalTimer) {
      clearTimeout(finalTimer);
      finalTimer = null;
    }
    resolveDone?.();
  };

  const handleAbort = async () => {
    cancelRequested = true;
    log.info('run.abort', {
      sessionId: activeSessionId ?? null,
      hasSessionId: Boolean(activeSessionId),
      signalAborted: Boolean(signal?.aborted),
    });
    if (!activeSessionId) return;
    try {
      await cancelSession(activeSessionId);
    } catch {
      // ignore
    }
    if (!finished) {
      onEvent({ type: 'final', cancelled: true } as SessionEvent);
      markDone();
    }
  };

  if (signal) {
    if (signal.aborted) {
      await handleAbort();
    } else if (abortHandler) {
      signal.addEventListener('abort', abortHandler);
    }
  }
  const createSession = async (): Promise<string> =>
    (
      await request<{ sessionId: string }>('acp.sessions.create', {
        provider: providerId,
        model: options.model,
        reasoningEffort: options.reasoningEffort,
        system: options.system,
        mcpServers: resolveSessionMcpServers(options.mcpServers),
        cwd: options.cwd,
        repoRoot: options.repoRoot,
      })
    ).sessionId;

  if (sessionId) {
    try {
      activeSessionId = (
        await request<{ sessionId: string }>('acp.sessions.resume', {
          sessionId,
          model: options.model,
          reasoningEffort: options.reasoningEffort,
          system: options.system,
          mcpServers: resolveSessionMcpServers(options.mcpServers),
          cwd: options.cwd,
          repoRoot: options.repoRoot,
        })
      ).sessionId;
    } catch (error) {
      if (!isUnknownSessionError(error)) throw error;
      activeSessionId = await createSession();
    }
  } else {
    activeSessionId = await createSession();
  }

  onSessionId?.(activeSessionId);

  if (cancelRequested) {
    log.info('run.cancel.requested', {
      sessionId: activeSessionId,
      reason: 'abort-before-run',
    });
    try {
      await cancelSession(activeSessionId);
    } catch {
      // ignore
    }
    if (!finished) {
      onEvent({ type: 'final', cancelled: true } as SessionEvent);
      markDone();
    }
    if (signal && abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }
    return { sessionId: activeSessionId };
  }

  const handlers = sessionListeners.get(activeSessionId) ?? new Set<(event: SessionEvent) => void>();
  sessionListeners.set(activeSessionId, handlers);

  const handleEvent = (event: SessionEvent) => {
    if (finished) return;
    onEvent(event);
    if (event.type === 'summary') {
      sawSummary = true;
      if (sawFinal) {
        markDone();
      }
      return;
    }
    if (event.type === 'final') {
      sawFinal = true;
      if (sawSummary) {
        markDone();
      } else {
        finalTimer = setTimeout(() => {
          if (finished) return;
          markDone();
        }, summaryWaitMs);
      }
    }
    if (event.type === 'error') {
      markDone();
    }
  };
  handlers.add(handleEvent);

  try {
    await request('acp.sessions.send', {
      sessionId: activeSessionId,
      message: { role: 'user', content: options.prompt },
      mcpServers: resolveSessionMcpServers(options.mcpServers),
      cwd: options.cwd,
      repoRoot: options.repoRoot,
    });
    await done;
  } finally {
    handlers.delete(handleEvent);
    if (handlers.size === 0) {
      sessionListeners.delete(activeSessionId);
    }
    if (signal && abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }
    if (finalTimer) {
      clearTimeout(finalTimer);
    }
  }

  return { sessionId: activeSessionId };
};

export const cancelSession = async (sessionId: string): Promise<void> => {
  await request('acp.sessions.cancel', { sessionId });
};
