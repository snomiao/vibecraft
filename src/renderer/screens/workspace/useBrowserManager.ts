import { useCallback, useEffect, useRef } from 'react';
import type { BrowserPanel, SelectedEntityRef } from '../../../shared/types';
import type { CommandRunResult } from '../../../shared/commands';
import { workspaceClient } from '../../services/workspaceClient';
import type { DialogMessage } from './types';
import { usePerEntityThrottle } from './usePerEntityThrottle';

type BrowserZIndexDomain = {
  browserZIndices: Record<string, number>;
  bringBrowserToFront: (browserId: string) => void;
  syncBrowserIds: (ids: string[]) => void;
};

export interface UseBrowserManagerParams {
  workspacePath: string;
  browsers: BrowserPanel[];
  setBrowsers: React.Dispatch<React.SetStateAction<BrowserPanel[]>>;
  setMessageDialog: (msg: DialogMessage | null) => void;
  selectedEntityId: string | null;
  setSelectedEntity: (entity: SelectedEntityRef | null) => void;
  zIndex: BrowserZIndexDomain;
}

export interface UseBrowserManagerReturn {
  browserZIndices: Record<string, number>;
  bringBrowserToFront: (browserId: string) => void;
  handleBrowserMove: (id: string, x: number, y: number) => Promise<CommandRunResult>;
  handleBrowserMoveEnd: (id: string, x: number, y: number) => Promise<CommandRunResult>;
  handleBrowserResize: (id: string, width: number, height: number) => Promise<CommandRunResult>;
  handleBrowserResizeEnd: (id: string, width: number, height: number) => Promise<CommandRunResult>;
  handleBrowserUrlChange: (id: string, url: string) => Promise<CommandRunResult>;
  handleBrowserFaviconChange: (id: string, faviconUrl?: string | null) => Promise<CommandRunResult>;
  handleBrowserRefresh: (id: string) => Promise<CommandRunResult>;
  handleBrowserClose: (id: string) => Promise<CommandRunResult>;
  clearBrowserRefreshToken: (id: string) => void;
}

const okResult = (): CommandRunResult => ({ ok: true });
const errorResult = (error: string): CommandRunResult => ({ ok: false, error });
const PERSIST_INTERVAL_MS = 200;

export function useBrowserManager({
  workspacePath,
  browsers,
  setBrowsers,
  setMessageDialog,
  selectedEntityId,
  setSelectedEntity,
  zIndex,
}: UseBrowserManagerParams): UseBrowserManagerReturn {
  const refreshTokenRef = useRef<number>(0);
  const activeBrowserIdsRef = useRef<Set<string>>(new Set());
  const persistQueueByIdRef = useRef<Map<string, Promise<boolean>>>(new Map());

  useEffect(() => {
    zIndex.syncBrowserIds(browsers.map((browser) => browser.id));
    activeBrowserIdsRef.current = new Set(browsers.map((browser) => browser.id));
  }, [browsers, zIndex]);

  const enqueuePersist = useCallback(
    (id: string, updates: Partial<BrowserPanel>, notifyOnError = false): Promise<boolean> => {
      const isActive = () => activeBrowserIdsRef.current.has(id);
      if (!isActive()) {
        return Promise.resolve(false);
      }

      const previous = persistQueueByIdRef.current.get(id) ?? Promise.resolve(true);
      const next = previous
        .catch(() => true)
        .then(async () => {
          if (!isActive()) return false;
          try {
            const success = await workspaceClient.updateBrowserPanel(workspacePath, id, updates);
            if (!success && notifyOnError) {
              setMessageDialog({
                title: 'Error',
                message: 'Failed to persist browser changes',
                type: 'error',
              });
            }
            return success;
          } catch (error) {
            if (notifyOnError) {
              setMessageDialog({
                title: 'Error',
                message: error instanceof Error ? error.message : 'Failed to persist browser changes',
                type: 'error',
              });
            }
            return false;
          }
        });

      persistQueueByIdRef.current.set(id, next);
      return next;
    },
    [setMessageDialog, workspacePath]
  );

  const throttledPersist = usePerEntityThrottle<Partial<BrowserPanel>>({
    intervalMs: PERSIST_INTERVAL_MS,
    onFlush: (id, updates) => {
      void enqueuePersist(id, updates, false);
    },
  });

  const handleBrowserMove = useCallback(
    async (id: string, x: number, y: number): Promise<CommandRunResult> => {
      setBrowsers((prev) => prev.map((browser) => (browser.id === id ? { ...browser, x, y } : browser)));
      throttledPersist.schedule(id, { x, y });
      return okResult();
    },
    [setBrowsers, throttledPersist]
  );

  const handleBrowserMoveEnd = useCallback(
    async (id: string, x: number, y: number): Promise<CommandRunResult> => {
      throttledPersist.clear(id);
      const success = await enqueuePersist(id, { x, y }, true);
      return success ? okResult() : errorResult('Failed to update browser position');
    },
    [enqueuePersist, throttledPersist]
  );

  const handleBrowserResize = useCallback(
    async (id: string, width: number, height: number): Promise<CommandRunResult> => {
      setBrowsers((prev) =>
        prev.map((browser) => (browser.id === id ? { ...browser, width, height } : browser))
      );
      throttledPersist.schedule(id, { width, height });
      return okResult();
    },
    [setBrowsers, throttledPersist]
  );

  const handleBrowserResizeEnd = useCallback(
    async (id: string, width: number, height: number): Promise<CommandRunResult> => {
      throttledPersist.clear(id);
      const success = await enqueuePersist(id, { width, height }, true);
      return success ? okResult() : errorResult('Failed to update browser size');
    },
    [enqueuePersist, throttledPersist]
  );

  const handleBrowserUrlChange = useCallback(
    async (id: string, url: string): Promise<CommandRunResult> => {
      const previousUrl = browsers.find((browser) => browser.id === id)?.url;
      setBrowsers((prev) =>
        prev.map((browser) => (browser.id === id ? { ...browser, url, faviconUrl: undefined } : browser))
      );

      const success = await enqueuePersist(id, { url, faviconUrl: undefined }, true);
      if (success) {
        return okResult();
      }

      if (previousUrl) {
        setBrowsers((prev) =>
          prev.map((browser) => (browser.id === id ? { ...browser, url: previousUrl } : browser))
        );
      }
      return errorResult('Failed to update browser URL');
    },
    [browsers, enqueuePersist, setBrowsers]
  );

  const handleBrowserFaviconChange = useCallback(
    async (id: string, faviconUrl?: string | null): Promise<CommandRunResult> => {
      const nextFavicon = faviconUrl || undefined;
      setBrowsers((prev) =>
        prev.map((browser) => (browser.id === id ? { ...browser, faviconUrl: nextFavicon } : browser))
      );
      const shouldPersist = !nextFavicon || (!nextFavicon.startsWith('data:') && nextFavicon.length <= 2048);
      if (shouldPersist) {
        void enqueuePersist(id, { faviconUrl: nextFavicon }, false);
      } else {
        void enqueuePersist(id, { faviconUrl: undefined }, false);
      }
      return okResult();
    },
    [enqueuePersist, setBrowsers]
  );

  const handleBrowserRefresh = useCallback(
    async (id: string): Promise<CommandRunResult> => {
      if (!browsers.some((browser) => browser.id === id)) {
        return errorResult('Browser not found');
      }
      const refreshToken = (refreshTokenRef.current += 1);
      setBrowsers((prev) =>
        prev.map((browser) => (browser.id === id ? { ...browser, refreshToken } : browser))
      );
      return okResult();
    },
    [browsers, setBrowsers]
  );

  const clearBrowserRefreshToken = useCallback(
    (id: string) => {
      setBrowsers((prev) =>
        prev.map((browser) => (browser.id === id ? { ...browser, refreshToken: undefined } : browser))
      );
      void enqueuePersist(id, { refreshToken: undefined }, false);
    },
    [enqueuePersist, setBrowsers]
  );

  const handleBrowserClose = useCallback(
    async (id: string): Promise<CommandRunResult> => {
      try {
        throttledPersist.clear(id);
        activeBrowserIdsRef.current.delete(id);
        persistQueueByIdRef.current.delete(id);
        const result = await workspaceClient.deleteBrowserPanel(workspacePath, id);
        if (result) {
          setBrowsers((prev) => prev.filter((browser) => browser.id !== id));
          if (selectedEntityId === id) setSelectedEntity(null);
          return okResult();
        }
        const errorMessage = 'Failed to close browser panel';
        setMessageDialog({
          title: 'Error',
          message: errorMessage,
          type: 'error',
        });
        return errorResult(errorMessage);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to close browser panel';
        setMessageDialog({
          title: 'Error',
          message: errorMessage,
          type: 'error',
        });
        return errorResult(errorMessage);
      }
    },
    [selectedEntityId, setBrowsers, setMessageDialog, setSelectedEntity, throttledPersist, workspacePath]
  );

  return {
    browserZIndices: zIndex.browserZIndices,
    bringBrowserToFront: zIndex.bringBrowserToFront,
    handleBrowserMove,
    handleBrowserMoveEnd,
    handleBrowserResize,
    handleBrowserResizeEnd,
    handleBrowserUrlChange,
    handleBrowserFaviconChange,
    handleBrowserRefresh,
    handleBrowserClose,
    clearBrowserRefreshToken,
  };
}
