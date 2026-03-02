# Visuals

Selection Rings

- Color: 0x32CD32 (green), stroke width 3.
- Units: radius ~36; drawn above unit (zIndex 100).
- Buildings (incl. folders): radius ~52; drawn above sprite.

Movement Target

- Small ring + dot + crosshair at target position; auto-hides.

Building Placement Preview

- Footprint overlay (~80×80) centered on snapped cursor position (used for both folder and browser placement); hidden until you move the cursor or start dragging.
- Green when valid placement; red when invalid (overlap with existing buildings). Releasing on red (invalid) resets the drag start.
- Subtle fill alpha for readability over terrain; drawn above ground and units.

Labels/Health

- Building label above sprite; folder labels are light blue.
- Unit name labels can be colorized per agent (assigned on spawn) and keep their color on hover/select. Selection does not change font size; zoom scaling is applied via label scale for consistency.
- **Unit Health Bar (in-canvas)**: Above non-hero units; rounded with 6 tick marks; threshold coloring (red/yellow/green); gently bobs with the unit.
- **Bottom HUD Health**: Displays "Health X/100" (context health) with a green gradient matching the in-canvas bar.

Minimap

- Expansive view: the minimap automatically scales to the smallest rectangle that contains all buildings and units (with padding). If you pan “off” content, bounds temporarily extend to include the current viewport and shrink back when you return.
- Units (drawn above tiles):
  - Hero matches in‑canvas styling: darker gold outer ring, lighter gold inner circle, small crown.
  - Provider agents use proper SVG icons (Claude, Codex). Codex icon is slightly smaller for balance.
- Buildings:
  - Non‑panel tiles are square (no rounding). Folders are blue; worktrees are darker blue; conflict folders are red. Code/provider tiles are bronze. Worktrees do not show a folder glyph overlay.
  - Panels render at true footprint. Terminals are black boxes; agent terminals have an outline in the agent’s color; folder terminals use a neutral grey outline. Browser panels are neutral grey with a faint top bar and a “www” label. File explorers are blue with a subtle folder glyph.
- Trees: tiny subtle green dots mirror decorative trees in the world.
- Viewport rectangle: softened green border/fill sized to the visible world area (zoom‑aware) within current minimap bounds.

Cursor Hint (Browser Placement)

- A small stone/gold tooltip follows the cursor with the text “Drag to create browser” when create-browser mode is active and before dragging begins.
- Hidden on drag, finalize, Escape, or when the cursor leaves the canvas.

Browser Selection Indicator

- For browser buildings, selection is shown via a bright green outline on the overlay; the in-canvas selection ring is suppressed to avoid overlap with DOM content. Outline is used (not border) so the overlay box does not shift during selection.

Panel Resize Handles

- When a Browser/Terminal is selected and Resize mode is active, four corner grabbers appear as diamond-shaped markers (rotated squares) that sit exactly on the panel's corners.
- Handles are positioned from the actual overlay rectangles (DOM):
  - Browsers: measured via `getBoundingClientRect()` under the scaled root
  - Terminals: measured from their known translate3d position and pixel width/height
- Dragging a handle shows a translucent preview of the new size/position and updates the panel live (grid-snapped). Overlays are pass‑through during the drag for reliable pointer routing.

Browser URL Bar

- Tooltip copy: "Type 'localhost:3000' — scheme auto-fills to http for local hosts."
- Back (←) and Forward (→) buttons sit to the left of the input and disable when history navigation isn't available.
- Level-Up VFX (Folders)
- A golden tapered beam rises from the folder; layered glow with ADD blend and blur.
- A "Level Up!" screen-space label lifts and scales during the animation.
- The VFX is non-interactive and does not block selection; folders remain clickable while the animation plays.

Initial Load Settling

- On first entering a world, camera/viewport sync completes on the first tick after layout. Elements visible at t=0 (hero, code/provider buildings) may appear to “snap” into place as the viewport finalizes. This is cosmetic and stabilizes immediately.

Bottom HUD Layout

- Three sections by default: Unit Info | Abilities | Minimap
- Optional fourth section: Inventory (hidden by default).
- 12px gaps between sections allow click-through to the canvas for RTS-style interaction.

APM/TPM HUD Overlay

- Fixed position: small neon/fps-style box under the top HUD (top-right), independent of camera.
- Two rows:
  - APM — actions/min from user input:
    - Typing counts by completed “words” (committed on boundaries or a short idle); delete/backspace collapse into edit bursts (one action per burst).
    - Enter (submit) counts as an action and also finalizes any pending word/edit.
    - Shortcuts/navigation (Ctrl/Cmd combos, arrows, Escape, function keys) count as actions.
    - Scroll/pinch are counted once per continuous gesture (≈300ms idle window).
  - TPM — tokens/min mirroring the green token delta floaters.
- Both readings scale the last few seconds of activity (≈10s window) up to a per-minute rate so the numbers stay twitchy and responsive.

## Cinematic Mode (Capture)

- Purpose: temporarily boosts shimmers, glows, and depth for video capture without changing gameplay.
- Toggle: Cmd/Ctrl+Shift+K.
- Scope (visual, performance-safe):
  - HUD: crosshatch overlays hidden; subtle, toned presentation.
  - APM/TPM: subtle neon text glow and gentle flicker.
  - Minimap: viewport rectangle pulsing; camera arrow shimmer.
  - Overlays: browser/terminal panels get deeper elevation; resize handles brighten.
  - Cursor hint: light sweep across the tooltip during browser placement.
  - World: hero/agent movement dust becomes more prominent; decorative only.
