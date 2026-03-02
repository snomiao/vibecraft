import type { TokenUsage } from '../../shared/types';

export const getUsageTotal = (usage?: TokenUsage | null): number | null => {
  if (!usage) return null;
  const total = usage.total_tokens;
  if (typeof total === 'number' && Number.isFinite(total)) return total;
  const input = typeof usage.input_tokens === 'number' ? usage.input_tokens : 0;
  const output = typeof usage.output_tokens === 'number' ? usage.output_tokens : 0;
  if (input === 0 && output === 0) return null;
  return input + output;
};
