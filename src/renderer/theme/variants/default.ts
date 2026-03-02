import type { ThemeTokens } from '../tokens';
import { DEFAULT_AGENT_NAME_SEQUENCES } from '../agentNames';
import { defaultHomeCopy, defaultHomeOverrides } from './default/home';
import { defaultWorldOverrides } from './default/world';

const defaultTheme: ThemeTokens = {
  foundation: {
    palette: {
      background: { base: '#1a120d', mid: '#2a1f18', deep: '#3a2a20' },
      surface: { base: '#3a2a20', raised: '#4a3828', panel: '#3b4146', border: '#8B4513' },
      text: { primary: '#f5f1d6', secondary: '#DEB887', muted: '#8b7355' },
      accent: { primary: '#DAA520', secondary: '#B8860B', highlight: '#FFD700' },
      status: { success: '#4caf50', warning: '#ff9800', danger: '#e53935' },
      selection: '#DAA520',
    },
    interactives: {
      buttonText: '#F4A460',
      buttonIcon: '#f1d49a',
    },
    typography: {
      base: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif",
      display: "'Cinzel', serif",
      serif: "Georgia, 'Times New Roman', Times, serif",
      mono: "'Menlo', 'Monaco', Consolas, 'Liberation Mono', 'Courier New', monospace",
    },
    gradients: {
      home: { start: '#0a0e1a', mid: '#1a1f3a', end: '#2c3e50' },
      world: { start: '#1a1a1a', end: '#2d2d2d' },
    },
    radii: { sm: '4px', md: '6px', lg: '8px' },
    shadows: {
      soft: '0 2px 6px rgba(0,0,0,0.35)',
      medium: '0 6px 12px rgba(0,0,0,0.45)',
      strong: '0 12px 32px rgba(0,0,0,0.55)',
      glow: '0 0 16px rgba(218, 165, 32, 0.5)',
    },
    canvas: {
      bgCenter: '#0c3604',
      bgEdge: '#1a2c14',
      gridPrimary: '#2e4a22',
      gridSecondary: '#28401e',
    },
    glows: {
      hero: 'rgba(218, 165, 32, 0.4)',
      agent: 'rgba(218, 165, 32, 0.3)',
    },
    labels: {
      folder: '#87CEEB',
    },
  },
  copy: {
    home: defaultHomeCopy,
  },
  toggles: {
    panelTexture: 'subtle',
  },
  modules: {
    agents: {
      palette: ['#ff6b6b', '#4dabf7', '#ffd93d', '#51cf66', '#845ef7', '#ffa94d', '#1ce6b9', '#ff8787'],
      names: DEFAULT_AGENT_NAME_SEQUENCES,
    },
    audio: {
      defaultSoundPackId: 'default',
    },
  },
  overrides: {
    global: {
      '--panel-border': '2px solid #8B4513',
    },
    home: defaultHomeOverrides,
    world: defaultWorldOverrides,
    canvas: {},
  },
};

export default defaultTheme;
