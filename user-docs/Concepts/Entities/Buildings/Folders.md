# Folders (Building Subtype)

Definition

- In-world buildings backed by filesystem directories inside the selected workspace.

In-Game Behavior

- Select, rename, destroy (moves to OS Trash/Recycle Bin), unlink (remove from UI only). Loaded with persisted positions.
- Rename supports top-level folder autocomplete and fuzzy search. See [[Mechanics/Buildings/RenameAutocomplete]].

Visuals

- Building selection ring, blue label style.

Abilities (Folder)

- Open: reveal folder in file explorer.
- Rename: inline rename; if the chosen name already exists on disk, the building links to that existing folder instead of renaming anything on disk.
- Remove from UI (❌): removes only the in‑world representation; the folder on disk remains unchanged. No confirmation dialog.

Related

- [[Mechanics/Buildings/ImportPlacement]]
