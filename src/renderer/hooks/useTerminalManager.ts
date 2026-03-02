import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { TerminalPanel } from '../../shared/types';

interface TerminalState {
  [terminalId: string]: TerminalPanel;
}

interface UseTerminalManagerResult {
  terminals: TerminalState;
  setTerminals: Dispatch<SetStateAction<TerminalState>>;
  closeTerminals: (terminalIds: Iterable<string>) => void;
}

export function useTerminalManager(): UseTerminalManagerResult {
  const [terminals, setTerminals] = useState<TerminalState>({});

  const closeTerminals = useCallback((terminalIds: Iterable<string>) => {
    const ids = Array.from(terminalIds);
    if (!ids.length) return;
    setTerminals((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        delete next[id];
      });
      return next;
    });
  }, []);

  return {
    terminals,
    setTerminals,
    closeTerminals,
  };
}

export default useTerminalManager;
