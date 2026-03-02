import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TerminalPanel as TerminalPanelRecord, SelectedEntityRef } from '../../../shared/types';
import type { CommandRunResult } from '../../../shared/commands';
import { workspaceClient } from '../../services/workspaceClient';
import useTerminalManager from '../../hooks/useTerminalManager';
import { usePerEntityThrottle } from './usePerEntityThrottle';

type TerminalZIndexDomain = {
  terminalZIndices: Record<string, number>;
  bringTerminalToFront: (terminalId: string) => void;
  syncTerminalIds: (ids: string[]) => void;
};

type UseWorkspaceTerminalsParams = {
  workspacePath: string;
  selectedEntityRef: SelectedEntityRef | null;
  setSelectedEntityRef: React.Dispatch<React.SetStateAction<SelectedEntityRef | null>>;
  setMessageDialog: (message: { title: string; message: string; type: 'info' | 'warning' | 'error' }) => void;
  zIndex: TerminalZIndexDomain;
};

type UseWorkspaceTerminalsReturn = {
  terminals: Record<string, TerminalPanelRecord>;
  terminalList: TerminalPanelRecord[];
  terminalZIndices: Record<string, number>;
  reloadTerminals: () => Promise<void>;
  bringTerminalToFront: (terminalId: string) => void;
  addTerminal: (terminal: TerminalPanelRecord) => void;
  closeTerminalById: (terminalId: string) => Promise<CommandRunResult>;
  updateTerminalRecord: (
    terminalId: string,
    updates: Partial<TerminalPanelRecord>,
    persist?: boolean
  ) => Promise<CommandRunResult>;
  moveTerminal: (terminalId: string, x: number, y: number) => Promise<CommandRunResult>;
  resizeTerminal: (terminalId: string, width: number, height: number) => Promise<CommandRunResult>;
  handleTerminalMove: (terminalId: string, x: number, y: number) => Promise<CommandRunResult>;
  handleTerminalMoveEnd: (terminalId: string, x: number, y: number) => Promise<CommandRunResult>;
  handleTerminalResize: (terminalId: string, width: number, height: number) => Promise<CommandRunResult>;
  handleTerminalResizeEnd: (terminalId: string, width: number, height: number) => Promise<CommandRunResult>;
  terminalProcessById: Record<string, string | null>;
  handleTerminalProcessChange: (terminalId: string, processLabel: string | null) => void;
};

const okResult = (): CommandRunResult => ({ ok: true });
const errorResult = (error: string): CommandRunResult => ({ ok: false, error });
const PERSIST_INTERVAL_MS = 200;

export function useWorkspaceTerminals({
  workspacePath,
  selectedEntityRef,
  setSelectedEntityRef,
  setMessageDialog,
  zIndex,
}: UseWorkspaceTerminalsParams): UseWorkspaceTerminalsReturn {
  const { terminals, setTerminals, closeTerminals } = useTerminalManager();
  const [terminalProcessById, setTerminalProcessById] = useState<Record<string, string | null>>({});
  const activeTerminalIdsRef = useRef<Set<string>>(new Set());
  const persistQueueByIdRef = useRef<Map<string, Promise<boolean>>>(new Map());

  const terminalList = useMemo(() => Object.values(terminals), [terminals]);

  const reloadTerminals = useCallback(async () => {
    const data = await workspaceClient.loadTerminals(workspacePath);
    const next = data.reduce<Record<string, TerminalPanelRecord>>((acc, terminal) => {
      acc[terminal.id] = terminal;
      return acc;
    }, {});
    setTerminals(next);
  }, [workspacePath, setTerminals]);

  useEffect(() => {
    void reloadTerminals();
  }, [reloadTerminals]);

  useEffect(() => {
    const ids = Object.keys(terminals);
    zIndex.syncTerminalIds(ids);
    activeTerminalIdsRef.current = new Set(ids);
  }, [terminals, zIndex]);

  useEffect(() => {
    const terminalIds = new Set(Object.keys(terminals));
    setTerminalProcessById((prev) => {
      let changed = false;
      const next: Record<string, string | null> = {};
      Object.entries(prev).forEach(([terminalId, label]) => {
        if (terminalIds.has(terminalId)) {
          next[terminalId] = label;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [terminals]);

  const enqueuePersist = useCallback(
    (terminalId: string, updates: Partial<TerminalPanelRecord>, notifyOnError = false): Promise<boolean> => {
      const isActive = () => activeTerminalIdsRef.current.has(terminalId);
      if (!isActive()) {
        return Promise.resolve(false);
      }

      const previous = persistQueueByIdRef.current.get(terminalId) ?? Promise.resolve(true);
      const next = previous
        .catch(() => true)
        .then(async () => {
          if (!isActive()) return false;
          try {
            const result = await workspaceClient.updateTerminal(workspacePath, terminalId, updates);
            if (!result.success && notifyOnError) {
              setMessageDialog({
                title: 'Warning',
                message: result.error || 'Failed to persist terminal changes',
                type: 'warning',
              });
            }
            return result.success;
          } catch (error) {
            if (notifyOnError) {
              setMessageDialog({
                title: 'Warning',
                message: error instanceof Error ? error.message : 'Failed to persist terminal changes',
                type: 'warning',
              });
            }
            return false;
          }
        });

      persistQueueByIdRef.current.set(terminalId, next);
      return next;
    },
    [setMessageDialog, workspacePath]
  );

  const throttledPersist = usePerEntityThrottle<Partial<TerminalPanelRecord>>({
    intervalMs: PERSIST_INTERVAL_MS,
    onFlush: (terminalId, updates) => {
      void enqueuePersist(terminalId, updates, false);
    },
  });

  const closeTerminalById = useCallback(
    async (terminalId: string): Promise<CommandRunResult> => {
      const stopped = await workspaceClient.stopTerminalSession(terminalId);
      let errorMessage: string | null = null;
      if (!stopped) {
        setMessageDialog({
          title: 'Warning',
          message: 'Terminal session could not be stopped. It may still be running in the background.',
          type: 'warning',
        });
        errorMessage = 'Terminal session could not be stopped';
      }

      throttledPersist.clear(terminalId);
      activeTerminalIdsRef.current.delete(terminalId);
      persistQueueByIdRef.current.delete(terminalId);
      closeTerminals([terminalId]);

      if (selectedEntityRef?.type === 'terminal' && selectedEntityRef.id === terminalId) {
        setSelectedEntityRef(null);
      }
      setTerminalProcessById((prev) => {
        if (!prev[terminalId]) return prev;
        const next = { ...prev };
        delete next[terminalId];
        return next;
      });
      const deleted = await workspaceClient.deleteTerminal(workspacePath, terminalId);
      if (!deleted) {
        setMessageDialog({
          title: 'Warning',
          message: 'Terminal closed, but storage cleanup failed. It may reappear next time.',
          type: 'warning',
        });
        errorMessage = errorMessage
          ? `${errorMessage}; storage cleanup failed`
          : 'Terminal closed, but storage cleanup failed';
      }
      if (errorMessage) {
        return errorResult(errorMessage);
      }
      return okResult();
    },
    [
      closeTerminals,
      selectedEntityRef,
      setMessageDialog,
      setSelectedEntityRef,
      throttledPersist,
      workspacePath,
    ]
  );

  const updateTerminalRecord = useCallback(
    async (terminalId: string, updates: Partial<TerminalPanelRecord>, persist = true) => {
      setTerminals((prev) => {
        const current = prev[terminalId];
        if (!current) return prev;
        return { ...prev, [terminalId]: { ...current, ...updates } };
      });

      if (!persist) {
        return okResult();
      }

      const success = await enqueuePersist(terminalId, updates, false);
      return success ? okResult() : errorResult('Failed to update terminal');
    },
    [enqueuePersist, setTerminals]
  );

  const moveTerminal = async (terminalId: string, x: number, y: number) => {
    return updateTerminalRecord(terminalId, { x, y });
  };

  const resizeTerminal = async (terminalId: string, width: number, height: number) => {
    return updateTerminalRecord(terminalId, { width, height });
  };

  const handleTerminalMove = useCallback(
    async (terminalId: string, x: number, y: number) => {
      const result = await updateTerminalRecord(terminalId, { x, y }, false);
      throttledPersist.schedule(terminalId, { x, y });
      return result;
    },
    [throttledPersist, updateTerminalRecord]
  );

  const handleTerminalMoveEnd = useCallback(
    async (terminalId: string, x: number, y: number) => {
      throttledPersist.clear(terminalId);
      const success = await enqueuePersist(terminalId, { x, y }, true);
      return success ? okResult() : errorResult('Failed to update terminal position');
    },
    [enqueuePersist, throttledPersist]
  );

  const handleTerminalResize = useCallback(
    async (terminalId: string, width: number, height: number) => {
      const result = await updateTerminalRecord(terminalId, { width, height }, false);
      throttledPersist.schedule(terminalId, { width, height });
      return result;
    },
    [throttledPersist, updateTerminalRecord]
  );

  const handleTerminalResizeEnd = useCallback(
    async (terminalId: string, width: number, height: number) => {
      throttledPersist.clear(terminalId);
      const success = await enqueuePersist(terminalId, { width, height }, true);
      return success ? okResult() : errorResult('Failed to update terminal size');
    },
    [enqueuePersist, throttledPersist]
  );

  const handleTerminalProcessChange = useCallback((terminalId: string, processLabel: string | null) => {
    setTerminalProcessById((prev) => {
      if (prev[terminalId] === processLabel) return prev;
      return { ...prev, [terminalId]: processLabel };
    });
  }, []);

  const addTerminal = useCallback(
    (terminal: TerminalPanelRecord) => {
      setTerminals((prev) => ({ ...prev, [terminal.id]: terminal }));
      zIndex.bringTerminalToFront(terminal.id);
    },
    [setTerminals, zIndex]
  );

  return {
    terminals,
    terminalList,
    terminalZIndices: zIndex.terminalZIndices,
    reloadTerminals,
    bringTerminalToFront: zIndex.bringTerminalToFront,
    addTerminal,
    closeTerminalById,
    updateTerminalRecord,
    moveTerminal,
    resizeTerminal,
    handleTerminalMove,
    handleTerminalMoveEnd,
    handleTerminalResize,
    handleTerminalResizeEnd,
    terminalProcessById,
    handleTerminalProcessChange,
  };
}
