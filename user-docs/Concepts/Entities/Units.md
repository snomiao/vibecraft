# Units (Common)

Definition

- Movable, controllable entities. This document captures traits common to all units. See sub-docs for specifics:
  - [[Concepts/Entities/Units/Heroes]]
  - [[Concepts/Entities/Units/NonHeroUnits]]

In-Game Behaviour (Common)

- Selection: click or drag area. Shows a green selection ring (radius ~36).
- Movement: right-click to move; small spread applied for multi-select.
- HUD: unit details and status display when selected.
  - Status states: “Working…” while the agent streams output, “Task Complete” shown briefly after output finishes, and “Idle” otherwise.
- Abilities: see below and [[Mechanics/Abilities]].

Abilities (Units)

- Units have context‑specific abilities shown in the Bottom HUD based on unit type.
- Ability behavior follows the shared rules in [[Mechanics/Abilities]].

Ability Loadout by Unit Type

- Hero (see [[Concepts/Entities/Units/Heroes]]): Build Folder, Create Browser, Create Terminal, Rename, Resize (when a panel is selected).
- Worker: Gather, Move, Stop.
- Scout: Scout, Move.
- Builder: Build, Repair, Move.
- Spawned agent units: Destroy Unit, Open Terminal.

Hero Ability Behaviour (summary)

- Build Folder (hotkey `B`): enters placement mode with snapping and validity check. Click to place; Escape cancels.
- Create Browser (hotkey `C`): drag to size the panel rectangle; release to finalize. Red preview indicates an invalid location (overlap). Releasing on invalid resets the start so you can try again. Escape cancels.
- Create Terminal (hotkey `T`): enters placement mode for the selected agent. Drag to size and release to create a terminal building. Escape cancels.
- Rename: starts inline rename for the selected folder building.
- Resize (hotkey `R` while a panel is selected): toggles panel resize mode. Four corner grabbers appear; drag to resize with grid snapping. Escape exits.

Other Notes

- Unit slots show the ability list in the Bottom HUD; building selection takes priority over units when both are selected.
- Destroying an agent unit terminates its underlying session and cleans up attachments.

Notes (Common)

- Provider-specific unit types exist for agents (e.g., Claude Code, ChatGPT Codex).

Lifecycle (Common)

- Spawn (mock for now) → Select → Move → (optional) special interactions per subtype.

Interactions (Common)

- Selection box rules, hotkeys, movement.

Visuals (Common)

- Selection ring: color 0x32CD32, width 3, radius ~36, drawn above sprite.

Invariants (Common)

- Unit positions are considered in world-space and are the source of truth for selection/hit tests.
