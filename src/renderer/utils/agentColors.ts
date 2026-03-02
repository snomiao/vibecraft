import defaultTheme from '../theme/variants/default';
import type { ThemeTokens } from '../theme/tokens';

type HexColor = `#${string}`;

const FALLBACK_COLOR: HexColor = '#ffffff';

export function getAgentColorForSeed(seed: string, palette: ReadonlyArray<HexColor>): HexColor {
  if (!palette.length) return FALLBACK_COLOR;
  const normalized = seed || '';
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length] ?? FALLBACK_COLOR;
}

export function resolveAgentPalette(theme: ThemeTokens): ReadonlyArray<HexColor> {
  return theme.modules?.agents?.palette ?? defaultTheme.modules?.agents?.palette ?? [];
}
