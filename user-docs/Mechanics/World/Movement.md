# Movement Mechanics

Definition

- Move units by right-clicking the ground or by dragging selected units. Movement applies slight formation spread for multi-select.

In-Game Behavior

- Right-click with units selected moves them to a target point; shows a small green flag indicator.
- Click‑dragging a selected unit (or group) lets you reposition it directly in world space.
- If multiple units are selected, movement maintains a loose formation spread around the target or drag position.
- Buildings that are movable can also be repositioned by clicking and dragging them.

Invariants

- Right-click on building path is intercepted by attach-order logic (see [[Mechanics/Agents/Attach]]).
