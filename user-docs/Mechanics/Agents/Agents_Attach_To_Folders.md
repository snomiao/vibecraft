# Agents Attach To Folders → Operate In-Place

Definition

- Non-hero units (agents) can attach to Folder buildings. When attached, the agent “operates” within that folder’s filesystem context using its provider. Each attach records the working directory so later actions run in-place.

In-Game Behavior

- Right-click Folder with a non-hero unit selected queues an attach-on-arrival order; upon contact with the Folder hitbox, the unit attaches and orbits the building.
- If the unit is already inside the hitbox when the order is issued, attachment triggers immediately.
- While attached, any chat message that contains an @mention of that unit is forwarded to its provider process for execution in the attached folder.
- Detaching (new move order) or destroying the unit/building terminates the process.

Lifecycle

1. Spawn agent unit.
2. Unit attaches to a Folder and records that folder as its working context.
3. The agent becomes “online” for that folder.
4. Chat @mentions of the unit are routed to that agent and run within the attached folder.
5. Results are surfaced back into the world and chat.
6. Detach/move/destroy clears the attachment and ends the agent’s folder-scoped session.

Interactions

- Multiple agents may attach to the same Folder (each has its own process) as long as process cap allows.
- Messages can mention multiple units; each mentioned, attached agent gets the message independently and headless runs begin in parallel.

Visuals

- Optional: small link/plug indicator on attached units to show they are “connected”.
- Optional: building badge showing number of attached units.

Invariants

- Exactly one attachment record per agent.
- Actions always run in the currently attached folder.
- Attachments are cleared on detach or when the unit/building is destroyed.
- Chat dispatch only occurs for explicitly @mentioned units.

Related

- [[Mechanics/Agents/AgentSpawning]] (how units and backend Agents are created and mapped)

Acceptance Criteria

- Attaching a unit to a Folder starts a provider process working in that folder.
- Detaching or destroying the unit/building stops the process within 1s.
- Messages with @UnitName route to that agent’s process if attached; otherwise they are ignored with a toast: “@Name is not attached to a folder”.
- Multiple mentions fan-out to each attached agent and run in parallel (independent streams).
- No process is spawned until a unit attaches to a Folder.
