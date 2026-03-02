# Ability System

Overview

- Abilities are context-specific actions exposed through the Bottom HUD for the currently selected entity.
- Buildings take priority when both a unit and a building are selected; otherwise the unit loadout is shown.

Ability Catalog

- Units and buildings each have a defined loadout: a list of ability IDs available when that entity is selected.
- Loadouts are part of the game spec and should match the entity catalogs.

Ability Definition

- `id`: unique identifier (e.g., `create-agent`).
- `icon`: emoji or glyph rendered in the HUD (e.g., `🐣`).
- `name`: display label (e.g., `New Claude Code`).
- `hotkey` (optional): hint text for the intended shortcut (UI hint only).

Activation Flow

- Selection change triggers a lookup in the ability maps to populate the HUD.
- Invoking an ability dispatches to the corresponding gameplay behavior or mode.
- Long-running abilities (build, resize, rename) set an "active" flag so the HUD button appears pressed until the mode ends.

Entity Catalogs

- [[Concepts/Entities/Units]] — per‑unit loadouts and behaviour details (Abilities section).
- [[Concepts/Entities/Buildings]] — per‑building loadouts and behaviour details (Abilities section).

Extending

- Add new abilities by updating the relevant unit/building loadouts and ensuring the gameplay behavior exists.
- Reuse ability IDs consistently across HUD labels, hotkeys, and gameplay routing.
- Abilities should reset their active state on completion or cancellation (e.g., Escape key).

Notes

- The top HUD "Agents" stat currently displays current/∞; there is no supply cap enforcement.
- Keep entity docs in sync when adding or modifying abilities so the catalogs remain accurate.
