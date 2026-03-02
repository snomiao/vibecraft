# Heroes (Units Subtype)

Specifics

- Elevated capabilities; used for workspace-level actions.
- Cannot attach to buildings (excluded from attach orders).

In-Game Behavior (Hero-only)

- Build mode: press B to place folder buildings; Escape cancels.
- Create-browser mode: press C (or use the HUD ability). Drag to size the browser panel; release to create. If the preview is red (invalid), releasing resets the start so you can try again. A small cursor-following hint appears before dragging and hides on drag/Escape/finish.
- Create-terminal mode: press T (or use the HUD ability) with an agent or folder selected. Drag to size the terminal; release to create. The cursor-following hint is screen-space anchored, so it stays at the pointer at any zoom.
- Right-click building: treated as a move only (no attach).
- Ability catalog: [[Concepts/Entities/Units]] (Abilities section).

Invariants

- Never included in attach queues; ignore direct attach requests.
