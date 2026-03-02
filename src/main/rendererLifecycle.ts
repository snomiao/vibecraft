import type { BrowserWindow, WebContents } from 'electron';

type ReadyWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

type RendererState = {
  ready: boolean;
  waiters: Set<ReadyWaiter>;
  readyListeners: Set<() => void>;
};

const rendererStates = new WeakMap<WebContents, RendererState>();

const ensureState = (contents: WebContents): RendererState => {
  const existing = rendererStates.get(contents);
  if (existing) return existing;
  const state: RendererState = {
    ready: !contents.isDestroyed() && !contents.isLoadingMainFrame(),
    waiters: new Set(),
    readyListeners: new Set(),
  };
  rendererStates.set(contents, state);
  return state;
};

const resolveWaiters = (state: RendererState): void => {
  const waiters = Array.from(state.waiters);
  state.waiters.clear();
  waiters.forEach((waiter) => {
    clearTimeout(waiter.timeout);
    waiter.resolve();
  });
};

const notifyReadyListeners = (state: RendererState): void => {
  state.readyListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* noop */
    }
  });
};

const rejectWaiters = (state: RendererState, message: string): void => {
  const waiters = Array.from(state.waiters);
  state.waiters.clear();
  waiters.forEach((waiter) => {
    clearTimeout(waiter.timeout);
    waiter.reject(new Error(message));
  });
};

const clearReadyListeners = (state: RendererState): void => {
  state.readyListeners.clear();
};

export const isRendererReady = (contents: WebContents): boolean => {
  if (contents.isDestroyed()) return false;
  const state = rendererStates.get(contents);
  if (state) return state.ready;
  return !contents.isLoadingMainFrame();
};

export const waitForRendererReady = (contents: WebContents, timeoutMs: number): Promise<void> => {
  if (isRendererReady(contents)) {
    return Promise.resolve();
  }

  const state = ensureState(contents);
  return new Promise((resolve, reject) => {
    const waiter: ReadyWaiter = {
      resolve: () => resolve(),
      reject: (error) => reject(error),
      timeout: setTimeout(() => {
        state.waiters.delete(waiter);
        reject(new Error('Renderer not ready'));
      }, timeoutMs),
    };
    state.waiters.add(waiter);
  });
};

export const onRendererReady = (contents: WebContents, listener: () => void): (() => void) => {
  const state = ensureState(contents);
  state.readyListeners.add(listener);
  if (state.ready) {
    queueMicrotask(() => {
      if (state.readyListeners.has(listener)) {
        listener();
      }
    });
  }
  return () => {
    state.readyListeners.delete(listener);
  };
};

export const registerRendererLifecycle = (window: BrowserWindow): void => {
  const contents = window.webContents;
  const state = ensureState(contents);
  state.ready = !contents.isDestroyed() && !contents.isLoadingMainFrame();

  contents.on('did-start-loading', () => {
    if (contents.isLoadingMainFrame()) {
      state.ready = false;
    }
  });

  contents.on('did-finish-load', () => {
    state.ready = true;
    resolveWaiters(state);
    notifyReadyListeners(state);
  });

  contents.on('did-fail-load', () => {
    state.ready = false;
  });

  contents.on('render-process-gone', () => {
    state.ready = false;
    rejectWaiters(state, 'Renderer process gone');
    clearReadyListeners(state);
  });

  contents.on('destroyed', () => {
    state.ready = false;
    rejectWaiters(state, 'Renderer destroyed');
    clearReadyListeners(state);
  });
};
