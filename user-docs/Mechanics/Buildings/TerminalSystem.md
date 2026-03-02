# Terminal System

## Overview

The terminal system provides world-fixed shell access in two ways:

- **Agent terminals** – one per agent for direct interaction with Claude Code or Codex processes.
- **Workspace terminals** – folder-scoped terminals that inherit the selected folder’s working directory for user commands.

## Features

### Terminal Panels (as buildings)

- **World-fixed**: The terminal is a building; pan/zoom the camera to view it
- **Place by dragging**: Enter create-terminal mode then drag to size; release to create
- **Opaque Background**: Terminal has a non-transparent background (not a floating overlay)
- **One Per Agent**: Exactly one agent terminal per agent; creating a new one replaces the previous
- **Folder Scoped**: Workspace terminals use the chosen folder’s working directory and can be created anywhere on the map
- **Workspace Layout Persistence**: Workspace terminal buildings restore their last position and size when you reopen a workspace; agent terminals remain session-only

### Terminal Integration

- **Provider Sessions**: Agent terminals connect to the agent’s live session for direct interaction.
- **Rich Rendering**: Full color and formatting support with an opaque background.
- **History Persistence**: Terminal content is preserved when panels are closed/reopened
- **Background Terminals**: Hidden terminals maintain state even when panels are closed

### Terminal Management

- **Automatic Sizing**: Opens at 65% width × 85% height of default size (559px × 357px)
- **State Persistence**: Agent terminal layout/history is kept for the current session; workspace terminals persist layout across app restarts
- **Multiple Panels**: Multiple terminal panels can be open simultaneously

## Usage

### Agent Terminals

**Via Ability Panel:**

1. Select an agent unit (Claude, Codex, etc.)
2. Click the "Create Terminal" ability to enter create-terminal mode
3. Drag to size and release to place the terminal on the map

**Via Hotkey:**

1. Select an agent unit
2. Press `T` to enter create-terminal mode (drag to size)

### Workspace Terminals

**Via Ability Panel:**

1. Select a folder or folder worktree building
2. Click "Create Terminal" in the folder abilities panel
3. Drag to size and release to spawn a workspace terminal bound to that folder’s working directory

**Via Hotkey:**

1. Select a folder or folder worktree building
2. Press `T` to enter workspace terminal placement mode (drag to size)

### Placement UX

- Before dragging starts, a small cursor-following hint appears near the pointer (e.g., “Drag to create terminal”).
- The hint is positioned in screen-space (canvas-relative pixels), so it stays aligned with the cursor at any zoom/pan.
- The terminal preview rectangle is drawn in world space and snaps to the grid; the hint hides while dragging and on completion/cancel.

### Terminal Controls

- **Reposition**: Click and drag the terminal building to a new location (overlaps are blocked).
- **Resize**: Delete the terminal, then place a new one with `T` at the desired size.
- **Delete**: Select the terminal building and press `Delete` (or `Backspace` on macOS keyboards)
- **Focus**: Click inside the terminal area to focus for typing

### Terminal Features

- **Full Shell Access**: Complete terminal environment for agents and folders
- **Copy/Paste**: Standard terminal copy/paste functionality
- **Scrollback**: 1000 lines of scrollback history
- **Auto-fit**: Terminal automatically resizes to fit panel dimensions
- **Auto-Restart**: Workspace terminals automatically relaunch their shell session when you type after a session exits (e.g., after `[terminal exited]`).

## Technical Implementation

This section intentionally omitted here to keep the docs conceptual and implementation‑agnostic.

## Styling

### Panel Appearance

- Opaque dark background (`#111`)
- Border colored as a slightly lightened version of the agent color
- Compact header showing the agent name
- Rounded corners and modern shadow effects

### Terminal Display

- Standard xterm color palette on an opaque background
- Blinking cursor
- Proper ANSI color and formatting support for both Claude and Codex (palette OSC sanitized for Codex input field)

## Best Practices

### Usage Tips

- Use the T hotkey for quick terminal placement
- Recreate a terminal to move/resize it (delete then place again)
- Workspace terminals persist across app restarts; agent terminals are still session-scoped

### Performance

- Terminal history is capped at ~1MB per agent (session)
- Panel rendering optimized for transparency effects

### Workflow Integration

- Use agent terminals for direct debugging of AI-run processes
- Use workspace terminals to run git commands, package installs, or shell scripts from folder buildings
- Monitor agent processes in real-time and view output not shown in chat
- Keep multiple folder terminals open for parallel tasks

## Limitations

- Workspace terminal layout/state is persisted per workspace; agent terminals remain session-only
- Maximum terminal history limited to prevent memory issues
- One agent terminal panel per agent at a time (workspace terminals are unlimited)
- Agent terminals require the corresponding agent to be running; workspace terminals require a valid folder path
