# Rename Autocomplete

Definition

- Inline folder rename UI with top-level folder autocomplete anchored to the building label.

In-Game Behavior

- Click a folder’s name to start renaming directly at its label (no separate modal).
- As you type, a dropdown appears with prefix-matched, top-level, unimported workspace folders you can remap to. The adjacent ▼ button also toggles the full list.
- Keyboard: Enter confirms, Escape cancels. Clicking outside cancels.
- Restrictions: imported folders show as disabled in the list and cannot be chosen.

System Behavior

- Suggestions list only top-level, unimported folders in the workspace (no deeper levels), filtered by prefix match against the folder name.
- Confirmation:
  - Picking a suggestion fills the input with that folder’s relative path and confirms immediately.
  - Pressing Enter confirms the current input text.
- Rename semantics: if the confirmed name matches an existing folder on disk, the app links the building to that folder instead of renaming on disk. See [[Concepts/Entities/Buildings/Folders]].

UI/Rendering

- The input and the suggestions dropdown render inside the canvas container to inherit its stacking context and zoom scale.
- The overlay scales with camera zoom and stays below the Top HUD.

Related

- [[Concepts/Entities/Buildings/Folders]]
- [[Mechanics/World/Selection]]
