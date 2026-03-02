# Attach Mechanics

Definition

- Non-hero units attach to buildings upon reaching their hitbox and then orbit.

In-Game Behavior

- Right-click on/near a building with units selected queues an attach order and moves the units to the building center.
- If a unit is already inside the hitbox when the order is issued, it attaches immediately without the travel phase.
- On arrival within hitbox (~60px), units stop and begin orbit.
- New move command before arrival cancels the attach order; destroying the building detaches units.

Invariants

- Heroes are excluded from attach orders and never attach.
