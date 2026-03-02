# Import Placement

Definition

- Automatic placement for the first imported folder in a workspace to keep it visible and close to provider buildings.

In-Game Behavior

- On opening a brand‑new world (no prior folder metadata), the app auto‑imports the most recently modified top‑level folder in the workspace.
- Placement is biased near provider buildings (Claude Code, ChatGPT Codex) and kept within the current camera viewport with padding for the Top HUD.
- The building snaps to the world grid and avoids overlapping existing footprints. If all candidates collide, it falls back to the viewport center (snapped).

Placement Algorithm (summary)

- Provider anchor: average the positions of provider buildings if present; otherwise use the viewport center.
- Candidate points: generate a few offsets biased below the anchor; clamp to the visible world bounds with padding to avoid the Top HUD.
- Grid + collision: snap each candidate to the grid and check for footprint overlap. Try small nearby nudges before falling back to center.

Invariants

- Honors grid snapping, HUD padding, and on‑screen visibility.
- Never overlaps existing buildings; does nothing if the folder is already imported.

Related

- [[Mechanics/Buildings/BuildFolder]]
- [[Concepts/Entities/Buildings/Folders]]
