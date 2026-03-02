import { ipcMain } from 'electron';
import type { LayoutRequest, LayoutResponse } from '../shared/layout';
import { getMainWindow } from './index';
import { safeWebContentsSend } from './ipc/safeSend';
import { waitForRendererReady } from './rendererLifecycle';

const RESPONSE_TIMEOUT_MS = 10000;
const RENDERER_READY_TIMEOUT_MS = 15000;
const pending = new Map<
  string,
  { resolve: (response: LayoutResponse) => void; reject: (error: Error) => void; timeout: NodeJS.Timeout }
>();

const createRequestId = (): string => `layout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export function registerLayoutBridge(): void {
  ipcMain.on('layout-response', (_event, response: LayoutResponse) => {
    const pendingRequest = pending.get(response.requestId);
    if (!pendingRequest) return;
    clearTimeout(pendingRequest.timeout);
    pending.delete(response.requestId);
    pendingRequest.resolve(response);
  });
}

const sendRequest = (request: LayoutRequest): Promise<LayoutResponse> => {
  const window = getMainWindow();
  if (!window || window.isDestroyed()) {
    return Promise.reject(new Error('Main window unavailable'));
  }

  return new Promise((resolve, reject) => {
    let completed = false;

    let responseTimeout: NodeJS.Timeout | null = null;

    const safeResolve = (response: LayoutResponse) => {
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
          reject(new Error('Layout bridge timeout'));
        }, RESPONSE_TIMEOUT_MS);
        pending.set(request.requestId, {
          resolve: safeResolve,
          reject: safeReject,
          timeout: responseTimeout,
        });
        const sent = safeWebContentsSend(window.webContents, 'layout-request', request);
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

export const requestWorkspaceLayout = async (workspacePath: string): Promise<LayoutResponse> => {
  return sendRequest({
    requestId: createRequestId(),
    workspacePath,
  });
};
