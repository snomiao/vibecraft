import type { ContextUsage } from '../../shared/types';

export const getContextPercent = (
  agentContextLeft?: number,
  contextUsage?: ContextUsage | null
): number | null => {
  if (typeof agentContextLeft === 'number') return agentContextLeft;
  if (!contextUsage) return null;
  const windowSize = contextUsage.context_window;
  if (typeof windowSize !== 'number' || windowSize <= 0) return null;
  if (typeof contextUsage.context_remaining_tokens === 'number') {
    return Math.round((contextUsage.context_remaining_tokens / windowSize) * 100);
  }
  if (typeof contextUsage.context_tokens === 'number') {
    return Math.round(100 - (contextUsage.context_tokens / windowSize) * 100);
  }
  return null;
};

export const clampContextPercent = (value: number | null): number | null => {
  if (value === null) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
};
