import { ipcMain } from 'electron';
import type {
  CommandBatchItem,
  CommandInvocation,
  CommandRunRequest,
  CommandRunResponse,
} from '../shared/commands';
import { getMainWindow } from './index';
import { logger } from './logger';
import { safeWebContentsSend } from './ipc/safeSend';
import { waitForRendererReady } from './rendererLifecycle';

const log = logger.scope('command-bridge');
const RESPONSE_TIMEOUT_MS = 15000;
const RENDERER_READY_TIMEOUT_MS = 15000;
const pending = new Map<
  string,
  { resolve: (response: CommandRunResponse) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }
>();

const createRequestId = (): string => `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export function registerCommandBridge(): void {
  ipcMain.on('command-run-response', (_event, response: CommandRunResponse) => {
    const pendingRequest = pending.get(response.requestId);
    if (!pendingRequest) return;
    clearTimeout(pendingRequest.timeout);
    pending.delete(response.requestId);
    pendingRequest.resolve(response);
  });
}

const sendRequest = (request: CommandRunRequest): Promise<CommandRunResponse> => {
  const window = getMainWindow();
  if (!window || window.isDestroyed()) {
    return Promise.reject(new Error('Main window unavailable'));
  }

  return new Promise((resolve, reject) => {
    let completed = false;

    let responseTimeout: NodeJS.Timeout | null = null;

    const safeResolve = (response: CommandRunResponse) => {
      if (completed) return;
      completed = true;
      if (responseTimeout) clearTimeout(responseTimeout);
      pending.delete(request.requestId);
      resolve(response);
    };

    const safeReject = (error: Error) => {
      if (completed) return;
      completed = true;
      if (responseTimeout) clearTimeout(responseTimeout);
      pending.delete(request.requestId);
      reject(error);
    };

    void waitForRendererReady(window.webContents, RENDERER_READY_TIMEOUT_MS)
      .then(() => {
        if (completed) return;
        responseTimeout = setTimeout(() => {
          if (completed) return;
          completed = true;
          pending.delete(request.requestId);
          reject(new Error('Command bridge timeout'));
        }, RESPONSE_TIMEOUT_MS);
        pending.set(request.requestId, {
          resolve: safeResolve,
          reject: safeReject,
          timeout: responseTimeout,
        });
        const sent = safeWebContentsSend(window.webContents, 'command-run-request', request);
        if (!sent) {
          safeReject(new Error('Renderer unavailable'));
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        safeReject(new Error(message));
      });
  });
};

export const runRendererCommand = async (
  command: CommandInvocation,
  workspacePath: string
): Promise<CommandRunResponse> => {
  return sendRequest({
    kind: 'single',
    requestId: createRequestId(),
    workspacePath,
    command,
  });
};

export const runRendererCommandBatch = async (
  commands: CommandBatchItem[],
  workspacePath: string
): Promise<CommandRunResponse> => {
  if (commands.length === 0) {
    log.info('Received empty command batch');
  }

  return sendRequest({
    kind: 'batch',
    requestId: createRequestId(),
    workspacePath,
    commands,
  });
};
