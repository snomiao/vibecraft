import type { AgentProvider, ContextUsage, TokenUsage } from '../../../shared/types';

export const DEFAULT_CODEX_CONTEXT_WINDOW = 258_000;
export const DEFAULT_CLAUDE_CONTEXT_WINDOW = 200_000;
export const DEFAULT_CLAUDE_MAX_OUTPUT = 32_000;
export const SMALL_CLAUDE_MAX_OUTPUT = 8_192;

export const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
};

export const getUsageTotal = (usage?: TokenUsage): number | null => {
  if (!usage) return null;
  const total = asNumber(usage.total_tokens);
  if (total !== undefined) return total;
  const input = asNumber(usage.input_tokens) ?? 0;
  const output = asNumber(usage.output_tokens) ?? 0;
  if (input === 0 && output === 0) return null;
  return input + output;
};

const clampPercent = (value: number): number => Math.min(100, Math.max(0, value));

const getContextUsageTokens = (
  usage: TokenUsage,
  options: { includeCached: boolean; includeReasoning: boolean }
): number | undefined => {
  const total = asNumber(usage.total_tokens);
  const input = asNumber(usage.input_tokens) ?? 0;
  const output = asNumber(usage.output_tokens) ?? 0;
  const cached = options.includeCached ? (asNumber(usage.cached_input_tokens) ?? 0) : 0;
  const reasoning = options.includeReasoning ? (asNumber(usage.reasoning_tokens) ?? 0) : 0;
  const hasUsage = total !== undefined || input !== 0 || output !== 0 || cached !== 0 || reasoning !== 0;
  if (!hasUsage) return undefined;
  if (total !== undefined) {
    return total;
  }
  return input + output + cached + reasoning;
};

export const getBillableTotal = (usage: TokenUsage | undefined, provider?: AgentProvider): number | null => {
  const base = getUsageTotal(usage);
  if (base === null) return null;
  if (provider !== 'codex') return base;
  const cached = asNumber(usage?.cached_input_tokens) ?? 0;
  if (cached <= 0) return base;
  return Math.max(0, base - cached);
};

export const computeCodexContextLeft = (usage?: TokenUsage, contextWindow?: number): number | undefined => {
  if (!usage) return undefined;
  const maxCtx = contextWindow ?? DEFAULT_CODEX_CONTEXT_WINDOW;
  if (!maxCtx) return undefined;
  const tokensInWindow = getContextUsageTokens(usage, { includeCached: false, includeReasoning: true });
  if (tokensInWindow === undefined) return undefined;
  const remaining = Math.max(0, maxCtx - tokensInWindow);
  return clampPercent(Math.round((remaining / maxCtx) * 100));
};

const resolveClaudeReservedOutput = (model: string | undefined): number => {
  const envValue = process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS;
  if (envValue) {
    const parsed = Number.parseInt(envValue, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.min(DEFAULT_CLAUDE_MAX_OUTPUT, parsed));
    }
  }
  const normalized = model?.toLowerCase() ?? '';
  const isHaiku = normalized.includes('haiku');
  const isFourFive = normalized.includes('4-5') || normalized.includes('4_5') || normalized.includes('4.5');
  if (isHaiku && !isFourFive) {
    return SMALL_CLAUDE_MAX_OUTPUT;
  }
  return DEFAULT_CLAUDE_MAX_OUTPUT;
};

export const computeClaudeContextLeft = (
  usage?: TokenUsage,
  model?: string,
  contextWindow?: number
): number | undefined => {
  if (!usage) return undefined;
  const maxCtx = contextWindow ?? DEFAULT_CLAUDE_CONTEXT_WINDOW;
  if (!maxCtx) return undefined;
  const reservedOutput = resolveClaudeReservedOutput(model);
  const effective = Math.max(1, maxCtx - reservedOutput);
  const tokensInWindow = getContextUsageTokens(usage, { includeCached: true, includeReasoning: true });
  if (tokensInWindow === undefined) return undefined;
  const remaining = Math.max(0, effective - tokensInWindow);
  return clampPercent(Math.round((remaining / effective) * 100));
};

export const computeContextLeft = (
  totalTokens: number | null,
  contextWindow?: number
): number | undefined => {
  if (!contextWindow || totalTokens === null || totalTokens === undefined) return undefined;
  const percentUsed = Math.round((totalTokens / contextWindow) * 100);
  return clampPercent(100 - percentUsed);
};

export const computeContextLeftFromUsage = (contextUsage?: ContextUsage): number | undefined => {
  if (!contextUsage) return undefined;
  const contextWindow = asNumber(contextUsage.context_window);
  if (!contextWindow) return undefined;
  const remaining = asNumber(contextUsage.context_remaining_tokens);
  if (remaining !== undefined) {
    return clampPercent(Math.round((remaining / contextWindow) * 100));
  }
  const used = asNumber(contextUsage.context_tokens);
  if (used !== undefined) {
    const cached = asNumber(contextUsage.context_cached_tokens) ?? 0;
    const combined = cached > 0 && used + cached <= contextWindow ? used + cached : used;
    return clampPercent(100 - Math.round((combined / contextWindow) * 100));
  }
  return undefined;
};
