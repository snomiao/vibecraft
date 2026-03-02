import { app, BrowserWindow, powerMonitor } from 'electron';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { APP_VERSION } from './appVersion';

export type TelemetryContextSnapshot = {
  distinctId: string;
  version: string;
  platform: string;
};

export type TelemetryEventPayload = {
  event: string;
  properties?: Record<string, unknown>;
};

type PostHogClient = {
  identify: (opts: { distinctId: string; properties?: Record<string, unknown> }) => void;
  capture: (opts: { distinctId: string; event: string; properties?: Record<string, unknown> }) => void;
  flush: () => Promise<void>;
  shutdown: () => Promise<void>;
};

let phClient: PostHogClient | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
let telemetryContext: TelemetryContextSnapshot | null = null;

const getInstallIdPath = (): string => {
  const userData = app.getPath('userData');
  return path.join(userData, 'install-id');
};

const getOrCreateInstallId = (): { id: string; isNew: boolean } => {
  const idPath = getInstallIdPath();
  try {
    if (fs.existsSync(idPath)) {
      const id = fs.readFileSync(idPath, 'utf8').trim();
      if (id) return { id, isNew: false };
    }
  } catch {
    // Fall through to create new
  }
  const newId = randomUUID();
  try {
    const dir = path.dirname(idPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(idPath, newId, 'utf8');
  } catch {
    // Continue with in-memory ID
  }
  return { id: newId, isNew: true };
};

export const initTelemetry = async (): Promise<void> => {
  try {
    if (!app.isPackaged || process.env.NODE_ENV === 'development') return;
    const apiKey = process.env.POSTHOG_API_KEY;
    if (!apiKey) return;

    const host = process.env.POSTHOG_HOST || 'https://app.posthog.com';

    // Dynamic import to avoid bundling posthog-node if not used
    const { PostHog } = await import('posthog-node');
    phClient = new PostHog(apiKey, { host });

    const { id: distinctId, isNew } = getOrCreateInstallId();
    const version = APP_VERSION;
    const platform = process.platform;
    telemetryContext = { distinctId, version, platform };

    const client = phClient;
    client.identify({ distinctId, properties: { version, platform } });
    if (isNew) {
      client.capture({ distinctId, event: 'install', properties: { version, platform } });
    }
    client.capture({ distinctId, event: 'app_started', properties: { version, platform } });

    // Daily heartbeat
    heartbeatTimer = setInterval(
      () => {
        if (!phClient || !telemetryContext) return;
        phClient.capture({
          distinctId: telemetryContext.distinctId,
          event: 'daily_heartbeat',
          properties: { version: telemetryContext.version, platform: telemetryContext.platform },
        });
      },
      24 * 60 * 60 * 1000
    );

    // Flush on exit
    app.on('before-quit', () => {
      try {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
      } catch {
        // noop
      }
      try {
        phClient?.flush?.();
      } catch {
        // noop
      }
      try {
        phClient?.shutdown?.();
      } catch {
        // noop
      }
    });
  } catch (e) {
    console.warn('[telemetry] init failed', e);
  }
};

export const captureTelemetryEvent = (
  payload: TelemetryEventPayload
): { success: boolean; error?: string } => {
  try {
    if (!phClient || !telemetryContext) {
      return { success: false, error: 'telemetry_disabled' };
    }
    const event = payload.event;
    if (!event) {
      return { success: false, error: 'invalid_event' };
    }
    const properties = payload.properties && typeof payload.properties === 'object' ? payload.properties : {};
    phClient.capture({
      distinctId: telemetryContext.distinctId,
      event,
      properties: {
        app_version: telemetryContext.version,
        platform: telemetryContext.platform,
        version: telemetryContext.version,
        ...properties,
      },
    });
    return { success: true };
  } catch (error) {
    console.warn('[telemetry] capture failed', error);
    return { success: false, error: error instanceof Error ? error.message : 'capture_failed' };
  }
};

export const getTelemetryContext = (): TelemetryContextSnapshot | null => {
  return telemetryContext;
};

export const getSystemIdleTime = (): number => {
  try {
    return powerMonitor.getSystemIdleTime();
  } catch {
    return 0;
  }
};

export const broadcastPowerEvent = (event: 'power-suspend' | 'power-resume'): void => {
  BrowserWindow.getAllWindows().forEach((win) => {
    try {
      win.webContents.send(event);
    } catch {
      // noop
    }
  });
};

export const setupPowerMonitorListeners = (): void => {
  powerMonitor.on('suspend', () => broadcastPowerEvent('power-suspend'));
  powerMonitor.on('resume', () => broadcastPowerEvent('power-resume'));
};
