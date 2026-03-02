# Selection Mechanics

Definition

- Selecting units/buildings via click or drag area in world space.

In-Game Behavior

- Drag selection: draws green rectangle. Units in the box are selected.
- If both units and buildings are inside the box, only units are selected.
- If only buildings are in the box, selects closest to box center (folders preferred on ties).
- Left clicking on units/buildings also selects it. Click empty clears selection.
- Only one building can be selected at a time. Unlimited units can be selected at a time. Buildings and units can never be both selected.
- Selected unit(s)/building displays a green circle outline around it, like selected units in Dota 2 & Warcraft 3.

Multiple Unit Selection

- When multiple agents are selected, the Bottom HUD shows a special multi-selection interface.
- Hero units are filtered out of multi-selection and cannot be bulk-selected.
- Details panel displays "Multiple Agents" with count and list of selected agent names.
- Agent names are color-coded according to their assigned colors with provider type labels (e.g., "Agent Name (Claude Code)").
- Only one ability is available for multi-selection: bulk delete with a red button showing agent count badge.

Chat Mentions

- Press Enter with one or more units selected to open chat with those units auto-mentioned at the start (e.g., "@Ari @Nova ").
- Hero units are never taggable and are excluded from auto-mentions and autocomplete.

Invariants

- Rings: 0x32CD32, width 3, unit radius ~36, building radius ~52.
