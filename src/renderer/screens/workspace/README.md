# Workspace Screen Structure

This folder follows a "composition over entanglement" rule: the top-level
controller composes independent mechanics, and each mechanic stays isolated
from the others.

## Layering Order

1. **Pure layout/math**
   - `attachLayout.ts`, `movement.ts`
   - No React, no side effects, no IPC.

2. **Mechanics hooks (single responsibility)**
   - `useMovementController.ts` (right-click movement + intent resolution)
   - `useAgentMagnetism.ts` (drag attach/detach + snap state)
   - Mechanics do not import each other.
   - Mechanics receive all dependencies via params (no global state).

3. **Managers**
   - `useAgentManager.ts`, `useBrowserManager.ts`, `useFolderManager.ts`,
     `useDialogs.ts`
   - Responsible for IO, IPC calls, and persistent changes.

4. **Composition**
   - `useWorkspaceController.ts` wires managers + mechanics + view state.
   - It should not contain complex behavior logic. When a mechanic grows,
     extract it into a new hook at level 2.

5. **View**
   - `WorkspaceCanvas.tsx`, `WorkspaceHeader.tsx`, `WorkspaceDialogs.tsx`
   - Pure rendering with callbacks from the controller.

## Rules to Keep Mechanics Isolated

- Mechanics can depend on layout/math utilities, but not on each other.
- Mechanics accept the data they need as params and return a minimal surface.
- The controller is the only place that coordinates multiple mechanics.
- Avoid adding new stateful refs to the controller unless they truly belong
  to global orchestration.

## Adding a New Mechanic

1. Create a new hook in this folder, next to `useMovementController.ts`.
2. Keep it focused on one behavior (snap, selection, etc).
3. Pass in only the dependencies it needs.
4. Wire it up in `useWorkspaceController.ts`.
