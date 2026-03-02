import type {
  Agent,
  Hero,
  AgentProvider,
  ContextUsage,
  ProviderDetail,
  TokenUsage,
} from '../../../shared/types';
import type { SessionEvent } from '@agentconnect/host';
import type { AgentConnectEvent, AgentConnectRunner, AgentConnectRunnerRequest } from './service';
import { resolveProviderForModel, runProviderPrompt } from './embeddedHost';

type RunnerDeps = {
  getAgent: (id: string) => Agent | undefined;
  loadHero: (workspacePath: string) => Hero;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
};

const readUsageNumber = (usage: Record<string, unknown>, keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = toNumber(usage[key]);
    if (value !== undefined) return value;
  }
  return undefined;
};

const normalizeUsage = (usage: unknown): TokenUsage | undefined => {
  if (!usage || typeof usage !== 'object') return undefined;
  const record = usage as Record<string, unknown>;
  const input = readUsageNumber(record, ['input_tokens', 'prompt_tokens', 'inputTokens', 'promptTokens']);
  const output = readUsageNumber(record, [
    'output_tokens',
    'completion_tokens',
    'outputTokens',
    'completionTokens',
  ]);
  const total = readUsageNumber(record, ['total_tokens', 'totalTokens']);
  const cached = readUsageNumber(record, ['cached_input_tokens', 'cachedInputTokens']);
  const cacheCreate = readUsageNumber(record, ['cache_creation_input_tokens', 'cacheCreationInputTokens']);
  const cacheRead = readUsageNumber(record, ['cache_read_input_tokens', 'cacheReadInputTokens']);
  const reasoning = readUsageNumber(record, ['reasoning_tokens', 'reasoningTokens']);
  const derivedCached = (cacheCreate ?? 0) + (cacheRead ?? 0);
  const hasDerivedCached = cacheCreate !== undefined || cacheRead !== undefined;
  let cachedTotal = cached;
  if (hasDerivedCached) {
    cachedTotal = cachedTotal === undefined ? derivedCached : Math.max(cachedTotal, derivedCached);
  }
  if (
    input === undefined &&
    output === undefined &&
    total === undefined &&
    cachedTotal === undefined &&
    reasoning === undefined
  ) {
    return undefined;
  }
  const computedTotal =
    total ?? (input !== undefined || output !== undefined ? (input ?? 0) + (output ?? 0) : undefined);
  return {
    input_tokens: input,
    output_tokens: output,
    total_tokens: computedTotal,
    cached_input_tokens: cachedTotal,
    reasoning_tokens: reasoning,
  };
};

const mapUsage = (event: SessionEvent): TokenUsage | undefined => {
  const normalized = normalizeUsage((event as { usage?: unknown }).usage);
  if (normalized) return normalized;
  const legacyInput = toNumber((event as { inputTokens?: unknown }).inputTokens);
  const legacyOutput = toNumber((event as { outputTokens?: unknown }).outputTokens);
  const legacyTotal = toNumber((event as { totalTokens?: unknown }).totalTokens);
  const legacyCached = toNumber((event as { cachedInputTokens?: unknown }).cachedInputTokens);
  const legacyCacheCreate = toNumber(
    (event as { cacheCreationInputTokens?: unknown }).cacheCreationInputTokens
  );
  const legacyCacheRead = toNumber((event as { cacheReadInputTokens?: unknown }).cacheReadInputTokens);
  const legacyReasoning = toNumber((event as { reasoningTokens?: unknown }).reasoningTokens);
  const derivedLegacyCached = (legacyCacheCreate ?? 0) + (legacyCacheRead ?? 0);
  const hasDerivedLegacyCached = legacyCacheCreate !== undefined || legacyCacheRead !== undefined;
  let legacyCachedTotal = legacyCached;
  if (hasDerivedLegacyCached) {
    legacyCachedTotal =
      legacyCachedTotal === undefined
        ? derivedLegacyCached
        : Math.max(legacyCachedTotal, derivedLegacyCached);
  }
  if (
    legacyInput === undefined &&
    legacyOutput === undefined &&
    legacyTotal === undefined &&
    legacyCachedTotal === undefined &&
    legacyReasoning === undefined
  ) {
    return undefined;
  }
  const computedTotal =
    legacyTotal ??
    (legacyInput !== undefined || legacyOutput !== undefined
      ? (legacyInput ?? 0) + (legacyOutput ?? 0)
      : undefined);
  return {
    input_tokens: legacyInput,
    output_tokens: legacyOutput,
    total_tokens: computedTotal,
    cached_input_tokens: legacyCachedTotal,
    reasoning_tokens: legacyReasoning,
  };
};

const mapToolPhase = (phase?: SessionEvent['phase']): 'start' | 'complete' => {
  if (phase === 'start') return 'start';
  if (phase === 'completed') return 'complete';
  return 'complete';
};

const safeStringify = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const extractToolInput = (event: SessionEvent): string | undefined => {
  if (typeof event.input === 'string') return event.input;
  if (event.name === 'command_execution' && event.input && typeof event.input === 'object') {
    const command = (event.input as Record<string, unknown>).command;
    if (typeof command === 'string' && command.trim()) return command;
  }
  return safeStringify(event.input);
};

const extractToolOutput = (event: SessionEvent): string | undefined => {
  if (typeof event.output === 'string') return event.output;
  if (event.name === 'command_execution' && event.output && typeof event.output === 'object') {
    const output = (event.output as Record<string, unknown>).output;
    if (typeof output === 'string') return output;
  }
  return safeStringify(event.output);
};

const mapEvent = (event: SessionEvent, sessionId?: string | null): AgentConnectEvent | null => {
  if (event.type === 'delta') {
    return { type: 'delta', text: event.text ?? '' };
  }
  if (event.type === 'final') {
    return {
      type: 'final',
      sessionId: sessionId ?? event.providerSessionId ?? null,
      cancelled: event.cancelled === true,
      usage: mapUsage(event),
    };
  }
  if (event.type === 'summary') {
    return {
      type: 'summary',
      summary: event.summary ?? '',
      source: event.source,
      model: event.model ?? null,
      createdAt: event.createdAt,
    };
  }
  if ((event as { type?: string }).type === 'context_usage') {
    const contextUsage = (event as { contextUsage?: unknown }).contextUsage;
    if (!contextUsage) return null;
    return {
      type: 'context_usage',
      contextUsage: contextUsage as ContextUsage,
      provider: (event as { provider?: AgentProvider }).provider,
      providerDetail: (event as { providerDetail?: ProviderDetail }).providerDetail,
    };
  }
  if (event.type === 'usage') {
    const usage = mapUsage(event);
    if (!usage) return null;
    return { type: 'usage', usage };
  }
  if (event.type === 'raw_line') {
    return { type: 'raw_line', line: event.line ?? '' };
  }
  if (event.type === 'message') {
    const content = (event.content ?? '').trim();
    if (!content) return null;
    return {
      type: 'message',
      role: event.role ?? 'assistant',
      content,
      usage: mapUsage(event),
    };
  }
  if (event.type === 'detail') {
    return {
      type: 'detail',
      provider: event.provider,
      providerDetail: event.providerDetail,
    };
  }
  if (event.type === 'tool_call') {
    return {
      type: 'tool_call',
      phase: mapToolPhase(event.phase),
      callId: event.callId ?? `${Date.now()}`,
      name: event.name,
      input: extractToolInput(event),
      output: extractToolOutput(event),
      status: event.phase === 'error' ? 'error' : undefined,
    };
  }
  if (event.type === 'thinking') {
    return { type: 'thinking', text: event.text ?? '' };
  }
  if (event.type === 'status') {
    return {
      type: 'status',
      status: event.status ?? 'idle',
      message: event.message,
    };
  }
  if (event.type === 'error') {
    return { type: 'error', message: event.message ?? 'Unknown error' };
  }
  return null;
};

export function createAgentConnectRunner({ getAgent, loadHero }: RunnerDeps): AgentConnectRunner {
  return async function* runner(request: AgentConnectRunnerRequest) {
    const pending: AgentConnectEvent[] = [];
    let resolveWait: (() => void) | null = null;
    let done = false;
    let finalEvent: SessionEvent | null = null;

    const push = (event: AgentConnectEvent) => {
      pending.push(event);
      if (resolveWait) {
        resolveWait();
        resolveWait = null;
      }
    };

    const wait = () =>
      new Promise<void>((resolve) => {
        resolveWait = () => resolve();
      });

    const resolveProvider = async (): Promise<AgentProvider> => {
      if (request.unit.type === 'agent') {
        const agent = getAgent(request.unit.id);
        if (agent) return agent.provider;
      } else {
        const hero = loadHero(request.workspacePath);
        if (hero) return hero.provider;
      }
      return (await resolveProviderForModel(request.model)) as AgentProvider;
    };

    push({ type: 'status', status: 'thinking' });

    void (async () => {
      try {
        const providerId = await resolveProvider();
        const result = await runProviderPrompt(
          providerId,
          {
            prompt: request.prompt,
            resumeSessionId: request.resumeSessionId ?? undefined,
            model: request.model,
            reasoningEffort: request.reasoningEffort ?? undefined,
            system: request.systemPrompt,
            cwd: request.cwd,
            repoRoot: request.repoRoot,
            mcpServers: request.mcpServers,
            signal: request.signal,
          },
          (event) => {
            if (event.type === 'final') {
              finalEvent = event;
              return;
            }
            const mapped = mapEvent(event);
            if (mapped) push(mapped);
          },
          (sessionId) => {
            request.onSessionId?.(sessionId);
          }
        );

        if (finalEvent) {
          const mapped = mapEvent(finalEvent, result.sessionId);
          if (mapped) push(mapped);
        } else if (result.sessionId) {
          push({ type: 'final', sessionId: result.sessionId });
        }

        push({ type: 'status', status: 'idle' });
      } catch (error) {
        push({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to run provider prompt',
        });
        push({ type: 'status', status: 'error', message: 'Failed to run provider prompt' });
      } finally {
        done = true;
        const release = resolveWait as (() => void) | null;
        if (release) {
          release();
          resolveWait = null;
        }
      }
    })();

    while (!done || pending.length > 0) {
      if (pending.length > 0) {
        const next = pending.shift();
        if (next) yield next;
      } else {
        await wait();
      }
    }
  };
}
