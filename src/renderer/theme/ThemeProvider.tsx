import { useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { THEME_LIST, THEMES, ThemeName, resolveThemeVars } from './tokens';
import { ThemeContext, DEFAULT_THEME_ID } from './themeContext';

export interface ThemeProviderProps {
  initialTheme?: ThemeName;
  children: ReactNode;
}

export function ThemeProvider({ initialTheme = DEFAULT_THEME_ID, children }: ThemeProviderProps) {
  const [themeId, setThemeId] = useState<ThemeName>(initialTheme);

  useLayoutEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    const root = document.documentElement;
    root.dataset.theme = themeId;

    const themeEntry = THEMES[themeId];
    if (!themeEntry) {
      throw new Error(`Unknown theme: ${themeId}`);
    }

    const resolved = resolveThemeVars(themeEntry.tokens);
    const applyVars = (vars: Record<string, string>) => {
      Object.entries(vars).forEach(([cssVar, value]) => {
        root.style.setProperty(cssVar, value);
      });
    };

    applyVars(resolved.global);
    applyVars(resolved.home);
    applyVars(resolved.world);
    applyVars(resolved.canvas);
  }, [themeId]);

  const activeTheme = THEMES[themeId]?.tokens;

  const value = useMemo(
    () => ({
      themeId,
      setThemeId,
      availableThemes: THEME_LIST,
      activeTheme,
    }),
    [themeId, activeTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
