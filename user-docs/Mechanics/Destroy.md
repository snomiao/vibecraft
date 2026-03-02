# Destroy Mechanics

Definition

- Remove eligible buildings from the world; folders go to OS Trash/Recycle Bin. Core provider buildings (Claude Code, ChatGPT Codex) are excluded and remain permanently.

In-Game Behavior

- Bottom HUD shows a red Destroy button when a destroyable building is selected. Delete key triggers the same flow with confirmation.
- When multiple non-hero agents are selected, pressing Delete instantly invokes the bulk destroy flow (same cleanup as the HUD button).
- Provider buildings never expose the destroy button and the Delete hotkey surfaces a system message instead of removing them.
- Agent terminals and workspace terminals delete immediately; workspace terminals stop their shell process when removed.

Bulk Agent Destruction

- When multiple agents are selected, a red bulk delete button appears with a gold count badge showing the number of selected agents.
- The bulk delete button uses the same visual styling as building destroy buttons (red gradient background, red DEL hotkey).
- Hero units are automatically excluded from bulk selection and destruction.
- Bulk delete properly terminates all associated processes for each agent, including complex process hierarchies (e.g., Codex agents with Node.js servers).
- Each agent is destroyed individually with proper cleanup: agentDetach followed by stopAgent to prevent orphaned processes.
