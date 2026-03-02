# Controls

- Left-click: select unit/building.
- Left-click browser overlay: selects the browser (border, header, or the webview itself).
- Drag (left): selection box (units preferred if both present).
- Selection drag passes over browser overlays (temporary pass-through).
- Middle-click + drag anywhere on the map: pan the camera (overlays temporarily pass pointer events through).
- Right-click ground: move units to target.
- Right-click building:
  - Folder (folder/folder-worktree/folder-conflict)
    - Heroes: move to the edge of the folder and stop (no orbit).
    - Agents (non-hero): attach on arrival and orbit the folder.
  - Provider buildings (Claude Code, ChatGPT Codex)
    - Heroes and agents: move to the edge of the building and stop (never orbit).
  - Other buildings
    - Heroes: move to the edge and stop.
    - Agents: attach on arrival and orbit.
- B: enter build-folder mode (hero only). Click to place.
- C: enter create-browser mode (hero only). Drag to size, release to create. If the preview is red (invalid), releasing resets the start point so you can pick a new area. Escape cancels even if an input/overlay is focused.
- Escape: cancel build mode, browser mode, and rename/edit.
- Delete: destroy selected building (folders to Trash, others removed). Provider buildings (Claude Code, ChatGPT Codex) ignore the command. When multiple non-hero agents are highlighted, Delete triggers the bulk destroy flow for all of them.
- T: with a folder selected, enter workspace-terminal placement (drag to size, release to create a folder-scoped terminal). With an agent selected, enter create-terminal mode for that agent (drag to size, release to create a terminal building fixed on the map).
- Click and drag selected unit(s): reposition them directly.
- Click and drag selected movable building: reposition it (folders snap to grid; overlaps blocked).
- R: Resize selected Browser/Terminal panel. Shows four corner grabbers. Drag a corner to resize; grid‑snapped; Escape cancels. Press R again to exit.
- Enter: open chat (if inputs are not focused).

Chat System

- Tool cards: click arrow button (right side) to expand/collapse tool output details
- Tool card body: clicking anywhere except arrow activates chat input for new messages

Minimap

- Click to center the camera view. Use middle-click drag on the world to pan if you need finer adjustment.

Overlays

- Panning/zooming: browser and terminal overlays temporarily ignore pointer events so map interactions continue smoothly.
- Grace window: after a pan/zoom starts, overlays remain pass-through for ~500ms so brief continued scrolling over them keeps navigating the map.
- Resize mode: while dragging a resize handle, overlays remain pass‑through and the pointer stream is handled at the document level to ensure smooth resizing, even when the cursor leaves the handle.

HUD Overlay (APM/TPM)

- APM (actions/min):
  - Typing (chat, terminals, inputs) counts as 1 action per completed “word” (committed on boundaries like space/punctuation or a short idle). Delete/backspace are collapsed into edit bursts (1 action per burst). Enter (submit) counts as an action and also finalizes any pending word/edit.
  - Non-typing keyboard actions (shortcuts, arrows, Escape, function keys) each count as 1 action.
  - Scroll/pinch gestures count as 1 action per continuous gesture (≈300ms idle window).
  - The reading reflects roughly the last ~10s of activity scaled to a per-minute rate.
- TPM (tokens/min): mirrors the green token delta floaters and uses the same short rolling window.

Developer Shortcuts

- Cmd+Shift+K (macOS) / Ctrl+Shift+K (Windows/Linux): Toggle cinematic mode on/off.
- Cmd+Shift+C / Ctrl+Shift+C: Copy the entire chat history as timestamped plain text. Hold Option/Alt to clear the chat transcript instead of copying.
- Ctrl+Shift+L: Trigger the XP level‑up beam on the selected folder/worktree building.
