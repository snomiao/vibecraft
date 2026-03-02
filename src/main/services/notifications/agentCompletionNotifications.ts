import { Notification, type BrowserWindow } from 'electron';
import type { AgentConnectEvent, AgentConnectRunContext } from '../agentConnect/service';

type CompletionKind = 'success' | 'error';

type AgentCompletionNotificationsDeps = {
  getMainWindow: () => BrowserWindow | null;
  emitToRenderer: (channel: string, payload: unknown) => void;
  isNotificationsEnabled: () => boolean;
  resolveAgentName: (workspacePath: string, agentId: string) => string;
};

type RunState = {
  preview: string;
  errorMessage?: string;
};

const PREVIEW_MAX_CHARS = 120;

const normalizeSnippet = (value: string): string => value.replace(/\s+/g, ' ').trim();

const truncateSnippet = (value: string): string => value.slice(0, PREVIEW_MAX_CHARS);

const buildPreview = (current: string, next: string): string => {
  if (!next) return current;
  if (current.length >= PREVIEW_MAX_CHARS) return current;
  const needsSpace = current !== '' && !/\s$/.test(current) && !/^\s/.test(next);
  const combined = normalizeSnippet(`${current}${needsSpace ? ' ' : ''}${next}`);
  if (!combined) return current;
  return truncateSnippet(combined);
};

const isAppInForeground = (window: BrowserWindow | null): boolean => {
  if (!window || window.isDestroyed()) return false;
  if (!window.isVisible() || window.isMinimized()) return false;
  return window.isFocused();
};

export const createAgentCompletionNotifications = (deps: AgentCompletionNotificationsDeps) => {
  const previewByRun = new Map<string, RunState>();
  const completedRuns = new Set<string>();

  const ensureState = (runId: string): RunState => {
    const existing = previewByRun.get(runId);
    if (existing) return existing;
    const next = { preview: '' };
    previewByRun.set(runId, next);
    return next;
  };

  const clearRun = (runId: string) => {
    previewByRun.delete(runId);
  };

  const resolveBody = (runId: string, kind: CompletionKind): string => {
    const state = previewByRun.get(runId);
    if (kind === 'error') {
      const errorMessage = state?.errorMessage;
      if (errorMessage) {
        const normalized = normalizeSnippet(errorMessage);
        if (normalized) return truncateSnippet(normalized);
      }
    }
    const preview = state?.preview;
    if (preview && preview.trim()) return truncateSnippet(preview);
    return kind === 'error' ? 'Task failed.' : 'Task complete.';
  };

  const showNotification = (context: AgentConnectRunContext, kind: CompletionKind) => {
    if (!Notification.isSupported()) return;
    if (!deps.isNotificationsEnabled()) return;
    const window = deps.getMainWindow();
    if (isAppInForeground(window)) return;

    const agentName = deps.resolveAgentName(context.workspacePath, context.unit.id);
    const title =
      kind === 'error' ? `${agentName} ran into an error.` : `${agentName} has completed their task.`;
    const body = resolveBody(context.runId, kind);
    const notification = new Notification({ title, body });
    notification.on('click', () => {
      const mainWindow = deps.getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (!mainWindow.isVisible()) {
          mainWindow.show();
        }
        mainWindow.focus();
      }
      deps.emitToRenderer('agent-notification-click', {
        workspacePath: context.workspacePath,
        agentId: context.unit.id,
      });
    });
    notification.show();
  };

  const handleCompletion = (context: AgentConnectRunContext, kind: CompletionKind) => {
    if (completedRuns.has(context.runId)) return;
    completedRuns.add(context.runId);
    showNotification(context, kind);
    clearRun(context.runId);
  };

  const handleEvent = (context: AgentConnectRunContext, event: AgentConnectEvent) => {
    if (context.unit.type !== 'agent') return;
    if (completedRuns.has(context.runId)) return;

    if (event.type === 'delta') {
      const state = ensureState(context.runId);
      state.preview = buildPreview(state.preview, event.text);
      return;
    }

    if (event.type === 'message' && event.role === 'assistant') {
      const state = ensureState(context.runId);
      const normalized = normalizeSnippet(event.content);
      if (normalized) {
        state.preview = truncateSnippet(normalized);
      }
      return;
    }

    if (event.type === 'error') {
      const state = ensureState(context.runId);
      if (event.message) {
        state.errorMessage = event.message;
      }
      handleCompletion(context, 'error');
      return;
    }

    if (event.type === 'status' && event.status === 'error') {
      const state = ensureState(context.runId);
      if (event.message) {
        state.errorMessage = event.message;
      }
      handleCompletion(context, 'error');
      return;
    }

    if (event.type === 'final') {
      if (event.cancelled) {
        completedRuns.add(context.runId);
        clearRun(context.runId);
        return;
      }
      handleCompletion(context, 'success');
    }
  };

  return { handleEvent };
};
