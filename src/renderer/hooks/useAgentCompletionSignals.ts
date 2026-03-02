import { useEffect, useRef } from 'react';
import type { Agent, AgentConnectEventPayload } from '../../shared/types';
import { useSoundPlayer } from './useSoundPlayer';

const isForeground = (): boolean => document.visibilityState === 'visible' && document.hasFocus();

export const useAgentCompletionSignals = (agents: Agent[]): void => {
  const { playSound } = useSoundPlayer();
  const handledRunsRef = useRef<Set<string>>(new Set());
  const agentsRef = useRef<Agent[]>(agents);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    if (window.electronAPI.isTestMode) return;

    const handleEvent = (payload: AgentConnectEventPayload) => {
      if (payload.unit.type !== 'agent') return;
      const { runId, event } = payload;
      if (handledRunsRef.current.has(runId)) return;

      if (event.type === 'final') {
        handledRunsRef.current.add(runId);
        if (event.cancelled) return;
        const provider = agentsRef.current.find((agent) => agent.id === payload.unit.id)?.provider;
        playSound('agent.completion', { provider });
        return;
      }

      if (event.type === 'error' || (event.type === 'status' && event.status === 'error')) {
        handledRunsRef.current.add(runId);
        if (!isForeground()) return;
        const provider = agentsRef.current.find((agent) => agent.id === payload.unit.id)?.provider;
        playSound('agent.error', { provider });
      }
    };

    const cleanup = window.electronAPI.onAgentConnectEvent(handleEvent);
    return () => {
      cleanup();
    };
  }, [playSound]);
};
