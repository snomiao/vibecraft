const HEARTBEAT_INTERVAL_MS = 15_000;
const HEARTBEAT_MAX_DRIFT_MS = HEARTBEAT_INTERVAL_MS * 2;
const IDLE_THRESHOLD_MS = 60_000;
const IDLE_POLL_INTERVAL_MS = 5_000;

export type SessionContext = {
  screen?: string | null;
  workspaceId?: string | null;
  workspaceName?: string | null;
};

type ListenerMap = {
  visibility?: () => void;
  focus?: () => void;
  blur?: () => void;
  beforeUnload?: (event: BeforeUnloadEvent) => void;
  powerSuspendUnsubscribe?: () => void;
  powerResumeUnsubscribe?: () => void;
};

type InternalSessionState = {
  started: boolean;
  sessionId: string;
  startTime: number;
  isForeground: boolean;
  isActive: boolean;
  isIdle: boolean;
  activeStart: number;
  activeMs: number;
  pausedAt: number | null;
  lastActiveTimestamp: number | null;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  idlePollTimer: ReturnType<typeof setInterval> | null;
  idleStartedAt: number | null;
  ended: boolean;
  windowId: number | null;
  context: {
    screen: string | null;
    workspaceId: string | null;
    workspaceName: string | null;
  };
  listeners: ListenerMap;
};

const sessionState: InternalSessionState = {
  started: false,
  sessionId: '',
  startTime: 0,
  isForeground: false,
  isActive: false,
  isIdle: false,
  activeStart: 0,
  activeMs: 0,
  pausedAt: null,
  lastActiveTimestamp: null,
  heartbeatTimer: null,
  idlePollTimer: null,
  idleStartedAt: null,
  ended: false,
  windowId: null,
  context: {
    screen: null,
    workspaceId: null,
    workspaceName: null,
  },
  listeners: {},
};

const randomId = () => {
  try {
    return window.crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random()}`;
  } catch {
    return `session-${Date.now()}-${Math.random()}`;
  }
};

const sanitizeProperties = (input: Record<string, unknown>) => {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      output[key] = value;
    }
  }
  return output;
};

const clampDelta = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.min(value, HEARTBEAT_MAX_DRIFT_MS);
};

export const sendEvent = (event: string, properties: Record<string, unknown> = {}) => {
  if (!sessionState.started || !window?.electronAPI?.captureTelemetryEvent) {
    return;
  }
  if (!event) {
    return;
  }

  const context = sessionState.context;
  const payload = sanitizeProperties({
    session_id: sessionState.sessionId,
    screen: context.screen ?? undefined,
    workspace_id: context.workspaceId ?? undefined,
    workspace_name: context.workspaceName ?? undefined,
    ...properties,
  });

  try {
    void window.electronAPI.captureTelemetryEvent({ event, properties: payload });
  } catch {
    // Swallow errors so analytics never blocks UX.
  }
};

export const getSessionId = (): string => sessionState.sessionId;

const computeActiveDelta = (now: number) => {
  if (sessionState.lastActiveTimestamp === null) {
    sessionState.lastActiveTimestamp = now;
    return 0;
  }
  const delta = clampDelta(now - sessionState.lastActiveTimestamp);
  sessionState.lastActiveTimestamp = now;
  if (delta > 0) {
    sessionState.activeMs += delta;
  }
  return delta;
};

const stopHeartbeat = () => {
  if (sessionState.heartbeatTimer) {
    clearInterval(sessionState.heartbeatTimer);
    sessionState.heartbeatTimer = null;
  }
};

const startHeartbeat = () => {
  if (!sessionState.started || sessionState.ended || sessionState.heartbeatTimer || !sessionState.isActive) {
    return;
  }

  sessionState.heartbeatTimer = setInterval(() => {
    if (!sessionState.started || sessionState.ended || !sessionState.isActive) {
      stopHeartbeat();
      return;
    }
    const now = Date.now();
    const delta = computeActiveDelta(now);
    if (delta <= 0) {
      return;
    }
    const elapsed = now - sessionState.startTime;
    sendEvent('active_heartbeat', {
      active_time_ms: sessionState.activeMs,
      active_time_ms_delta: delta,
      ms_since_last: delta,
      elapsed_ms: elapsed,
      window_id: sessionState.windowId ?? undefined,
    });
  }, HEARTBEAT_INTERVAL_MS);
};

const setActiveState = (active: boolean, reason: string, options: { pausedDuration?: number } = {}) => {
  if (!sessionState.started || sessionState.ended || sessionState.isActive === active) {
    return;
  }
  const now = Date.now();
  const elapsed = now - sessionState.startTime;

  if (!active) {
    computeActiveDelta(now);
    sessionState.isActive = false;
    sessionState.activeStart = 0;
    sessionState.lastActiveTimestamp = null;
    stopHeartbeat();
    sendEvent('session_paused', {
      reason,
      active_time_ms: sessionState.activeMs,
      elapsed_ms: elapsed,
    });
  } else {
    sessionState.isActive = true;
    sessionState.activeStart = now;
    sessionState.lastActiveTimestamp = now;
    startHeartbeat();
    sendEvent('session_resumed', {
      reason,
      paused_duration_ms: options.pausedDuration ?? 0,
      active_time_ms: sessionState.activeMs,
      elapsed_ms: elapsed,
    });
  }
};

const stopIdlePolling = () => {
  if (sessionState.idlePollTimer) {
    clearInterval(sessionState.idlePollTimer);
    sessionState.idlePollTimer = null;
  }
};

const evaluateIdleState = async (
  source: 'poll' | 'resume' = 'poll',
  resumeBaseline: number | null = null
) => {
  if (!sessionState.started || sessionState.ended || !window?.electronAPI?.getSystemIdleTime) {
    return;
  }
  try {
    const idleSeconds = await window.electronAPI.getSystemIdleTime();
    const idleMs = Math.max(0, idleSeconds * 1000);
    const nowIdle = idleMs >= IDLE_THRESHOLD_MS;
    const now = Date.now();
    if (sessionState.isIdle !== nowIdle) {
      sessionState.isIdle = nowIdle;
      if (nowIdle) {
        const idleStart = Math.max(sessionState.startTime, now - idleMs);
        sessionState.idleStartedAt = idleStart;
        setActiveState(false, 'system_idle');
      } else {
        const baseline = resumeBaseline ?? sessionState.idleStartedAt;
        const pausedDuration = baseline ? Math.max(0, now - baseline) : idleMs;
        sessionState.idleStartedAt = null;
        if (sessionState.isForeground) {
          setActiveState(true, source === 'resume' ? 'system_resume' : 'system_idle_resume', {
            pausedDuration,
          });
        }
      }
    } else if (!nowIdle && sessionState.isActive && sessionState.lastActiveTimestamp === null) {
      sessionState.lastActiveTimestamp = now;
    }
  } catch {
    /* noop */
  }
};

const startIdlePolling = () => {
  if (sessionState.idlePollTimer || !window?.electronAPI?.getSystemIdleTime) {
    return;
  }
  void evaluateIdleState();
  sessionState.idlePollTimer = setInterval(() => {
    void evaluateIdleState();
  }, IDLE_POLL_INTERVAL_MS);
};

const handlePowerSuspend = () => {
  if (!sessionState.started || sessionState.ended) {
    return;
  }
  sessionState.isIdle = true;
  sessionState.idleStartedAt = sessionState.idleStartedAt ?? Date.now();
  setActiveState(false, 'system_suspend');
};

const handlePowerResume = () => {
  if (!sessionState.started || sessionState.ended) {
    return;
  }
  const baseline = sessionState.idleStartedAt;
  void evaluateIdleState('resume', baseline);
};

const setForeground = (foreground: boolean, reason: string) => {
  if (!sessionState.started || sessionState.ended || sessionState.isForeground === foreground) {
    return;
  }
  const now = Date.now();

  if (!foreground) {
    sessionState.isForeground = false;
    sessionState.pausedAt = now;
    setActiveState(false, reason);
    sendEvent('focus_change', {
      reason,
      state: 'background',
      active_time_ms: sessionState.activeMs,
      elapsed_ms: now - sessionState.startTime,
    });
  } else {
    const pausedDuration = sessionState.pausedAt ? now - sessionState.pausedAt : 0;
    sessionState.isForeground = true;
    sessionState.pausedAt = null;
    if (!sessionState.isIdle) {
      setActiveState(true, reason, { pausedDuration });
    }
    sendEvent('focus_change', {
      reason,
      state: 'foreground',
      active_time_ms: sessionState.activeMs,
      elapsed_ms: now - sessionState.startTime,
    });
  }
};

const endSession = (reason: string) => {
  if (!sessionState.started || sessionState.ended) {
    return;
  }
  const now = Date.now();
  if (sessionState.isActive) {
    computeActiveDelta(now);
  }
  stopHeartbeat();
  stopIdlePolling();
  sessionState.ended = true;
  sessionState.isActive = false;
  sessionState.isIdle = false;
  sessionState.lastActiveTimestamp = null;
  const totalMs = now - sessionState.startTime;
  const activeMs = sessionState.activeMs;
  const ratio = totalMs > 0 ? activeMs / totalMs : 0;
  sendEvent('session_ended', {
    reason,
    ended_at: new Date(now).toISOString(),
    total_time_ms: totalMs,
    active_time_ms: activeMs,
    foreground_ratio: Number.isFinite(ratio) ? ratio : 0,
  });
};

const setContext = (context: SessionContext, emitScreenView = true) => {
  const previousScreen = sessionState.context.screen;
  const nextScreen = context.screen ?? sessionState.context.screen;
  const nextWorkspaceId = context.workspaceId ?? sessionState.context.workspaceId;
  const nextWorkspaceName = context.workspaceName ?? sessionState.context.workspaceName;

  sessionState.context = {
    screen: nextScreen ?? null,
    workspaceId: nextWorkspaceId ?? null,
    workspaceName: nextWorkspaceName ?? null,
  };

  if (!emitScreenView) {
    return;
  }
  if (context.screen && context.screen !== previousScreen) {
    sendEvent('screen_view', {
      screen_from: previousScreen ?? null,
    });
  }
};

const attachListeners = () => {
  if (!sessionState.started) {
    return;
  }

  const visibilityHandler = () =>
    setForeground(!document.hidden, document.hidden ? 'visibility_hidden' : 'visibility_visible');
  const focusHandler = () => setForeground(true, 'window_focus');
  const blurHandler = () => setForeground(false, 'window_blur');
  const beforeUnloadHandler = () => endSession('beforeunload');
  const powerSuspendUnsubscribe = window?.electronAPI?.onPowerSuspend
    ? window.electronAPI.onPowerSuspend(handlePowerSuspend)
    : undefined;
  const powerResumeUnsubscribe = window?.electronAPI?.onPowerResume
    ? window.electronAPI.onPowerResume(handlePowerResume)
    : undefined;

  document.addEventListener('visibilitychange', visibilityHandler);
  window.addEventListener('focus', focusHandler);
  window.addEventListener('blur', blurHandler);
  window.addEventListener('beforeunload', beforeUnloadHandler);

  sessionState.listeners = {
    visibility: visibilityHandler,
    focus: focusHandler,
    blur: blurHandler,
    beforeUnload: beforeUnloadHandler,
    powerSuspendUnsubscribe,
    powerResumeUnsubscribe,
  };
};

const detachListeners = () => {
  const { listeners } = sessionState;
  if (listeners.visibility) {
    document.removeEventListener('visibilitychange', listeners.visibility);
  }
  if (listeners.focus) {
    window.removeEventListener('focus', listeners.focus);
  }
  if (listeners.blur) {
    window.removeEventListener('blur', listeners.blur);
  }
  if (listeners.beforeUnload) {
    window.removeEventListener('beforeunload', listeners.beforeUnload);
  }
  if (listeners.powerSuspendUnsubscribe) {
    try {
      listeners.powerSuspendUnsubscribe();
    } catch {
      /* noop */
    }
  }
  if (listeners.powerResumeUnsubscribe) {
    try {
      listeners.powerResumeUnsubscribe();
    } catch {
      /* noop */
    }
  }
  sessionState.listeners = {};
};

export const initRendererAnalytics = (context: SessionContext = {}) => {
  if (!window?.electronAPI?.captureTelemetryEvent) {
    return;
  }

  if (sessionState.started) {
    setContext(context);
    return;
  }

  sessionState.started = true;
  sessionState.sessionId = randomId();
  sessionState.startTime = Date.now();
  sessionState.isForeground = !document.hidden && document.hasFocus();
  sessionState.isIdle = false;
  sessionState.isActive = sessionState.isForeground;
  sessionState.activeStart = sessionState.isActive ? sessionState.startTime : 0;
  sessionState.activeMs = 0;
  sessionState.pausedAt = sessionState.isActive ? null : sessionState.startTime;
  sessionState.lastActiveTimestamp = sessionState.isActive ? sessionState.startTime : null;
  sessionState.heartbeatTimer = null;
  sessionState.idlePollTimer = null;
  sessionState.idleStartedAt = null;
  sessionState.ended = false;
  sessionState.windowId = null;
  sessionState.listeners = {};

  setContext(context, false);

  sendEvent('session_started', {
    started_at: new Date(sessionState.startTime).toISOString(),
    initial_state: sessionState.isForeground ? 'foreground' : 'background',
  });

  if (window.electronAPI?.getWindowId) {
    void window.electronAPI
      .getWindowId()
      .then((id) => {
        if (sessionState.started) {
          sessionState.windowId = typeof id === 'number' ? id : null;
        }
      })
      .catch(() => {
        sessionState.windowId = null;
      });
  }

  attachListeners();
  startIdlePolling();
  if (sessionState.isActive) {
    startHeartbeat();
  }
};

export const updateRendererAnalyticsContext = (context: SessionContext) => {
  if (!sessionState.started) {
    initRendererAnalytics(context);
    return;
  }
  setContext(context);
};

export const shutdownRendererAnalytics = (reason = 'unmount') => {
  if (!sessionState.started) {
    return;
  }
  detachListeners();
  if (!sessionState.ended) {
    endSession(reason);
  }
  stopHeartbeat();
  stopIdlePolling();
  sessionState.isActive = false;
  sessionState.isIdle = false;
  sessionState.lastActiveTimestamp = null;
  sessionState.windowId = null;
  sessionState.started = false;
};
