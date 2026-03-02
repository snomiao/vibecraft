import { useEffect, useRef } from 'react';
import type { Folder } from '../../shared/types';
import { workspaceClient } from '../services/workspaceClient';

type SetFolders = React.Dispatch<React.SetStateAction<Folder[]>>;

export function useWorktreeConflicts(workspacePath: string, folders: Folder[], setFolders: SetFolders): void {
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const hasConflict = folders.some((f) => f.conflictState);
    if (!hasConflict) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return undefined;
    }
    if (pollRef.current) {
      return undefined;
    }

    pollRef.current = setInterval(async () => {
      const conflictIds = folders.filter((f) => f.conflictState).map((f) => f.id);
      if (conflictIds.length === 0) return;
      const updates: Record<string, Folder> = {};
      await Promise.all(
        conflictIds.map(async (id) => {
          try {
            const refreshed = await workspaceClient.refreshFolderConflictState(workspacePath, id);
            if (refreshed) {
              updates[id] = refreshed;
            }
          } catch (err) {
            console.error('Failed to refresh conflict state', err);
          }
        })
      );
      if (Object.keys(updates).length > 0) {
        setFolders((prev) => prev.map((f) => (updates[f.id] ? { ...f, ...updates[f.id] } : f)));
      }
    }, 4000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [folders, setFolders, workspacePath]);
}

export default useWorktreeConflicts;
