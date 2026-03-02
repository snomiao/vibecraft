# Non-Hero Units (Units Subtype)

Specifics

- Regular agents that can attach to buildings upon arrival.
- Can be selected individually or in bulk for multi-agent operations.
- Eligible for bulk deletion when multiple units are selected (hero units are excluded).

In-Game Behavior (Non-hero only)

- Right-click building: queues attach-on-arrival order; unit moves to building and attaches within hitbox (~60px), then orbits.
- Already-in-range units attach immediately with no movement step.
- Right-click ground before arrival cancels the pending attach.
- Ability catalog: [[Concepts/Entities/Units]] (Abilities section).

Invariants

- Attach detection uses live world positions for both unit and building.
- Detach on new move command or building destroy.
