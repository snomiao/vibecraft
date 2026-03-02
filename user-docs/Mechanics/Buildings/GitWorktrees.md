# Git Worktrees Mechanics

## Overview

Git worktrees let you create parallel working directories from a single Git repository so you can develop multiple branches at once without constantly switching context.

In VibeCraft, worktrees are represented as folder‑type buildings with dedicated abilities for creating, syncing, and merging worktrees.

## What are Git Worktrees?

Git worktrees allow multiple branches of the same repository to be checked out into separate directories. Each worktree has its own working directory and index but shares the same repository history.

## Key Features

### 1. Visual Worktree Creation

- **Hotkey**: Press `F` when a Git repository folder is selected.
- **UI Integration**: A “Create Worktree” ability appears in the bottom HUD for Git folders.
- **Automatic Naming**: Default names follow `{source-folder}-wt-{shortId}`.
- **Custom Naming**: You can provide a custom name during creation.

### 2. Worktree Management

#### Sync From Source

- **Purpose**: Bring the latest changes from the source folder’s branch into the worktree branch.
- **Usage**: Click “Sync From Source” when a worktree folder is selected.
- **Process**:
  - Updates the worktree from the source branch.
  - Surfaces clear success/failure feedback.

#### Merge To Source

- **Purpose**: Merge a worktree’s changes back into the source folder while preserving any WIP in the source.
- **Usage**: Click “Merge To Source” when a worktree folder is selected.
- **Process**:
  - Automatically commits uncommitted worktree changes to avoid loss.
  - Temporarily stashes any uncommitted changes in the source folder.
  - Merges the worktree branch into the source branch.
  - Restores the stashed source changes after merge. If stash restore fails, the source enters a “restore conflict” state until the stash can be applied or the merge is undone.
  - On success, removes the worktree from the UI.
  - Plays a success chime.

### 3. Visual Differentiation

- **Building Types**:
  - Regular folders (blue `#4A90E2`)
  - Worktree folders (darker blue `#2F5B95`)
  - Conflict state folders (red `#ff4444`)
- **Color Coding**: Each type has distinct colors for easy identification.
- **Unique Abilities**: Abilities change based on whether a folder is a source, worktree, or conflict state.

## Conflict Resolution

Conflicts can arise when syncing or merging:

- If merging worktree changes into the source produces conflicts, the source folder enters a conflict state (red) and the worktree is temporarily hidden.
- If restoring stashed source changes produces conflicts, the same conflict state is entered.

In conflict state:

- Worktree abilities are replaced with resolution options: **Undo Merge** (abort/reset/restore stash) and, when stash restore failed, **Retry Restore**. Normal folder actions are disabled until clear.
- Chat surfaces a clear notification about what conflicted and what action is needed.

When conflicts are fully resolved, the source folder returns to normal and any hidden worktree is cleaned up.

## Use Case Scenarios

### Parallel Feature Development

- **Main folder**: Working on bug fixes or maintenance tasks (WIP, uncommitted).
- **Worktrees**: Develop features or experiments in parallel, each with its own branch and directory.
- **Result**: Merge completed worktrees back without disturbing main‑folder WIP.

### Seamless Context Switching

- No need to manually stash, commit, or switch branches.
- Switch between features by selecting different folder buildings.

### Low Git Friction

- Users interact with folders naturally.
- The system handles branching, committing, syncing, and merging under the hood.

## Best Practices

- Create a worktree for any task that might take more than a short iteration.
- Sync from source regularly to reduce conflict risk.
- Merge to source only when the worktree is in a good, reviewable state.
- Keep WIP in the main folder; the merge flow is designed to preserve it.

## Future Enhancements

- Visual indicators for branch relationships.
- Batch worktree operations.
- Richer conflict resolution UX.
