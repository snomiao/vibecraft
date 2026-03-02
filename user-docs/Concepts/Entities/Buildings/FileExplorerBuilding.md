# File Explorer Buildings

The file explorer building lets you inspect a workspace folder without leaving the RTS view. It renders an overlay panel that lists the files inside a folder, supports quick navigation, and opens files in the host system on demand.

## Creating a File Explorer

- Select any folder, folder worktree, or folder conflict building.
- Use the **View Files** ability (hotkey `R`) from the bottom HUD.
- Click on the map to place the explorer panel. The panel must be placed on an open tile just like browsers and terminals.

If you trigger _View Files_ on the workspace root, the building starts in that root folder and renders as `.` in the header path.

## Panel Anatomy

The overlay is composed of:

- **Header** – shows the folder display name and the relative path (root appears as `.`). Buttons:
  - `↑ Up` to navigate to the parent folder (hidden while you are at the base path).
  - Toggle hidden files button (Show/Hide) to include or exclude dotfiles.
- **Content list** – entries are grouped with directories first. Double-click a folder to drill into it or a file to open it in the system viewer/editor.
- **Status footer** – reports the number of visible items and the count of hidden entries that are currently filtered out.

Selection inside the panel tracks the last clicked item so keyboard shortcuts can act on the highlighted entry in future iterations.

## Behaviour and Persistence

- Explorer buildings remember their window position and state (path, hidden toggle, workspace) through the standard building metadata updates.
- Panels resize with the same rules as browser/terminal buildings once placed; collision checks now respect their rectangular footprint when you place other structures nearby.
- Removing a folder building that spawned a file explorer automatically closes the associated overlay.

## Limitations & Tips

- The explorer is read-only today; edits must be done via terminals or external editors.
- Opening a file hands off to the operating system, so ensure you have handlers for the file types you expect.
- When reloading the workspace, explorers restore their last known location but will clear selection state until the listing is reloaded.

This feature delivers an in-world view of the workspace tree so you can inspect files quickly without switching context.
