import type { HomeVarMap } from '../../tokens';
import type { HomeCopyConfig, SubtitleOption } from '../../screens';
const homeBackground =
  import.meta.env.VITE_HOME_BG ?? new URL('../../../assets/homescreen.png', import.meta.url).toString();

const subtitleOptions: SubtitleOption[] = [
  {
    segments: [{ text: 'FEEL THE ' }, { text: 'ACCELERATION', className: 'accent-gold-italic' }],
  },
  {
    segments: [{ text: 'SERIOUSLY ', className: 'accent-gold-italic' }, { text: 'FUN' }],
  },
  {
    segments: [
      { text: 'INSANELY ', className: 'italic' },
      { text: 'GREAT', className: 'accent-gold-italic' },
    ],
  },
];

export const defaultHomeCopy: HomeCopyConfig = {
  subtitleOptions,
};

export const defaultHomeOverrides: Partial<HomeVarMap> = {
  '--home-background-image': `url(${homeBackground})`,
  '--home-panel-background': `repeating-linear-gradient(13deg, rgba(170, 180, 190, 0.045) 0 1px, transparent 2px 12px),
    repeating-linear-gradient(-12deg, rgba(120, 130, 140, 0.035) 0 1px, transparent 2px 14px),
    repeating-linear-gradient(28deg, rgba(200, 210, 220, 0.02) 0 1px, transparent 2px 24px),
    linear-gradient(180deg, #3b4146 0%, #2b3136 50%, #1f2428 100%)`,
  '--home-panel-clip-path':
    'polygon(6% 0%, 18% 1%, 36% 0%, 66% 2%, 86% 0%, 96% 2%, 100% 8%, 99% 18%, 100% 34%, 97% 48%, 100% 52%, 99% 68%, 100% 86%, 96% 94%, 88% 100%, 70% 98%, 56% 100%, 42% 99%, 24% 100%, 12% 98%, 4% 94%, 0% 86%, 1% 72%, 0% 54%, 3% 46%, 0% 38%, 1% 20%, 0% 8%)',
  '--home-panel-texture': `linear-gradient(to bottom, rgba(255,255,255,0.05), transparent 30%), linear-gradient(to top, rgba(0,0,0,0.24), transparent 34%), linear-gradient(to right, rgba(255,255,255,0.035), transparent 28%), linear-gradient(to left, rgba(0,0,0,0.2), transparent 30%), radial-gradient(120px 90px at 0% 0%, rgba(0,0,0,0.28), transparent 62%), radial-gradient(120px 90px at 100% 0%, rgba(0,0,0,0.28), transparent 62%), radial-gradient(120px 90px at 0% 100%, rgba(0,0,0,0.28), transparent 62%), radial-gradient(120px 90px at 100% 100%, rgba(0,0,0,0.28), transparent 62%), radial-gradient(70% 60% at 50% 50%, transparent 62%, rgba(0,0,0,0.18) 82%)`,
  '--home-title-shadow': `0 0 2px rgba(184, 134, 11, 0.25),
    0 0 4px rgba(184, 134, 11, 0.15),
    0 2px 4px rgba(0, 0, 0, 0.7)`,
  '--home-overlay-blue': 'rgba(52, 152, 219, 0.1)',
  '--home-overlay-purple': 'rgba(155, 89, 182, 0.1)',
  '--home-overlay-green': 'rgba(46, 204, 113, 0.05)',
  '--home-title-gold-light': '#ffd24a',
  '--home-title-gold-mid': '#ff9800',
  '--home-title-gold-dark': '#bf6d00',
  '--home-subtitle-color': '#e2e4e8',
  '--home-subtitle-accent-gold': '#e0b84b',
  '--home-subtitle-accent-purple': '#b794f6',
  '--home-subtitle-accent-blue': '#7cb9e8',
  '--home-panel-bg-top': '#3b4146',
  '--home-panel-bg-mid': '#2b3136',
  '--home-panel-bg-bottom': '#1f2428',
  '--home-button-gradient-start': 'rgba(139, 69, 19, 0.8)',
  '--home-button-gradient-end': 'rgba(101, 67, 33, 0.8)',
  '--home-button-hover-start': 'rgba(160, 82, 45, 0.9)',
  '--home-button-hover-end': 'rgba(139, 69, 19, 0.9)',
  '--home-button-border': 'rgba(160, 82, 45, 0.6)',
  '--home-button-hover-border': 'rgba(160, 82, 45, 0.8)',
  '--home-button-hover-primary-border': 'rgba(218, 165, 32, 0.35)',
  '--home-button-text': '#e2d6b6',
  '--home-button-hover-text': '#e2c46a',
  '--home-button-subtitle': '#c4b089',
  '--home-button-icon': '#f1d49a',
  '--home-button-hover-transform': 'translateY(-2px)',
  '--home-panel-divider': 'rgba(218, 165, 32, 0.35)',
};
