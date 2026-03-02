# VibeCraft User Docs

## Purpose and Scope

`vibecraft/user-docs/` is the user-facing guide for how VibeCraft works. It explains the game's mechanics, concepts, and controls in clear, player-friendly language.

## How This Folder Is Organized

- `Concepts/`: core ideas and nouns (entities, items, terms).
- `Mechanics/`: gameplay systems and user workflows.
  - `Mechanics/Camera/`: navigation and camera systems (minimap, edge panning).
  - `Mechanics/World/`: core world interactions (selection, movement, attach/orbit).
  - `Mechanics/Agents/`: agent‑specific systems (spawning, attach‑to‑folders, chat routing, context health, supply).
  - `Mechanics/Buildings/`: building‑specific systems (build folder, import placement, terminals).
  - Shared systems at `Mechanics/` root (e.g., abilities, destroy).
- `Reference/`: controls, visuals, glossary, color schemes, analytics stance.

## Quick Map

- Entities split into [[Concepts/Entities/Units]] and [[Concepts/Entities/Buildings]].
- Heroes: privileged units (cannot attach to buildings).
- Buildings: interactable world structures (e.g., provider buildings, task queue).
- Folders: a building tied to a folder on your computer (see [[Concepts/Entities/Buildings/Folders]]).
- Items: inventory‑like UI elements (placeholder for future logic).

## Start Here

- Concepts: [[Concepts]]
- Entities: [[Concepts/Entities]] → [[Concepts/Entities/Units]], [[Concepts/Entities/Buildings]]
- Mechanics: [[Mechanics]] → [[Mechanics/Abilities]], [[Mechanics/Destroy]], [[Mechanics/Agents/AgentSpawning]], [[Mechanics/Agents/Agents_Attach_To_Folders]], [[Mechanics/Agents/AgentModels]], [[Mechanics/Camera/Minimap]], [[Mechanics/Camera/EdgePanning]]
- Integration: [[Mechanics/Integration/MCPServer]], [[Mechanics/Integration/HeroMCP]]
- Subscription access: [[Mechanics/SubscriptionAccess]]
- Reference: [[Reference]]

## Style Notes

- Use wiki links (`[[...]]`) for navigation between pages.
- Keep headings short and stable.
- Use present tense and active voice.
