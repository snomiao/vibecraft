import { act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { useFolderManager } from '../../../src/renderer/screens/workspace/useFolderManager';
import type { Folder } from '../../../src/shared/types';

vi.mock('../../../src/renderer/services/workspaceClient', () => ({
  workspaceClient: {
    renameFolder: vi.fn(),
  },
}));

import { workspaceClient } from '../../../src/renderer/services/workspaceClient';

const buildFolder = (id: string, name: string): Folder => ({
  id,
  kind: 'folder',
  name,
  relativePath: name,
  x: 0,
  y: 0,
  createdAt: Date.now(),
});

describe('useFolderManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('renameState management', () => {
    test('initial state has no active rename', () => {
      const { result } = renderHook(() => useFolderManager());

      expect(result.current.renameState.folderId).toBeNull();
      expect(result.current.renameState.value).toBe('');
      expect(result.current.renameState.dropdownOpen).toBe(false);
    });

    test('setRenamingFolderId updates folderId', () => {
      const { result } = renderHook(() => useFolderManager());

      act(() => {
        result.current.setRenamingFolderId('folder-1');
      });

      expect(result.current.renameState.folderId).toBe('folder-1');
    });

    test('setRenameValue updates value', () => {
      const { result } = renderHook(() => useFolderManager());

      act(() => {
        result.current.setRenameValue('new-name');
      });

      expect(result.current.renameState.value).toBe('new-name');
    });

    test('setRenameDropdownOpen updates dropdown state', () => {
      const { result } = renderHook(() => useFolderManager());

      act(() => {
        result.current.setRenameDropdownOpen(true);
      });

      expect(result.current.renameState.dropdownOpen).toBe(true);
    });

    test('toggleRenameDropdown toggles dropdown state', () => {
      const { result } = renderHook(() => useFolderManager());

      act(() => {
        result.current.toggleRenameDropdown();
      });
      expect(result.current.renameState.dropdownOpen).toBe(true);

      act(() => {
        result.current.toggleRenameDropdown();
      });
      expect(result.current.renameState.dropdownOpen).toBe(false);
    });

    test('clearRenameState resets all state', () => {
      const { result } = renderHook(() => useFolderManager());

      act(() => {
        result.current.setRenamingFolderId('folder-1');
        result.current.setRenameValue('test-name');
        result.current.setRenameDropdownOpen(true);
      });

      expect(result.current.renameState.folderId).toBe('folder-1');

      act(() => {
        result.current.clearRenameState();
      });

      expect(result.current.renameState.folderId).toBeNull();
      expect(result.current.renameState.value).toBe('');
      expect(result.current.renameState.dropdownOpen).toBe(false);
    });
  });

  describe('renameFolderCore', () => {
    test('returns error for nonexistent folder', async () => {
      const { result } = renderHook(() => useFolderManager());
      const folders = [buildFolder('folder-1', 'Existing')];

      let renameResult: { success: boolean; error?: string } | undefined;

      await act(async () => {
        renameResult = await result.current.renameFolderCore(
          '/workspace',
          'nonexistent',
          'new-name',
          folders
        );
      });

      expect(renameResult?.success).toBe(false);
      expect(renameResult?.error).toBe('Folder not found');
    });

    test('returns error for empty name', async () => {
      const { result } = renderHook(() => useFolderManager());
      const folders = [buildFolder('folder-1', 'Existing')];

      let renameResult: { success: boolean; error?: string } | undefined;

      await act(async () => {
        renameResult = await result.current.renameFolderCore('/workspace', 'folder-1', '', folders);
      });

      expect(renameResult?.success).toBe(false);
      expect(renameResult?.error).toBe('Folder name cannot be empty');
    });

    test('returns error for whitespace-only name', async () => {
      const { result } = renderHook(() => useFolderManager());
      const folders = [buildFolder('folder-1', 'Existing')];

      let renameResult: { success: boolean; error?: string } | undefined;

      await act(async () => {
        renameResult = await result.current.renameFolderCore('/workspace', 'folder-1', '   ', folders);
      });

      expect(renameResult?.success).toBe(false);
      expect(renameResult?.error).toBe('Folder name cannot be empty');
    });

    test('calls workspaceClient.renameFolder on success', async () => {
      vi.mocked(workspaceClient.renameFolder).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useFolderManager());
      const folders = [buildFolder('folder-1', 'Existing')];

      let renameResult: { success: boolean; error?: string } | undefined;

      await act(async () => {
        renameResult = await result.current.renameFolderCore('/workspace', 'folder-1', 'new-name', folders);
      });

      expect(workspaceClient.renameFolder).toHaveBeenCalledWith('/workspace', 'folder-1', 'new-name');
      expect(renameResult?.success).toBe(true);
    });

    test('trims name before renaming', async () => {
      vi.mocked(workspaceClient.renameFolder).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useFolderManager());
      const folders = [buildFolder('folder-1', 'Existing')];

      await act(async () => {
        await result.current.renameFolderCore('/workspace', 'folder-1', '  trimmed  ', folders);
      });

      expect(workspaceClient.renameFolder).toHaveBeenCalledWith('/workspace', 'folder-1', 'trimmed');
    });

    test('returns error when workspaceClient returns false', async () => {
      vi.mocked(workspaceClient.renameFolder).mockResolvedValue({ success: false });

      const { result } = renderHook(() => useFolderManager());
      const folders = [buildFolder('folder-1', 'Existing')];

      let renameResult: { success: boolean; error?: string } | undefined;

      await act(async () => {
        renameResult = await result.current.renameFolderCore('/workspace', 'folder-1', 'new-name', folders);
      });

      expect(renameResult?.success).toBe(false);
      expect(renameResult?.error).toBe('Failed to rename folder');
    });

    test('handles workspaceClient throwing an error', async () => {
      vi.mocked(workspaceClient.renameFolder).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useFolderManager());
      const folders = [buildFolder('folder-1', 'Existing')];

      let renameResult: { success: boolean; error?: string } | undefined;

      await act(async () => {
        renameResult = await result.current.renameFolderCore('/workspace', 'folder-1', 'new-name', folders);
      });

      expect(renameResult?.success).toBe(false);
      expect(renameResult?.error).toBe('Network error');
    });

    test('handles non-Error throws', async () => {
      vi.mocked(workspaceClient.renameFolder).mockRejectedValue('string error');

      const { result } = renderHook(() => useFolderManager());
      const folders = [buildFolder('folder-1', 'Existing')];

      let renameResult: { success: boolean; error?: string } | undefined;

      await act(async () => {
        renameResult = await result.current.renameFolderCore('/workspace', 'folder-1', 'new-name', folders);
      });

      expect(renameResult?.success).toBe(false);
      expect(renameResult?.error).toBe('Unknown error');
    });
  });
});
