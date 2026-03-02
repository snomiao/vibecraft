import defaultTheme from './variants/default';
import type { ThemeCopy } from './screens';
import { DEFAULT_SOUND_PACK_ID } from '../../shared/types';
import type { AgentProvider, SoundPackId } from '../../shared/types';

type HexColor = `#${string}`;

export interface AgentNameSequence {
  first?: string;
  sequence: ReadonlyArray<string>;
}

export interface ThemeModules {
  agents?: {
    palette: ReadonlyArray<HexColor>;
    names?: Partial<Record<AgentProvider, AgentNameSequence>>;
  };
  audio?: {
    defaultSoundPackId: SoundPackId;
  };
}

export interface ThemePalette {
  background: {
    base: HexColor;
    mid: HexColor;
    deep: HexColor;
  };
  surface: {
    base: HexColor;
    raised: HexColor;
    panel: HexColor;
    border: HexColor;
  };
  text: {
    primary: HexColor;
    secondary: HexColor;
    muted: HexColor;
  };
  accent: {
    primary: HexColor;
    secondary: HexColor;
    highlight: HexColor;
  };
  status: {
    success: HexColor;
    warning: HexColor;
    danger: HexColor;
  };
  selection: HexColor;
}

export interface ThemeInteractives {
  buttonText: HexColor;
  buttonIcon: HexColor;
}

export interface ThemeTypography {
  base: string;
  display: string;
  serif: string;
  mono: string;
}

export interface ThemeGradients {
  home: { start: HexColor; mid: HexColor; end: HexColor };
  world: { start: HexColor; end: HexColor };
}

export interface ThemeRadii {
  sm: string;
  md: string;
  lg: string;
}

export interface ThemeShadows {
  soft: string;
  medium: string;
  strong: string;
  glow?: string;
}

export interface ThemeCanvas {
  bgCenter: HexColor;
  bgEdge: HexColor;
  gridPrimary: HexColor;
  gridSecondary: HexColor;
}

export interface ThemeGlows {
  hero: string;
  agent: string;
}

export interface ThemeLabels {
  folder: HexColor;
}

export interface ThemeFoundation {
  palette: ThemePalette;
  interactives: ThemeInteractives;
  typography: ThemeTypography;
  gradients: ThemeGradients;
  radii: ThemeRadii;
  shadows: ThemeShadows;
  canvas: ThemeCanvas;
  glows: ThemeGlows;
  labels: ThemeLabels;
}

export interface ThemeToggles {
  panelTexture?: 'none' | 'subtle';
}

export const GLOBAL_VAR_NAMES = [
  '--bg-primary',
  '--bg-secondary',
  '--bg-tertiary',
  '--bg-elevated',
  '--border-color',
  '--border-highlight',
  '--text-primary',
  '--text-secondary',
  '--text-muted',
  '--accent-primary',
  '--accent-secondary',
  '--accent-gold',
  '--success',
  '--warning',
  '--error',
  '--hero-glow',
  '--agent-glow',
  '--selection-ring',
  '--folder-label-color',
  '--panel-radius',
  '--panel-bg',
  '--panel-border',
  '--shadow-soft',
  '--canvas-bg-center',
  '--canvas-bg-edge',
  '--canvas-grid-primary',
  '--canvas-grid-secondary',
  '--font-base',
  '--font-display',
  '--font-serif',
  '--font-mono',
] as const;

export const HOME_VAR_NAMES = [
  '--home-bg-start',
  '--home-bg-mid',
  '--home-bg-end',
  '--home-background-image',
  '--home-panel-background',
  '--home-panel-clip-path',
  '--home-panel-texture',
  '--home-title-shadow',
  '--home-overlay-blue',
  '--home-overlay-purple',
  '--home-overlay-green',
  '--home-title-gold-light',
  '--home-title-gold-mid',
  '--home-title-gold-dark',
  '--home-subtitle-color',
  '--home-subtitle-accent-gold',
  '--home-subtitle-accent-purple',
  '--home-subtitle-accent-blue',
  '--home-panel-bg-top',
  '--home-panel-bg-mid',
  '--home-panel-bg-bottom',
  '--home-button-gradient-start',
  '--home-button-gradient-end',
  '--home-button-hover-start',
  '--home-button-hover-end',
  '--home-button-border',
  '--home-button-hover-border',
  '--home-button-text',
  '--home-button-subtitle',
  '--home-button-icon',
  '--home-button-hover-text',
  '--home-button-hover-primary-border',
  '--home-button-hover-transform',
  '--home-panel-divider',
] as const;

export const WORLD_VAR_NAMES = [
  '--world-bg-start',
  '--world-bg-end',
  '--world-background-overlay',
  '--world-header-background',
  '--world-header-border',
  '--world-header-title-shadow',
  '--world-back-button-text-shadow',
  '--world-back-button-hover-shadow',
  '--world-section-heading-shadow',
  '--world-ability-gradient-start',
  '--world-ability-gradient-end',
  '--world-ability-border',
  '--world-ability-hover-start',
  '--world-ability-hover-end',
  '--world-ability-hover-border',
  '--world-ability-hover-shadow',
  '--world-ability-icon-shadow',
  '--world-ability-text-shadow',
  '--world-text-subtle',
  '--world-text-hint',
  '--world-card-gradient-start',
  '--world-card-gradient-end',
  '--world-card-border',
  '--world-card-hover-start',
  '--world-card-hover-end',
  '--world-card-hover-border',
  '--world-card-hover-shadow',
  '--world-card-icon-shadow',
  '--world-card-title-shadow',
  '--world-text-muted',
  '--world-text-faint',
  '--world-remove-button-background',
  '--world-remove-button-hover-background',
  '--world-remove-button-text-shadow',
  '--world-remove-button-hover-shadow',
  '--world-empty-state-background',
  '--world-empty-state-border',
  '--world-folder-ability-gradient-start',
  '--world-folder-ability-gradient-end',
  '--world-folder-ability-border',
  '--world-folder-ability-hover-start',
  '--world-folder-ability-hover-end',
  '--world-folder-ability-hover-border',
  '--world-folder-ability-hover-shadow',
  '--world-path-color',
] as const;

export const CANVAS_VAR_NAMES = [
  '--canvas-bg-center',
  '--canvas-bg-edge',
  '--canvas-grid-primary',
  '--canvas-grid-secondary',
] as const;

export type GlobalVarName = (typeof GLOBAL_VAR_NAMES)[number];
export type HomeVarName = (typeof HOME_VAR_NAMES)[number];
export type WorldVarName = (typeof WORLD_VAR_NAMES)[number];
export type CanvasVarName = (typeof CANVAS_VAR_NAMES)[number];

export type GlobalVarMap = Record<GlobalVarName, string>;
export type HomeVarMap = Record<HomeVarName, string>;
export type WorldVarMap = Record<WorldVarName, string>;
export type CanvasVarMap = Record<CanvasVarName, string>;

export interface ThemeOverrides {
  global?: Partial<GlobalVarMap>;
  home?: Partial<HomeVarMap>;
  world?: Partial<WorldVarMap>;
  canvas?: Partial<CanvasVarMap>;
}

export interface ThemeTokens {
  foundation: ThemeFoundation;
  copy: ThemeCopy;
  toggles?: ThemeToggles;
  overrides?: ThemeOverrides;
  modules?: ThemeModules;
}

export interface ResolvedThemeVars {
  global: GlobalVarMap;
  home: HomeVarMap;
  world: WorldVarMap;
  canvas: CanvasVarMap;
}

function mergeThemeOverrides(base?: ThemeOverrides, overrides?: ThemeOverrides): ThemeOverrides | undefined {
  if (!base && !overrides) return undefined;
  return {
    global: { ...(base?.global ?? {}), ...(overrides?.global ?? {}) },
    home: { ...(base?.home ?? {}), ...(overrides?.home ?? {}) },
    world: { ...(base?.world ?? {}), ...(overrides?.world ?? {}) },
    canvas: { ...(base?.canvas ?? {}), ...(overrides?.canvas ?? {}) },
  };
}

function mergeThemeModules(base?: ThemeModules, overrides?: ThemeModules): ThemeModules | undefined {
  if (!base && !overrides) return undefined;
  const baseAgents = base?.agents;
  const overrideAgents = overrides?.agents;
  const baseAudio = base?.audio;
  const overrideAudio = overrides?.audio;
  return {
    agents: {
      palette: overrideAgents?.palette ?? baseAgents?.palette ?? [],
      names: { ...(baseAgents?.names ?? {}), ...(overrideAgents?.names ?? {}) },
    },
    audio: {
      defaultSoundPackId:
        overrideAudio?.defaultSoundPackId ?? baseAudio?.defaultSoundPackId ?? DEFAULT_SOUND_PACK_ID,
    },
  };
}

function mergeThemeTokens(base: ThemeTokens, overrides: ThemeTokens): ThemeTokens {
  return {
    foundation: {
      palette: {
        background: {
          ...base.foundation.palette.background,
          ...overrides.foundation.palette.background,
        },
        surface: {
          ...base.foundation.palette.surface,
          ...overrides.foundation.palette.surface,
        },
        text: {
          ...base.foundation.palette.text,
          ...overrides.foundation.palette.text,
        },
        accent: {
          ...base.foundation.palette.accent,
          ...overrides.foundation.palette.accent,
        },
        status: {
          ...base.foundation.palette.status,
          ...overrides.foundation.palette.status,
        },
        selection: overrides.foundation.palette.selection ?? base.foundation.palette.selection,
      },
      interactives: {
        ...base.foundation.interactives,
        ...overrides.foundation.interactives,
      },
      typography: {
        ...base.foundation.typography,
        ...overrides.foundation.typography,
      },
      gradients: {
        ...base.foundation.gradients,
        ...overrides.foundation.gradients,
      },
      radii: {
        ...base.foundation.radii,
        ...overrides.foundation.radii,
      },
      shadows: {
        ...base.foundation.shadows,
        ...overrides.foundation.shadows,
      },
      canvas: {
        ...base.foundation.canvas,
        ...overrides.foundation.canvas,
      },
      glows: {
        ...base.foundation.glows,
        ...overrides.foundation.glows,
      },
      labels: {
        ...base.foundation.labels,
        ...overrides.foundation.labels,
      },
    },
    copy: {
      home: overrides.copy?.home ?? base.copy.home,
    },
    toggles: {
      ...(base.toggles ?? {}),
      ...(overrides.toggles ?? {}),
    },
    overrides: mergeThemeOverrides(base.overrides, overrides.overrides),
    modules: mergeThemeModules(base.modules, overrides.modules),
  };
}

function rgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const bigint = parseInt(normalized, 16);
  if (Number.isNaN(bigint)) {
    return hex;
  }
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildGlobalVars(tokens: ThemeTokens): GlobalVarMap {
  const { palette, radii, shadows, canvas, glows, typography, labels } = tokens.foundation;
  return {
    '--bg-primary': palette.background.base,
    '--bg-secondary': palette.background.mid,
    '--bg-tertiary': palette.background.deep,
    '--bg-elevated': palette.surface.raised,
    '--border-color': palette.surface.border,
    '--border-highlight': palette.accent.highlight,
    '--text-primary': palette.text.primary,
    '--text-secondary': palette.text.secondary,
    '--text-muted': palette.text.muted,
    '--accent-primary': palette.accent.primary,
    '--accent-secondary': palette.accent.secondary,
    '--accent-gold': palette.accent.highlight,
    '--success': palette.status.success,
    '--warning': palette.status.warning,
    '--error': palette.status.danger,
    '--hero-glow': glows.hero,
    '--agent-glow': glows.agent,
    '--selection-ring': palette.selection,
    '--folder-label-color': labels.folder,
    '--panel-radius': radii.md,
    '--panel-bg': palette.surface.panel,
    '--panel-border': `1px solid ${palette.surface.border}`,
    '--shadow-soft': shadows.soft,
    '--canvas-bg-center': canvas.bgCenter,
    '--canvas-bg-edge': canvas.bgEdge,
    '--canvas-grid-primary': canvas.gridPrimary,
    '--canvas-grid-secondary': canvas.gridSecondary,
    '--font-base': typography.base,
    '--font-display': typography.display,
    '--font-serif': typography.serif,
    '--font-mono': typography.mono,
  };
}

function buildHomeVars(tokens: ThemeTokens): HomeVarMap {
  const { foundation, toggles } = tokens;
  const { palette, gradients, interactives } = foundation;
  const overlayAlpha = toggles?.panelTexture === 'subtle' ? 0.08 : 0;
  return {
    '--home-bg-start': gradients.home.start,
    '--home-bg-mid': gradients.home.mid,
    '--home-bg-end': gradients.home.end,
    '--home-background-image': 'none',
    '--home-panel-background': `linear-gradient(180deg, ${palette.surface.panel} 0%, ${palette.surface.base} 50%, ${palette.surface.raised} 100%)`,
    '--home-panel-clip-path': 'none',
    '--home-panel-texture': 'none',
    '--home-title-shadow': '0 2px 4px rgba(0, 0, 0, 0.7)',
    '--home-overlay-blue': overlayAlpha ? rgba(palette.accent.highlight, overlayAlpha) : 'transparent',
    '--home-overlay-purple': overlayAlpha ? rgba(palette.accent.secondary, overlayAlpha) : 'transparent',
    '--home-overlay-green': overlayAlpha ? rgba(palette.accent.primary, overlayAlpha) : 'transparent',
    '--home-title-gold-light': palette.accent.highlight,
    '--home-title-gold-mid': palette.accent.primary,
    '--home-title-gold-dark': palette.accent.secondary,
    '--home-subtitle-color': palette.text.secondary,
    '--home-subtitle-accent-gold': palette.accent.highlight,
    '--home-subtitle-accent-purple': palette.accent.secondary,
    '--home-subtitle-accent-blue': palette.accent.primary,
    '--home-panel-bg-top': palette.surface.panel,
    '--home-panel-bg-mid': palette.surface.base,
    '--home-panel-bg-bottom': palette.surface.raised,
    '--home-button-gradient-start': palette.surface.panel,
    '--home-button-gradient-end': palette.surface.base,
    '--home-button-hover-start': palette.accent.primary,
    '--home-button-hover-end': palette.accent.secondary,
    '--home-button-border': palette.surface.border,
    '--home-button-hover-border': palette.accent.highlight,
    '--home-button-hover-text': interactives.buttonText,
    '--home-button-text': interactives.buttonText,
    '--home-button-subtitle': interactives.buttonText,
    '--home-button-icon': interactives.buttonIcon,
    '--home-button-hover-primary-border': palette.surface.border,
    '--home-button-hover-transform': 'translateY(-1px)',
    '--home-panel-divider': palette.surface.border,
  };
}

function buildWorldVars(tokens: ThemeTokens): WorldVarMap {
  const { foundation } = tokens;
  const { palette, gradients, shadows } = foundation;
  return {
    '--world-bg-start': gradients.world.start,
    '--world-bg-end': gradients.world.end,
    '--world-background-overlay': 'none',
    '--world-header-background': rgba(palette.background.deep, 0.7),
    '--world-header-border': palette.surface.border,
    '--world-header-title-shadow': 'none',
    '--world-back-button-text-shadow': 'none',
    '--world-back-button-hover-shadow': shadows.medium,
    '--world-section-heading-shadow': 'none',
    '--world-ability-gradient-start': palette.accent.primary,
    '--world-ability-gradient-end': palette.accent.secondary,
    '--world-ability-border': palette.accent.primary,
    '--world-ability-hover-start': palette.accent.secondary,
    '--world-ability-hover-end': palette.accent.highlight,
    '--world-ability-hover-border': palette.accent.highlight,
    '--world-ability-hover-shadow': shadows.medium,
    '--world-ability-icon-shadow': 'none',
    '--world-ability-text-shadow': 'none',
    '--world-text-subtle': palette.text.secondary,
    '--world-text-hint': palette.text.muted,
    '--world-card-gradient-start': palette.surface.panel,
    '--world-card-gradient-end': palette.surface.base,
    '--world-card-border': palette.surface.border,
    '--world-card-hover-start': palette.accent.primary,
    '--world-card-hover-end': palette.accent.secondary,
    '--world-card-hover-border': palette.accent.highlight,
    '--world-card-hover-shadow': shadows.medium,
    '--world-card-icon-shadow': 'none',
    '--world-card-title-shadow': 'none',
    '--world-text-muted': palette.text.muted,
    '--world-text-faint': palette.text.muted,
    '--world-remove-button-background': palette.status.danger,
    '--world-remove-button-hover-background': palette.status.danger,
    '--world-remove-button-text-shadow': 'none',
    '--world-remove-button-hover-shadow': shadows.medium,
    '--world-empty-state-background': rgba(palette.background.deep, 0.5),
    '--world-empty-state-border': palette.surface.border,
    '--world-folder-ability-gradient-start': palette.accent.primary,
    '--world-folder-ability-gradient-end': palette.accent.secondary,
    '--world-folder-ability-border': palette.accent.primary,
    '--world-folder-ability-hover-start': palette.accent.secondary,
    '--world-folder-ability-hover-end': palette.accent.highlight,
    '--world-folder-ability-hover-border': palette.accent.highlight,
    '--world-folder-ability-hover-shadow': shadows.medium,
    '--world-path-color': palette.text.muted,
  };
}

function buildCanvasVars(tokens: ThemeTokens): CanvasVarMap {
  const { canvas } = tokens.foundation;
  return {
    '--canvas-bg-center': canvas.bgCenter,
    '--canvas-bg-edge': canvas.bgEdge,
    '--canvas-grid-primary': canvas.gridPrimary,
    '--canvas-grid-secondary': canvas.gridSecondary,
  };
}

function mergeVarMap<T extends Record<string, string>>(base: T, overrides?: Partial<T>): T {
  return {
    ...base,
    ...(overrides ?? {}),
  };
}

export function resolveThemeVars(tokens: ThemeTokens): ResolvedThemeVars {
  const mergedTokens = mergeThemeTokens(defaultTheme, tokens);
  return {
    global: mergeVarMap(buildGlobalVars(mergedTokens), mergedTokens.overrides?.global),
    home: mergeVarMap(buildHomeVars(mergedTokens), mergedTokens.overrides?.home),
    world: mergeVarMap(buildWorldVars(mergedTokens), mergedTokens.overrides?.world),
    canvas: mergeVarMap(buildCanvasVars(mergedTokens), mergedTokens.overrides?.canvas),
  };
}

const themeRegistry = {
  default: {
    label: 'Default',
    tokens: defaultTheme,
  },
} as const;

export type ThemeName = keyof typeof themeRegistry;

export const THEMES: Record<ThemeName, { label: string; tokens: ThemeTokens }> = themeRegistry;

export const THEME_LIST = Object.entries(themeRegistry).map(([id, value]) => ({
  id: id as ThemeName,
  label: value.label,
}));
