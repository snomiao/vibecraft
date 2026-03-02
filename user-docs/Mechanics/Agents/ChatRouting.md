# Chat Routing (@Mentions → Agents)

Definition

- The chat input supports `@mentions` of units. Messages that include one or more unit names are dispatched to the corresponding agents if and only if those units are attached to a Folder (i.e., have an active Claude Code process).

Behavior

- Opening chat via Enter while units are selected prefills the input with `@UnitName` mentions for all selected non-hero units (multi-select supported). Hero is excluded by design.
- If you submit without any @mentions, the chat appends a soft system line: "But it fell on empty ears..." (grey italics) to indicate no agents received the message.
- For each unique `@UnitName` present:
  - Resolve the mention to a currently-present unit.
  - Resolve that unit to its linked agent.
  - If the unit is attached to a Folder, route the message to that agent to run in the folder.
  - If not attached, append a system message: "@UnitName is not attached to a folder."
- UI preserves the original text in history; tool output is appended as system messages attributed to the agent.
- Tool output appears in collapsible cards with agent-colored names; only the arrow button (right side) toggles expansion.

Visual Feedback

- **Thinking Indicators**: When agents receive messages, their corresponding units display animated thinking bubbles with rotating dots (...).
- **Completion Indicators**: When agents finish processing, units briefly show a checkmark to indicate completion.
- **Status Tracking**: Unit UI status changes to "working" during agent processing and returns to idle when complete.
- **Error Handling**: Thinking indicators are properly cleared even when agents encounter errors or timeout.

Multi-mention

- If multiple units are mentioned, the message fans out to all resolved, attached agents.
- Runs start in parallel; there is no UI serialization of launches across agents. Each agent streams independently.
- Order of delivery is not guaranteed.

Invariants

- No implicit routing: only explicit @mentions trigger dispatch.
- The hero unit is not taggable and never receives chat routing.
- Unknown names are ignored; a soft warning is shown in recent messages area.
- Messages with no @mentions do not route; a passive system note is added to history.

Acceptance Criteria

- Typing “@Ari please run tests” sends text to the agent mapped to unit “Ari” if attached.
- If “Ari” is not attached, a system toast warns and nothing is sent.
- Mentioning two units sends to both, and each agent’s output appears under separate system messages.
