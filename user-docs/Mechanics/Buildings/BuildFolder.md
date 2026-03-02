# Build Folder Mechanics

Definition

- Place folder buildings in the world (filesystem-backed directories).

In-Game Behavior

- Click on the folder ability in the top action bar; a green placement preview appears at the cursor and follows it.
- Preview snapping: preview snaps to a grid (default 32px) in world space.
- Fit validation: preview is green when a placement is valid, red if invalid (overlapping another building footprint).
- Click to place at the snapped position when valid; inline rename starts immediately. Invalid (red) clicks do nothing.

Additional Behavior

- New folders are automatically initialized as Git repositories with an initial commit.

Placement Preview (Renderer)

- Footprint: approximately matches building sprite size (~80×80), centered at the snapped cursor position.
- Grid: `GRID_SIZE = 32` (snapping to nearest grid cell).
- Validation rules:
  - Overlap only: AABB check vs existing buildings (folder ~80×80; browser/terminal use their width/height).
- Visual states: stroke/fill color 0x32CD32 (green) when valid, 0xFF4444 (red) when invalid; subtle alpha on fill.

Related

- [[Reference/Controls]] (build hotkey, click to place)
- [[Reference/Visuals]] (preview visuals)
