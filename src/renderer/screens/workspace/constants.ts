/**
 * Constants for workspace entity positioning and layout
 */

// Z-index management
export const INITIAL_Z_INDEX = 2001;

// Selection
export const SELECTION_DRAG_THRESHOLD_PX = 4;

// Camera diagnostics/minimap synchronization
export const CAMERA_SYNC_INTERVAL_DEFAULT_MS = 16;
export const CAMERA_SYNC_INTERVAL_HIGH_ENTITY_MS = 33;
export const CAMERA_HIGH_ENTITY_THRESHOLD = 120;
export const PERF_DIAGNOSTICS_ENTITY_THRESHOLD = 80;

// Agent spawn positioning
export const AGENT_SPAWN_OFFSET_X = 100;
export const AGENT_SPAWN_OFFSET_Y = 50;
export const AGENT_SPAWN_SPACING = 50;
export const TUTORIAL_AGENT_SPAWN_EXTRA_Y = 150;

// Browser spawn positioning
export const BROWSER_SPAWN_OFFSET_X = 200;
export const BROWSER_SPAWN_OFFSET_Y = 100;
export const TUTORIAL_BROWSER_SPAWN_GAP = 80;

// Terminal spawn positioning
export const TERMINAL_SPAWN_OFFSET_X = 150;
export const TERMINAL_SPAWN_OFFSET_Y = 150;

// Folder spawn positioning
export const FOLDER_SPAWN_OFFSET_X = 150;
export const FOLDER_SPAWN_OFFSET_Y = -50;

// Entity sizing (px)
export const AGENT_TOKEN_SIZE_PX = 48;
export const HERO_TOKEN_SIZE_PX = 64;
export const FOLDER_ICON_SIZE_PX = 80;

// Magnetic snap attach/detach
// Attach distance controls where agents sit around a folder.
export const FOLDER_ATTACH_DISTANCE_PX = 84;
// Snap radius controls drag magnetic range.
export const FOLDER_SNAP_GRAVITY_RADIUS_PX = 150;
// Right-click attach proximity controls command-attach range.
export const FOLDER_RIGHT_CLICK_ATTACH_RADIUS_PX = 84;
export const FOLDER_SNAP_GAP_PX = 8;
export const ATTACH_ANGLE_STEP_DEG = 30;

// Right-click move
export const MIN_MOVE_SPEED = 400;
export const MOVE_MAX_DURATION_MS = 1500;
export const FORMATION_PADDING_PX = 8;
