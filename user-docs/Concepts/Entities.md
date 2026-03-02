# Entities

Definition

- Interactive actors in the game world. All entities inherit from a shared Entity concept and expose position, selection, and ability hooks.
- Two concrete classes exist today:
  - [[Concepts/Entities/Buildings]] — static world objects anchored to the map.
  - [[Concepts/Entities/Units]] — mobile agents that roam the map.

Abilities

- Every entity surfaces a set of abilities through the Bottom HUD; the ability list depends on the entity type.
- System-level details live in [[Mechanics/Abilities]].
- Catalogs:
  - [[Concepts/Entities/Buildings]] (see Abilities section)
  - [[Concepts/Entities/Units]] (see Abilities section)

Shared Mechanics

- Selection applies to all entities; see [[Mechanics/World/Selection]].
- Attachment exists between units and buildings; see [[Mechanics/Agents/Attach]].
- Movement is unit-only; see [[Mechanics/World/Movement]].

Document Map

- Use entity docs for common behaviour, then drill into subtype files for specifics (e.g., [[Concepts/Entities/Buildings/Folders]]).
- Mechanics docs capture cross-entity systems (movement, attach, destroy, etc.).
