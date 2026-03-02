import { createContext, useContext } from 'react';
import { THEME_LIST, THEMES, ThemeName } from './tokens';
import type { ThemeTokens } from './tokens';

export interface ThemeContextValue {
  themeId: ThemeName;
  setThemeId: (theme: ThemeName) => void;
  availableThemes: { id: ThemeName; label: string }[];
  activeTheme: ThemeTokens;
}

export const DEFAULT_THEME_ID = THEME_LIST[0]?.id ?? 'default';

export const ThemeContext = createContext<ThemeContextValue>({
  themeId: DEFAULT_THEME_ID,
  setThemeId: () => {},
  availableThemes: THEME_LIST,
  activeTheme: THEMES[DEFAULT_THEME_ID].tokens,
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
