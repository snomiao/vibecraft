# Agent Spawning (Units ⇄ Agents)

Spec: How player actions create a Claude Code agent and its in‑world unit, and how those map to backend state and later attachment.

Definition

- Spawning creates a backend Agent (process-less until attached) and a corresponding in‑world Unit the player can command.

In‑Game Behavior

- When the player triggers “Create Agent” (via HUD/ability or the N hotkey while the Claude Code building is selected), a new Claude unit appears near the Claude Code building.
- The new unit can move like any non-hero unit. It does not start a Claude Code process until it attaches to a Folder building.
- A global cap previously limited units; the app now uses an unlimited cap.

Notes

- Each spawned unit is linked to a backend agent record.
- Spawning does not start an agent session; sessions begin only when the unit attaches to a Folder building (see [[Mechanics/Agents/Agents_Attach_To_Folders]]).

Lifecycle

- Trigger: Player executes the Create Agent action (HUD / hotkey N with the Claude Code building selected).
- Backend: A new agent record is created.
- Unit: A corresponding unit spawns near the Claude Code building and is linked to that agent.
- Attach later: When the unit attaches to a Folder, the agent begins operating in that folder. Until then, the agent has no active session.

Interactions

- Cap: There is no cap; the UI does not block spawning due to supply.
- Destroy unit: Destroying the unit ends its linked agent session (if any) and updates counts.
- Chat: `@mentions` resolve to the linked agent for that unit. Messages only execute for attached agents; otherwise the UI attempts auto-attach (with clear messages) or warns.

Visuals

- The new Claude unit spawns slightly offset from the Claude Code building to avoid overlap.
- The hero remains unique and cannot attach.

Invariants

- No Claude Code process is started at spawn time; processes are strictly attach-driven.
- Each spawned unit maps to exactly one backend agent.
- Spawning is not limited by a unit cap.

Acceptance Criteria

- Pressing N while the Claude Code building is selected always spawns a new Claude unit (no cap).
- A new backend agent is created and linked to the spawned unit.
- The agent has no running process until the unit attaches to a Folder building.
- `@UnitName …` messages are routed to the correct agent and only execute when attached.
