import { beforeEach, describe, expect, test, vi } from 'vitest';

type MockNotificationInstance = {
  title: string;
  body: string;
  onClick?: () => void;
  show: () => void;
  on: (event: string, handler: () => void) => void;
};

let notifications: MockNotificationInstance[] = [];

vi.mock('electron', () => {
  class Notification {
    title: string;
    body: string;
    onClick?: () => void;

    constructor({ title, body }: { title: string; body: string }) {
      this.title = title;
      this.body = body;
      notifications.push(this);
    }

    show() {}

    on(event: string, handler: () => void) {
      if (event === 'click') {
        this.onClick = handler;
      }
    }

    static isSupported() {
      return true;
    }
  }

  return { Notification };
});

const buildContext = (overrides?: Partial<{ runId: string; workspacePath: string; agentId: string }>) => ({
  runId: overrides?.runId ?? 'run-1',
  workspacePath: overrides?.workspacePath ?? '/workspace',
  unit: { type: 'agent' as const, id: overrides?.agentId ?? 'agent-1' },
  provider: 'claude' as const,
});

describe('agent completion notifications', () => {
  beforeEach(() => {
    notifications = [];
    vi.resetModules();
  });

  test('shows background success notification with response snippet', async () => {
    const { createAgentCompletionNotifications } =
      await import('../../../src/main/services/notifications/agentCompletionNotifications');
    const emitToRenderer = vi.fn();
    const windowStub = {
      isDestroyed: () => false,
      isVisible: () => true,
      isMinimized: () => false,
      isFocused: () => false,
      show: vi.fn(),
      focus: vi.fn(),
    };

    const notify = createAgentCompletionNotifications({
      getMainWindow: () => windowStub as never,
      emitToRenderer,
      isNotificationsEnabled: () => true,
      resolveAgentName: () => 'Ralph',
    });

    const context = buildContext();
    notify.handleEvent(context, { type: 'delta', text: 'Hello ' });
    notify.handleEvent(context, { type: 'delta', text: 'world' });
    notify.handleEvent(context, { type: 'final' });

    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe('Ralph has completed their task.');
    expect(notifications[0].body).toBe('Hello world');

    notifications[0].onClick?.();
    expect(windowStub.focus).toHaveBeenCalledOnce();
    expect(emitToRenderer).toHaveBeenCalledWith('agent-notification-click', {
      workspacePath: '/workspace',
      agentId: 'agent-1',
    });
  });

  test('does not show notification when foregrounded', async () => {
    const { createAgentCompletionNotifications } =
      await import('../../../src/main/services/notifications/agentCompletionNotifications');
    const notify = createAgentCompletionNotifications({
      getMainWindow: () =>
        ({
          isDestroyed: () => false,
          isVisible: () => true,
          isMinimized: () => false,
          isFocused: () => true,
        }) as never,
      emitToRenderer: vi.fn(),
      isNotificationsEnabled: () => true,
      resolveAgentName: () => 'Ralph',
    });

    notify.handleEvent(buildContext(), { type: 'final' });
    expect(notifications).toHaveLength(0);
  });

  test('shows error notification with error message', async () => {
    const { createAgentCompletionNotifications } =
      await import('../../../src/main/services/notifications/agentCompletionNotifications');
    const notify = createAgentCompletionNotifications({
      getMainWindow: () =>
        ({
          isDestroyed: () => false,
          isVisible: () => true,
          isMinimized: () => false,
          isFocused: () => false,
        }) as never,
      emitToRenderer: vi.fn(),
      isNotificationsEnabled: () => true,
      resolveAgentName: () => 'Ralph',
    });

    notify.handleEvent(buildContext({ runId: 'run-error' }), { type: 'error', message: 'Oops' });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe('Ralph ran into an error.');
    expect(notifications[0].body).toBe('Oops');
  });

  test('does not notify on cancelled run', async () => {
    const { createAgentCompletionNotifications } =
      await import('../../../src/main/services/notifications/agentCompletionNotifications');
    const notify = createAgentCompletionNotifications({
      getMainWindow: () =>
        ({
          isDestroyed: () => false,
          isVisible: () => true,
          isMinimized: () => false,
          isFocused: () => false,
        }) as never,
      emitToRenderer: vi.fn(),
      isNotificationsEnabled: () => true,
      resolveAgentName: () => 'Ralph',
    });

    notify.handleEvent(buildContext({ runId: 'run-cancel' }), { type: 'final', cancelled: true });
    expect(notifications).toHaveLength(0);
  });

  test('does not notify when notifications are disabled', async () => {
    const { createAgentCompletionNotifications } =
      await import('../../../src/main/services/notifications/agentCompletionNotifications');
    const notify = createAgentCompletionNotifications({
      getMainWindow: () =>
        ({
          isDestroyed: () => false,
          isVisible: () => true,
          isMinimized: () => false,
          isFocused: () => false,
        }) as never,
      emitToRenderer: vi.fn(),
      isNotificationsEnabled: () => false,
      resolveAgentName: () => 'Ralph',
    });

    notify.handleEvent(buildContext({ runId: 'run-inactive' }), { type: 'final' });
    expect(notifications).toHaveLength(0);
  });
});
