import type { AgentProvider } from '../../shared/types';
import type { AgentNameSequence, ThemeTokens } from '../theme/tokens';
import { DEFAULT_AGENT_NAME_SEQUENCES } from '../theme/agentNames';

const LATIN_ONES: Record<number, string> = {
  2: 'Secundus',
  3: 'Tertius',
  4: 'Quartus',
  5: 'Quintus',
  6: 'Sextilius',
  7: 'Septimus',
  8: 'Octavus',
  9: 'Nonus',
};

const LATIN_TEENS: Record<number, string> = {
  10: 'Decimus',
  11: 'Undecimus',
  12: 'Duodecimus',
  13: 'Tredecimus',
  14: 'Quattuordecimus',
  15: 'Quindecimus',
  16: 'Sedecimus',
  17: 'Septendecimus',
  18: 'Duodevicesimus',
  19: 'Undevicesimus',
};

const LATIN_TENS: Record<number, string> = {
  2: 'Vicesimus',
  3: 'Tricesimus',
  4: 'Quadragesimus',
  5: 'Quinquagesimus',
  6: 'Sexagesimus',
  7: 'Septuagesimus',
  8: 'Octogesimus',
  9: 'Nonagesimus',
};

const LATIN_HUNDREDS: Record<number, string> = {
  1: 'Centesimus',
  2: 'Ducentesimus',
  3: 'Trecentesimus',
  4: 'Quadringentesimus',
  5: 'Quingentesimus',
  6: 'Sescentesimus',
  7: 'Septingentesimus',
  8: 'Octingentesimus',
  9: 'Nongentesimus',
};

const toLatinOrdinal = (value: number): string => {
  if (!Number.isFinite(value) || value <= 1) return '';
  const normalized = Math.floor(value);
  if (normalized < 10) return LATIN_ONES[normalized] ?? '';
  if (normalized < 20) return LATIN_TEENS[normalized] ?? '';
  if (normalized < 100) {
    const tens = Math.floor(normalized / 10);
    const ones = normalized % 10;
    const tensWord = LATIN_TENS[tens] ?? '';
    if (ones === 0) return tensWord;
    const onesWord = LATIN_ONES[ones] ?? '';
    return onesWord ? `${tensWord} ${onesWord}` : tensWord;
  }
  if (normalized < 1000) {
    const hundreds = Math.floor(normalized / 100);
    const remainder = normalized % 100;
    const hundredsWord = LATIN_HUNDREDS[hundreds] ?? '';
    if (!remainder) return hundredsWord;
    const remainderWord = toLatinOrdinal(remainder);
    return remainderWord ? `${hundredsWord} ${remainderWord}` : hundredsWord;
  }
  return `Cycle ${normalized}`;
};

const resolveNameSequence = (provider: AgentProvider, theme?: ThemeTokens): AgentNameSequence => {
  const themeEntry = theme?.modules?.agents?.names?.[provider];
  const fallback = DEFAULT_AGENT_NAME_SEQUENCES[provider];
  const sequence = themeEntry?.sequence?.length ? themeEntry.sequence : fallback.sequence;
  const first = themeEntry?.first ?? fallback.first;
  return { first, sequence };
};

export const getNextAgentName = (
  provider: AgentProvider,
  spawnCount: number,
  theme?: ThemeTokens
): string => {
  const { first, sequence } = resolveNameSequence(provider, theme);
  const safeCount = Number.isFinite(spawnCount) && spawnCount > 0 ? Math.floor(spawnCount) : 0;
  const baseFirst = first ?? sequence[0] ?? 'Agent';
  if (!sequence.length) {
    const cycle = Math.floor(safeCount / 1);
    const suffix = toLatinOrdinal(cycle + 1);
    return cycle > 0 && suffix ? `${baseFirst} ${suffix}` : baseFirst;
  }
  const total = sequence.length + 1;
  const baseIndex = safeCount % total;
  const baseName = baseIndex === 0 ? baseFirst : (sequence[baseIndex - 1] ?? baseFirst);
  const cycle = Math.floor(safeCount / total);
  if (cycle === 0) return baseName;
  const suffix = toLatinOrdinal(cycle + 1);
  return suffix ? `${baseName} ${suffix}` : baseName;
};
