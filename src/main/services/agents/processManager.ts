import type { Agent, AgentTerminalEntry, AgentTerminalViewState, TokenUsage } from '../../../shared/types';
import { storage } from '../storage';

type TerminalRunState = {
  currentAssistantId: string | null;
  toolEntryByItemId: Map<string, string>;
};

const MAX_TERMINAL_BYTES = 10 * 1024 * 1024;
const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const jsonByteLength = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8');
const normalizeText = (text: string) => text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
const shouldMergeText = (incoming: string, existing: string): boolean =>
  incoming === existing || incoming.startsWith(existing) || existing.startsWith(incoming);

const trimStringToFit = (value: string, build: (next: string) => unknown, maxBytes: number): string => {
  if (!value) return value;
  if (jsonByteLength(build(value)) <= maxBytes) return value;
  let low = 0;
  let high = value.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = value.slice(mid);
    if (jsonByteLength(build(candidate)) > maxBytes) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return value.slice(low);
};

const trimEntryToFit = (entry: AgentTerminalEntry, maxBytes: number): AgentTerminalEntry | null => {
  const size = jsonByteLength([entry]);
  if (size <= maxBytes) return entry;
  if (entry.type === 'message') {
    const trimmedContent = trimStringToFit(entry.content, (content) => [{ ...entry, content }], maxBytes);
    const next = { ...entry, content: trimmedContent };
    return jsonByteLength([next]) <= maxBytes ? next : null;
  }
  if (entry.type === 'tool') {
    const output = entry.output ?? '';
    const trimmedOutput = trimStringToFit(
      output,
      (nextOutput) => [{ ...entry, output: nextOutput }],
      maxBytes
    );
    const next = { ...entry, output: trimmedOutput };
    return jsonByteLength([next]) <= maxBytes ? next : null;
  }
  return null;
};

const trimEntriesToMaxBytes = (entries: AgentTerminalEntry[], maxBytes: number): AgentTerminalEntry[] => {
  let next = entries;
  let size = jsonByteLength(next);
  while (size > maxBytes && next.length > 1) {
    next = next.slice(1);
    size = jsonByteLength(next);
  }
  if (size <= maxBytes) return next;
  if (next.length === 1) {
    const trimmed = trimEntryToFit(next[0], maxBytes);
    return trimmed ? [trimmed] : [];
  }
  return [];
};

class ProcessManager {
  private agents = new Map<string, Agent>();
  private terminalEntries = new Map<string, AgentTerminalEntry[]>();
  private terminalPersistTimers = new Map<string, NodeJS.Timeout>();
  private terminalRunState = new Map<string, TerminalRunState>();
  private terminalViewState = new Map<string, AgentTerminalViewState | null>();

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  ensureAgentLoaded(workspacePath: string, agentId: string): Agent | null {
    const existing = this.getAgent(agentId);
    if (existing) return existing;
    if (!workspacePath) return null;
    const agents = storage.loadAgents(workspacePath);
    const agent = agents.find((entry) => entry.id === agentId) ?? null;
    if (!agent) {
      console.log('[agentconnect][ensureAgentLoaded] missing', {
        workspacePath,
        agentId,
        knownIds: agents.map((entry) => entry.id),
      });
    }
    if (agent) {
      this.loadAgent(agent);
      console.log('[agentconnect][ensureAgentLoaded] loaded', { workspacePath, agentId });
    }
    return agent;
  }

  loadAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  loadAgents(agents: Agent[]): void {
    agents.forEach((agent) => this.loadAgent(agent));
  }

  async spawnAgent(agent: Agent): Promise<void> {
    if (this.agents.has(agent.id)) return;
    this.agents.set(agent.id, agent);
  }

  updateAgentPosition(id: string, x: number, y: number): void {
    const rec = this.agents.get(id);
    if (!rec) return;
    rec.x = x;
    rec.y = y;
  }

  updateAgent(id: string, updates: Partial<Agent>): void {
    const rec = this.agents.get(id);
    if (!rec) return;
    this.agents.set(id, { ...rec, ...updates });
  }

  getAgentTerminalEntries(agentId: string): AgentTerminalEntry[] | null {
    const existing = this.terminalEntries.get(agentId);
    if (existing) return existing;
    const agent = this.getAgent(agentId);
    if (!agent) return null;
    const storedState = storage.getAgentTerminalState(agent.workspacePath, agentId);
    const storedEntries = storedState?.entries ?? [];
    this.terminalEntries.set(agentId, storedEntries);
    if (!this.terminalViewState.has(agentId)) {
      this.terminalViewState.set(agentId, storedState?.viewState ?? null);
    }
    this.ensureRunState(agentId);
    return storedEntries;
  }

  setAgentTerminalViewState(agentId: string, viewState: AgentTerminalViewState | null): void {
    this.terminalViewState.set(agentId, viewState);
  }

  startAgentTerminalRun(agentId: string): void {
    const state = this.ensureRunState(agentId);
    state.currentAssistantId = null;
    state.toolEntryByItemId.clear();
  }

  addAgentTerminalUserMessage(agentId: string, content: string): void {
    if (!content) return;
    this.addAgentTerminalEntry(agentId, {
      id: createId(),
      type: 'message',
      role: 'user',
      content: normalizeText(content),
    });
  }

  addAgentTerminalSystemMessage(agentId: string, content: string): void {
    if (!content) return;
    this.addAgentTerminalEntry(agentId, {
      id: createId(),
      type: 'message',
      role: 'system',
      content: normalizeText(content),
    });
  }

  appendAgentTerminalAssistantDelta(agentId: string, text: string): void {
    if (!text) return;
    const entries = this.ensureEntries(agentId);
    const state = this.ensureRunState(agentId);
    const normalized = normalizeText(text);
    if (!state.currentAssistantId) {
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        const entry = entries[i];
        if (entry.type !== 'message') continue;
        if (entry.role !== 'assistant') break;
        if (!shouldMergeText(normalized, entry.content)) break;
        const nextContent = normalized.length > entry.content.length ? normalized : entry.content;
        entries[i] = { ...entry, content: nextContent };
        state.currentAssistantId = entry.id;
        this.scheduleTerminalPersist(agentId);
        return;
      }
    }
    if (!state.currentAssistantId) {
      const id = createId();
      state.currentAssistantId = id;
      entries.push({ id, type: 'message', role: 'assistant', content: normalized });
      this.scheduleTerminalPersist(agentId);
      return;
    }
    const updated = this.updateEntry(agentId, state.currentAssistantId, (entry) => {
      if (entry.type !== 'message') return entry;
      return { ...entry, content: entry.content + normalized };
    });
    if (!updated) {
      const id = createId();
      state.currentAssistantId = id;
      entries.push({ id, type: 'message', role: 'assistant', content: normalized });
    }
    this.scheduleTerminalPersist(agentId);
  }

  finalizeAgentTerminalAssistantMessage(
    agentId: string,
    content: string,
    messageId?: string,
    usage?: TokenUsage
  ): void {
    if (!content) return;
    const entries = this.ensureEntries(agentId);
    const state = this.ensureRunState(agentId);
    const normalized = normalizeText(content);
    let merged = false;
    if (state.currentAssistantId) {
      const currentEntry = entries.find((entry) => entry.id === state.currentAssistantId);
      if (currentEntry?.type === 'message') {
        const existing = currentEntry.content;
        const shouldMerge = shouldMergeText(normalized, existing);
        if (shouldMerge) {
          const updated = this.updateEntry(agentId, state.currentAssistantId, (entry) => {
            if (entry.type !== 'message') return entry;
            return {
              ...entry,
              role: 'assistant',
              content: normalized,
              usage: usage ?? entry.usage,
              messageId: messageId ?? entry.messageId,
            };
          });
          if (updated) {
            merged = true;
          }
        }
      }
    }
    if (!merged) {
      const id = messageId ?? createId();
      entries.push({
        id,
        type: 'message',
        role: 'assistant',
        content: normalized,
        usage,
        messageId,
      });
    }
    state.currentAssistantId = null;
    this.scheduleTerminalPersist(agentId);
  }

  startAgentTerminalToolEntry(
    agentId: string,
    entry: Omit<Extract<AgentTerminalEntry, { type: 'tool' }>, 'id' | 'type'>,
    itemId?: string
  ): string {
    const id = createId();
    const entries = this.ensureEntries(agentId);
    entries.push({ id, type: 'tool', expanded: false, ...entry });
    if (itemId) {
      const state = this.ensureRunState(agentId);
      state.toolEntryByItemId.set(itemId, id);
    }
    this.scheduleTerminalPersist(agentId);
    return id;
  }

  completeAgentTerminalToolEntry(
    agentId: string,
    itemId: string,
    updater: (entry: Extract<AgentTerminalEntry, { type: 'tool' }>) => AgentTerminalEntry
  ): boolean {
    const state = this.ensureRunState(agentId);
    const toolId = state.toolEntryByItemId.get(itemId);
    if (toolId) {
      const updated = this.updateEntry(agentId, toolId, (entry) => {
        if (entry.type !== 'tool') return entry;
        return updater(entry);
      });
      if (updated) {
        this.scheduleTerminalPersist(agentId);
        return true;
      }
    }
    return false;
  }

  addAgentTerminalEntry(agentId: string, entry: AgentTerminalEntry): void {
    const entries = this.ensureEntries(agentId);
    entries.push(entry);
    this.scheduleTerminalPersist(agentId);
  }

  updateAgentTerminalEntry(
    agentId: string,
    entryId: string,
    updater: (entry: AgentTerminalEntry) => AgentTerminalEntry
  ): boolean {
    const updated = this.updateEntry(agentId, entryId, updater);
    if (updated) {
      this.scheduleTerminalPersist(agentId);
    }
    return updated;
  }

  updateAgentTerminalEntryByMessageId(
    agentId: string,
    messageId: string,
    updater: (entry: AgentTerminalEntry) => AgentTerminalEntry
  ): boolean {
    const entries = this.ensureEntries(agentId);
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const entry = entries[i];
      if (entry.type === 'message' && entry.messageId === messageId) {
        entries[i] = updater(entry);
        this.scheduleTerminalPersist(agentId);
        return true;
      }
    }
    return false;
  }

  finalizeAgentTerminalRun(agentId: string): void {
    const state = this.ensureRunState(agentId);
    state.currentAssistantId = null;
    state.toolEntryByItemId.clear();
    this.scheduleTerminalPersist(agentId);
  }

  clearAgentTerminalState(agentId: string): void {
    this.terminalEntries.delete(agentId);
    this.terminalRunState.delete(agentId);
    this.terminalViewState.delete(agentId);
    const existing = this.terminalPersistTimers.get(agentId);
    if (existing) clearTimeout(existing);
    this.terminalPersistTimers.delete(agentId);
    const agent = this.getAgent(agentId);
    if (!agent) return;
    try {
      storage.clearAgentTerminalState(agent.workspacePath, agentId);
    } catch {
      // noop
    }
  }

  async shutdownAll(): Promise<void> {
    this.agents.clear();
    this.terminalEntries.clear();
    this.terminalRunState.clear();
    this.terminalViewState.clear();
    this.terminalPersistTimers.forEach((t) => clearTimeout(t));
    this.terminalPersistTimers.clear();
  }

  private ensureEntries(agentId: string): AgentTerminalEntry[] {
    const existing = this.getAgentTerminalEntries(agentId);
    if (existing) return existing;
    const fallback: AgentTerminalEntry[] = [];
    this.terminalEntries.set(agentId, fallback);
    if (!this.terminalViewState.has(agentId)) {
      this.terminalViewState.set(agentId, null);
    }
    this.ensureRunState(agentId);
    return fallback;
  }

  private ensureRunState(agentId: string): TerminalRunState {
    const existing = this.terminalRunState.get(agentId);
    if (existing) return existing;
    const state: TerminalRunState = { currentAssistantId: null, toolEntryByItemId: new Map() };
    this.terminalRunState.set(agentId, state);
    return state;
  }

  private updateEntry(
    agentId: string,
    entryId: string,
    updater: (entry: AgentTerminalEntry) => AgentTerminalEntry
  ): boolean {
    const entries = this.ensureEntries(agentId);
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const entry = entries[i];
      if (entry.id === entryId) {
        entries[i] = updater(entry);
        return true;
      }
    }
    return false;
  }

  private scheduleTerminalPersist(agentId: string): void {
    const existing = this.terminalPersistTimers.get(agentId);
    if (existing) clearTimeout(existing);
    const timeout = setTimeout(() => {
      this.terminalPersistTimers.delete(agentId);
      this.persistTerminalEntries(agentId);
    }, 300);
    this.terminalPersistTimers.set(agentId, timeout);
  }

  private persistTerminalEntries(agentId: string): void {
    const agent = this.getAgent(agentId);
    if (!agent) return;
    try {
      const entries = this.ensureEntries(agentId);
      const trimmed = trimEntriesToMaxBytes(entries, MAX_TERMINAL_BYTES);
      if (trimmed !== entries) {
        this.terminalEntries.set(agentId, trimmed);
        const state = this.ensureRunState(agentId);
        const ids = new Set(trimmed.map((entry) => entry.id));
        if (state.currentAssistantId && !ids.has(state.currentAssistantId)) {
          state.currentAssistantId = null;
        }
        for (const [itemId, entryId] of state.toolEntryByItemId.entries()) {
          if (!ids.has(entryId)) {
            state.toolEntryByItemId.delete(itemId);
          }
        }
      }
      const viewState = this.terminalViewState.get(agentId) ?? null;
      storage.setAgentTerminalState(agent.workspacePath, agentId, this.ensureEntries(agentId), viewState);
    } catch {
      // noop
    }
  }
}

export const processManager = new ProcessManager();
