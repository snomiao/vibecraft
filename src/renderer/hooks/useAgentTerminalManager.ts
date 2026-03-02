import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

interface UseAgentTerminalManagerResult {
  activeAgentTerminalId: string | null;
  setActiveAgentTerminalId: Dispatch<SetStateAction<string | null>>;
  closeAgentTerminals: (agentIds: Iterable<string>) => void;
}

export function useAgentTerminalManager(): UseAgentTerminalManagerResult {
  const [activeAgentTerminalId, setActiveAgentTerminalId] = useState<string | null>(null);

  const closeAgentTerminals = useCallback((agentIds: Iterable<string>) => {
    const ids = new Set(agentIds);
    if (ids.size === 0) return;
    setActiveAgentTerminalId((prev) => (prev && ids.has(prev) ? null : prev));
  }, []);

  return {
    activeAgentTerminalId,
    setActiveAgentTerminalId,
    closeAgentTerminals,
  };
}

export default useAgentTerminalManager;
