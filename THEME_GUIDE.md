# Theme System Guide

This document explains how to author, extend, and consume VibeCraft themes. Read this before adding a new theme or touching renderer styles.

## Mental Model

Themes are defined in three layers:

1. **Foundation primitives** – the semantic design tokens (colors, typography, radii, shadows, motion) that every screen relies on to remain legible.
2. **Optional per-scene overrides** – knobs for individual layouts (home, world selection, canvas). These override the derived defaults only if needed.
3. **Modules** – React/CSS hooks for bespoke behavior (particles, animated flourishes). Components render these hooks only when a theme exports them.

The TypeScript schema enforces the foundation layer; overrides and modules are opt-in.

## File Layout

- `src/renderer/theme/tokens.ts`: declares the primitive interfaces, helper builders, and theme registry loader.
- `src/renderer/theme/variants/`: each file exports a `ThemeTokens` object (e.g., `default.ts`). Add new themes here.
- `src/renderer/theme/ThemeProvider.tsx`: resolves primitives ➝ CSS variables and exposes the active theme via context.
- `src/renderer/styles/**`: consumes the CSS variables. Never hardcode colors or spacing.

## Authoring Workflow

1. **Define foundation primitives**

   ```ts
   const myTheme: ThemeTokens = {
     foundation: {
       palette: {
         background: { base: '#10131a', mid: '#0b0e14', deep: '#07090e' },
         surface: { base: '#141924', raised: '#1b2130', panel: '#20283a', border: '#3c4a66' },
         text: { primary: '#e8f0ff', secondary: '#9fb3d1', muted: '#647187' },
         accent: { primary: '#00c2ff', secondary: '#0066ff', highlight: '#64ffda' },
         status: { success: '#3dd598', warning: '#ffb548', danger: '#ff5c8d' },
         selection: '#64ffda',
       },
       interactives: { buttonText: '#e8f0ff', buttonIcon: '#64ffda' },
       typography: {
         base: "'Space Grotesk', 'Inter', -apple-system, sans-serif",
         display: "'Cinzel', serif",
         mono: "'JetBrains Mono', 'Fira Code', monospace",
       },
       gradients: {
         home: { start: '#06080c', mid: '#10182a', end: '#14203b' },
         world: { start: '#0c1018', end: '#101826' },
       },
       radii: { sm: '4px', md: '6px', lg: '10px' },
       shadows: {
         soft: '0 2px 6px rgba(0,0,0,0.3)',
         medium: '0 8px 20px rgba(0,0,0,0.45)',
         strong: '0 16px 40px rgba(0,0,0,0.55)',
       },
       canvas: { bgCenter: '#10171f', bgEdge: '#050608', gridPrimary: '#142431', gridSecondary: '#1b3345' },
       glows: { hero: 'rgba(100,255,218,0.4)', agent: 'rgba(0,194,255,0.3)' },
     },
   };
   ```

   TypeScript will complain if you miss any required primitive.
   ThemeProvider writes these typography tokens to `--font-base`, `--font-display`, and `--font-mono`, so CSS should always reference those variables rather than literal font stacks.

2. **Provide copy/text content**

   ```ts
   copy: {
     home: {
       subtitleOptions: [
         { segments: [{ text: 'FEEL THE ' }, { text: 'ACCELERATION', className: 'accent-gold-italic' }] },
         { segments: [{ text: 'SERIOUSLY ', className: 'accent-gold-italic' }, { text: 'FUN' }] },
       ];
     }
   }
   ```

   These strings render directly in the UI, so each theme can localize or change the tone.

3. **Toggle effects as needed**

   ```ts
   toggles: {
     panelTexture: 'none';
   }
   ```

   Omit toggles you don’t care about; components default to safe values.

4. **Add overrides only when necessary**

   ```ts
   overrides: {
     home: {
       '--home-button-gradient-start': '#1b2638',
       '--home-button-gradient-end': '#141c29'
     }
   }
   ```

   Overrides are literal CSS variable values. Use them sparingly—prefer letting the helper builders derive visuals from the primitives.

5. **Register the theme**

   ```ts
   const themeRegistry = {
     default: {...},
     cyberpunk: { label: 'Cyberpunk', tokens: myTheme }
   } as const;
   ```

6. **(Optional) Export modules**
   ```ts
   modules: {
     menuButtonDecoration: (props) => <ParticleAura {...props} />
   }
   ```
   Consumers can render `config.modules?.menuButtonDecoration?.(buttonProps)` inside their layout.

## Scene Override Reference

Most layouts can be restyled by overriding a small set of CSS variables. The default theme defines every value, so use it as the canonical reference when adding a new scene.

- **Home screen:** title gradient (`--home-title-gold-*`), subtitle accents (`--home-subtitle-*`), title shadow (`--home-title-shadow`), menu buttons (`--home-button-*`), panel styling (`--home-panel-background`, `--home-panel-clip-path`, `--home-panel-texture`, `--home-panel-divider`), and background image (`--home-background-image`).
- **World selection:** header colors (`--world-header-*`), back button shadow (`--world-back-button-*`), world cards (`--world-card-*`), ability buttons (`--world-ability-*`), select-folder button (`--world-folder-ability-*`), delete buttons (`--world-remove-button-*`), empty state (`--world-empty-state-*`), and path text color (`--world-path-color`).

When you introduce a new override token, document it here and add a default value in `themes/default/…` so every theme remains compile-safe.

## Developing New UI

Follow this checklist whenever you add or modify renderer UI:

1. **Consume CSS variables only** – e.g., `color: var(--text-primary);`.
2. **Use theme fonts** – apply `var(--font-base)`, `var(--font-display)`, or `var(--font-mono)` rather than literal `font-family` strings.
3. **Provide fallbacks for optional vars** – `var(--home-button-hover-start, var(--home-button-gradient-start))`.
4. **Decide foundation vs. override** – if the UI breaks without a value, add a foundation primitive; otherwise use an override or module hook.
5. **Document new tokens** – update this guide (and CODEBASE.md) if you add primitives or toggles.
6. **Expose module slots deliberately** – `const { activeTheme } = useTheme(); activeTheme.modules?.hudOverlay?.({ ...props })`.
7. **Test without overrides** – temporarily comment out overrides in the default theme to ensure the fallback path looks acceptable.

## Module Reference

### `modules.agents`

Optional module data used by agent UI components.

- `modules.agents.palette`: `ReadonlyArray<HexColor>`
  - A palette of agent colors used for deterministic per-agent coloring (e.g. roster tile borders).
  - Themes that want consistent per-agent colors should provide this array; if omitted, components should fall back to existing foundation colors.

### `modules.audio`

Optional module data used by renderer sound resolution.

- `modules.audio.defaultSoundPackId`: `SoundPackId`
  - Declares the theme's default sound pack.
  - Renderer audio resolves with precedence: user override -> theme default -> hard default (`default`).

## Debugging Tips

- Log the resolved variables: `console.table(resolveThemeVars(activeTheme))` to inspect what the provider is injecting.
- Use browser devtools to inspect `:root` and verify the expected `--token` values.
- When a theme looks off, check whether it relies on overrides you removed—if so, convert that styling to a primitive or helper.
