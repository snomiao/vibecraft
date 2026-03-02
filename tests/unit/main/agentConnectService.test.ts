import { describe, expect, test, vi } from 'vitest';
import type { Agent, AgentTerminalEntry, Hero, TokenUsage } from '../../../src/shared/types';
import {
  buildAgentSystemPrompt,
  buildHeroSystemPrompt,
} from '../../../src/main/services/agentConnect/heroSystemPrompt';
import {
  createAgentConnectService,
  type AgentConnectEvent,
  type AgentConnectRunner,
  type AgentConnectRunContext,
} from '../../../src/main/services/agentConnect/service';

type StorageStub = {
  loadAgents: (workspacePath: string) => Agent[];
  saveAgents: (workspacePath: string, agents: Agent[]) => boolean;
  loadHero: (workspacePath: string) => Hero;
  saveHero: (workspacePath: string, hero: Hero) => boolean;
};

type ProcessStub = {
  getAgent: (id: string) => Agent | undefined;
  ensureAgentLoaded: (workspacePath: string, agentId: string) => Agent | null;
  updateAgent: (id: string, updates: Partial<Agent>) => void;
  startAgentTerminalRun: (agentId: string) => void;
  addAgentTerminalUserMessage: (agentId: string, content: string) => void;
  addAgentTerminalSystemMessage: (agentId: string, content: string) => void;
  appendAgentTerminalAssistantDelta: (agentId: string, text: string) => void;
  finalizeAgentTerminalAssistantMessage: (
    agentId: string,
    content: string,
    messageId?: string,
    usage?: TokenUsage
  ) => void;
  addAgentTerminalEntry: (agentId: string, entry: AgentTerminalEntry) => void;
  startAgentTerminalToolEntry: (
    agentId: string,
    entry: Omit<Extract<AgentTerminalEntry, { type: 'tool' }>, 'id' | 'type'>,
    itemId?: string
  ) => string;
  completeAgentTerminalToolEntry: (
    agentId: string,
    itemId: string,
    updater: (entry: Extract<AgentTerminalEntry, { type: 'tool' }>) => AgentTerminalEntry
  ) => boolean;
  finalizeAgentTerminalRun: (agentId: string) => void;
  updateAgentTerminalEntry: (
    agentId: string,
    entryId: string,
    updater: (entry: AgentTerminalEntry) => AgentTerminalEntry
  ) => boolean;
  updateAgentTerminalEntryByMessageId: (
    agentId: string,
    messageId: string,
    updater: (entry: AgentTerminalEntry) => AgentTerminalEntry
  ) => boolean;
};

const createHarness = (overrides: Partial<Agent> = {}, runner?: AgentConnectRunner) => {
  let agent: Agent = {
    id: 'agent-1',
    provider: 'claude',
    model: 'claude-3.5',
    color: '#ff0000',
    name: 'Agent One',
    displayName: 'Agent One',
    workspacePath: '/tmp/workspace',
    x: 0,
    y: 0,
    status: 'online',
    totalTokensUsed: 100,
    contextWindow: 1000,
    ...overrides,
  };

  let hero: Hero = {
    id: 'hero',
    name: 'Hero',
    provider: 'claude',
    model: 'claude-3.5',
    x: 0,
    y: 0,
  };

  const storage: StorageStub = {
    loadAgents: () => [agent],
    saveAgents: (_workspacePath, agents) => {
      agent = agents[0] ?? agent;
      return true;
    },
    loadHero: () => hero,
    saveHero: (_workspacePath, next) => {
      hero = next;
      return true;
    },
  };

  const addAgentTerminalEntry = vi.fn();
  const finalizeAgentTerminalAssistantMessage = vi.fn();
  const updateAgent = vi.fn((_: string, updates: Partial<Agent>) => {
    agent = { ...agent, ...updates };
  });

  const processManager: ProcessStub = {
    getAgent: () => agent,
    ensureAgentLoaded: () => agent,
    updateAgent,
    startAgentTerminalRun: vi.fn(),
    addAgentTerminalUserMessage: vi.fn(),
    addAgentTerminalSystemMessage: vi.fn(),
    appendAgentTerminalAssistantDelta: vi.fn(),
    finalizeAgentTerminalAssistantMessage,
    addAgentTerminalEntry,
    startAgentTerminalToolEntry: vi.fn(() => 'tool-entry-1'),
    completeAgentTerminalToolEntry: vi.fn(() => true),
    finalizeAgentTerminalRun: vi.fn(),
    updateAgentTerminalEntry: vi.fn(() => true),
    updateAgentTerminalEntryByMessageId: vi.fn(() => true),
  };

  const emitted: Array<{ channel: string; payload: unknown }> = [];
  const emit = (channel: string, payload: unknown) => emitted.push({ channel, payload });

  const service = createAgentConnectService({
    processManager,
    storage,
    emit,
    runner,
  });

  const context: AgentConnectRunContext = {
    runId: 'run-1',
    workspacePath: agent.workspacePath,
    unit: { type: 'agent', id: agent.id },
    provider: agent.provider,
  };

  return {
    agent: () => agent,
    hero: () => hero,
    storage,
    processManager,
    emitted,
    service,
    context,
    spies: {
      addAgentTerminalEntry,
      finalizeAgentTerminalAssistantMessage,
      updateAgent,
    },
  };
};

const usageEvent = (usage: TokenUsage, messageId?: string): AgentConnectEvent => ({
  type: 'usage',
  usage,
  messageId,
});

describe('agent connect service', () => {
  test('attaches usage to message entries when provided', () => {
    const harness = createHarness();
    const event: AgentConnectEvent = {
      type: 'message',
      role: 'assistant',
      content: 'Hello there',
      messageId: 'msg-1',
      usage: { input_tokens: 5, output_tokens: 2 },
    };

    harness.service.handleSessionEvent(harness.context, event);

    expect(harness.spies.finalizeAgentTerminalAssistantMessage).toHaveBeenCalledWith(
      'agent-1',
      'Hello there',
      'msg-1',
      { input_tokens: 5, output_tokens: 2 }
    );
  });

  test('runAgentPrompt streams events through the runner', async () => {
    const runner = vi.fn(async function* () {
      yield { type: 'message', role: 'assistant', content: 'Hi there' } as AgentConnectEvent;
      yield { type: 'final' } as AgentConnectEvent;
    });
    const harness = createHarness({}, runner);

    await harness.service.runAgentPrompt('agent-1', {
      workspacePath: harness.context.workspacePath,
      prompt: 'Hello',
      cwd: '/repo',
      repoRoot: '/repo',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(runner).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-3.5',
        prompt: 'Hello',
        systemPrompt: buildAgentSystemPrompt({ displayName: 'Agent One', name: 'Agent One' }),
        workspacePath: harness.context.workspacePath,
        cwd: '/repo',
        repoRoot: '/repo',
        resumeSessionId: null,
      })
    );
    expect(harness.spies.finalizeAgentTerminalAssistantMessage).toHaveBeenCalled();
  });

  test('isAgentRunning reflects active run lifecycle', async () => {
    const runner = vi.fn(async function* () {
      yield { type: 'message', role: 'assistant', content: 'Working' } as AgentConnectEvent;
      await new Promise((resolve) => setTimeout(resolve, 0));
      yield { type: 'final' } as AgentConnectEvent;
    });
    const harness = createHarness({}, runner);

    await harness.service.runAgentPrompt('agent-1', {
      workspacePath: harness.context.workspacePath,
      prompt: 'Hello',
      cwd: '/repo',
      repoRoot: '/repo',
    });

    expect(harness.service.isAgentRunning('agent-1')).toBe(true);

    const waitForDone = async () => {
      const startedAt = Date.now();
      while (harness.service.isAgentRunning('agent-1')) {
        if (Date.now() - startedAt > 250) {
          throw new Error('run did not finish');
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    };

    await waitForDone();

    expect(harness.service.isAgentRunning('agent-1')).toBe(false);
  });

  test('runHeroPrompt includes hero system prompt for MCP-first orchestration', async () => {
    const runner = vi.fn(async function* () {
      yield { type: 'final' } as AgentConnectEvent;
    });
    const harness = createHarness({}, runner);

    await harness.service.runHeroPrompt({
      workspacePath: harness.context.workspacePath,
      prompt: 'Set up two coding agents for this repo',
      cwd: '/repo',
      repoRoot: '/repo',
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(runner).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: buildHeroSystemPrompt('Hero'),
        prompt: 'Set up two coding agents for this repo',
        workspacePath: harness.context.workspacePath,
      })
    );
  });

  test('updates token totals and context left from usage events', () => {
    const harness = createHarness({ totalTokensUsed: 100, contextWindow: 1000, provider: 'cursor' });

    harness.service.handleSessionEvent(harness.context, usageEvent({ input_tokens: 40, output_tokens: 10 }));

    const updatedAgent = harness.agent();
    expect(updatedAgent.totalTokensUsed).toBe(150);
    expect(updatedAgent.contextLeft).toBe(85);

    expect(harness.spies.updateAgent).toHaveBeenCalledWith('agent-1', {
      totalTokensUsed: 150,
      contextLeft: 85,
    });
  });

  test('updates context left from context usage events', () => {
    const harness = createHarness({ contextWindow: 1000, provider: 'cursor' });

    harness.service.handleSessionEvent(harness.context, {
      type: 'context_usage',
      contextUsage: { context_window: 1200, context_tokens: 300 },
    });

    const updatedAgent = harness.agent();
    expect(updatedAgent.contextWindow).toBe(1200);
    expect(updatedAgent.contextLeft).toBe(75);

    expect(harness.spies.updateAgent).toHaveBeenCalledWith('agent-1', {
      contextLeft: 75,
      contextWindow: 1200,
    });
  });

  test('stores thinking text as a terminal entry', () => {
    const harness = createHarness();
    const event: AgentConnectEvent = {
      type: 'thinking',
      text: 'Considering next steps',
    };

    harness.service.handleSessionEvent(harness.context, event);

    expect(harness.spies.addAgentTerminalEntry).toHaveBeenCalledWith(
      'agent-1',
      expect.objectContaining({
        type: 'message',
        role: 'assistant',
        content: 'Considering next steps',
        variant: 'thinking',
      })
    );
  });

  test('final events finalize runs and persist provider sessions', () => {
    const harness = createHarness();
    const event: AgentConnectEvent = {
      type: 'final',
      sessionId: 'provider-session-123',
      usage: { total_tokens: 50 },
    };

    harness.service.handleSessionEvent(harness.context, event);

    expect(harness.processManager.finalizeAgentTerminalRun).toHaveBeenCalledWith('agent-1');
    expect(harness.spies.updateAgent).toHaveBeenCalledWith('agent-1', {
      providerSessionId: 'provider-session-123',
    });
    expect(harness.agent().providerSessionId).toBe('provider-session-123');
  });

  test('final cancelled events log a system message', () => {
    const harness = createHarness();
    const event: AgentConnectEvent = {
      type: 'final',
      cancelled: true,
    };

    harness.service.handleSessionEvent(harness.context, event);

    expect(harness.processManager.addAgentTerminalSystemMessage).toHaveBeenCalledWith(
      'agent-1',
      'Run cancelled.'
    );
    expect(harness.processManager.finalizeAgentTerminalRun).toHaveBeenCalledWith('agent-1');
  });
});
