import { useEffect, useState } from 'react';
import type { AgentConnectEventPayload } from '../../shared/types';

/**
 * Tracks whether the hero is actively processing a prompt by listening
 * to agentconnect-event status events for hero-type units.
 */
export function useHeroThinking(): boolean {
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    const handleEvent = (payload: AgentConnectEventPayload) => {
      if (payload.unit.type !== 'hero') return;

      if (payload.event.type === 'status') {
        setThinking(payload.event.status === 'thinking');
      } else if (payload.event.type === 'final') {
        setThinking(false);
      }
    };

    const cleanup = window.electronAPI.onAgentConnectEvent(handleEvent);
    return () => cleanup();
  }, []);

  return thinking;
}
