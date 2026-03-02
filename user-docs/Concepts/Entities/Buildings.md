# Buildings

Definition

- World-fixed interactables (e.g., Claude Code, ChatGPT Codex, Folders, Browser panels, Terminal panels).

In-Game Behavior

- Can be selected. Selection enables HUD context, attach orders, and building-specific abilities.
- Right-clicking with units selected orders attach-on-arrival; attached units idle at the building until reassigned.
- Buildings may be renamed inline when permitted by the concrete subtype.
- Destroying a building removes it from the map and triggers the subtype’s teardown behavior (see building-specific docs).
- Abilities: see below and [[Mechanics/Abilities]].

Abilities (Buildings)

- Buildings surface their abilities in the Bottom HUD when selected.
- Ability behavior follows the shared rules in [[Mechanics/Abilities]].

Ability Loadout by Building Type

- Provider buildings: New Agent.
- Folder buildings (see [[Concepts/Entities/Buildings/Folders]]): Open, Rename, Create Terminal, Remove from UI.
- Browser buildings: Edit URL, Destroy, Resize.
- Workspace-terminal buildings: Resize, Destroy.

Behaviour Details (summary)

- Create Agent: spawns a new agent unit without supply cap checks.
- Create Terminal (hotkey `T` while a folder is selected): enters placement mode for a folder‑scoped workspace terminal. Drag to size; release to create. Escape cancels.
- Rename: available from the HUD button or by clicking a building label; opens inline rename.
- Edit URL: focuses the browser URL input and uses Enter to navigate.
- Resize (hotkey `R` while a browser/terminal is selected): toggles resize mode; drag corners to resize with grid snapping. Escape exits.
- Destroy building: removes the building immediately and tears down any backing resources.

Lifecycle

- Create: instantiated via provider bootstrapping, player abilities, or scripted events.
- Select: updates selection ring and HUD.
- Rename: inline rename support gated by subtype capabilities.
- Destroy: removes the entity from building tables, releases attachments, and dispatches the subtype-specific teardown.

Interactions

- Units can attach on arrival (non-hero units only).
- Movable buildings can be repositioned by clicking and dragging them.
  - Placement rules (e.g., snapping, overlap constraints) are enforced by the building subtype.
  - Attachments, ability ranges, and HUD context update based on the new world position.

Visuals

- Selection ring (stroke: 0x32CD32, width 3, radius ~52, zIndex 100).
- Building overlays (panels, HUD widgets) are handled by the owning subtype; visual specifics live in the subtype docs.

Invariants

- Building positions persist through the standard save/load pipeline; subtype docs note any overrides.
