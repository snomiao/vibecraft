import { useEffect, useRef, useCallback } from 'react';
import type { AgentConnectEventPayload } from '../../../shared/types';
import { formatTokens } from '../../utils/formatTokens';
import { getUsageTotal } from '../../utils/tokenUsage';

const MAX_FLOATERS = 4;

interface TokenFloaterProps {
  agentId: string;
  reduceEffects: boolean;
}

export default function TokenFloater({ agentId, reduceEffects }: TokenFloaterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const floaterCountRef = useRef(0);

  useEffect(() => {
    if (!reduceEffects) return;
    floaterCountRef.current = 0;
  }, [reduceEffects]);

  const spawnFloater = useCallback((amount: number) => {
    const container = containerRef.current;
    if (!container) return;

    if (floaterCountRef.current >= MAX_FLOATERS) return;

    const el = document.createElement('div');
    el.className = 'token-floater';
    el.textContent = `+${formatTokens(amount)}`;
    floaterCountRef.current++;

    el.addEventListener(
      'animationend',
      () => {
        el.remove();
        floaterCountRef.current--;
      },
      { once: true }
    );

    container.appendChild(el);
  }, []);

  useEffect(() => {
    if (reduceEffects) return;

    const cleanup = window.electronAPI.onAgentConnectEvent((payload: AgentConnectEventPayload) => {
      if (payload.unit.type !== 'agent' || payload.unit.id !== agentId) return;

      const event = payload.event;
      let usage;
      if (event.type === 'usage') {
        usage = event.usage;
      } else if (event.type === 'message' && event.usage) {
        usage = event.usage;
      } else if (event.type === 'final' && event.usage) {
        usage = event.usage;
      } else {
        return;
      }

      const total = getUsageTotal(usage);
      if (total === null || total <= 0) return;

      spawnFloater(total);
    });

    return cleanup;
  }, [agentId, reduceEffects, spawnFloater]);

  if (reduceEffects) return null;

  return <div ref={containerRef} className="token-floater-container" />;
}
