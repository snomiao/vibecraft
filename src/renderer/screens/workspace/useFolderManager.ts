import { useState, useCallback } from 'react';
import type { Folder } from '../../../shared/types';
import { workspaceClient } from '../../services/workspaceClient';

export interface FolderRenameState {
  folderId: string | null;
  value: string;
  dropdownOpen: boolean;
}

export interface UseFolderManagerReturn {
  renameState: FolderRenameState;
  setRenamingFolderId: (id: string | null) => void;
  setRenameValue: (value: string) => void;
  setRenameDropdownOpen: (open: boolean) => void;
  toggleRenameDropdown: () => void;
  clearRenameState: () => void;
  renameFolderCore: (
    workspacePath: string,
    folderId: string,
    newName: string,
    folders: Folder[]
  ) => Promise<{ success: boolean; error?: string }>;
}

export function useFolderManager(): UseFolderManagerReturn {
  const [renameState, setRenameState] = useState<FolderRenameState>({
    folderId: null,
    value: '',
    dropdownOpen: false,
  });

  const setRenamingFolderId = useCallback((id: string | null) => {
    setRenameState((prev) => ({ ...prev, folderId: id }));
  }, []);

  const setRenameValue = useCallback((value: string) => {
    setRenameState((prev) => ({ ...prev, value }));
  }, []);

  const setRenameDropdownOpen = useCallback((open: boolean) => {
    setRenameState((prev) => ({ ...prev, dropdownOpen: open }));
  }, []);

  const clearRenameState = useCallback(() => {
    setRenameState({
      folderId: null,
      value: '',
      dropdownOpen: false,
    });
  }, []);

  const toggleRenameDropdown = useCallback(() => {
    setRenameState((prev) => ({ ...prev, dropdownOpen: !prev.dropdownOpen }));
  }, []);

  const renameFolderCore = useCallback(
    async (workspacePath: string, folderId: string, newName: string, folders: Folder[]) => {
      const folder = folders.find((entry) => entry.id === folderId);
      if (!folder) {
        return { success: false, error: 'Folder not found' };
      }

      const trimmed = newName.trim();
      if (!trimmed) {
        return { success: false, error: 'Folder name cannot be empty' };
      }

      try {
        const result = await workspaceClient.renameFolder(workspacePath, folder.id, trimmed);
        if (!result.success) {
          return { success: false, error: result.error || 'Failed to rename folder' };
        }
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
    []
  );

  return {
    renameState,
    setRenamingFolderId,
    setRenameValue,
    setRenameDropdownOpen,
    toggleRenameDropdown,
    clearRenameState,
    renameFolderCore,
  };
}
