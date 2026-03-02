# Minimap

Definition

- The minimap is a compact overview of the world that supports fast navigation and situational awareness.

In‑Game / User Behavior

- The minimap shows a scaled view of terrain, buildings, and units.
- A viewport box indicates the area currently visible in the main world view.
- Click on the minimap to recenter the camera on that location.
- The minimap updates continuously as you pan, zoom, and create or destroy entities.

Viewport Box

- The viewport box scales with zoom: zooming in shrinks the box; zooming out expands it.
- The box always stays within minimap bounds.

Bounds and Scaling

- The minimap automatically fits to the smallest rectangle that contains all active world content, with a bit of padding.
- If you pan away from all content, bounds temporarily extend to include your current viewport and then shrink back as you return.

Visual Legend

- Colors and shapes on the minimap match the world’s visual language for folders, providers, terminals, and other buildings.
- Units are drawn above terrain and are distinct from buildings.
- See [[Reference/Visuals]] for the canonical minimap symbology and color meanings.

Invariants

- The minimap is always consistent with world state; it never shows hidden or stale entities.
- Clicking the minimap never issues orders; it only moves the camera.

Acceptance Criteria

- Clicking a point on the minimap recenters the camera there.
- The viewport box matches the visible world area at all zoom levels.
- New buildings/units appear on the minimap immediately and disappear when destroyed.
