import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Agent,
  BrowserPanel,
  Folder,
  Hero,
  SelectedEntityRef,
  TerminalPanel as TerminalPanelRecord,
  WorldEntity,
} from '../../../shared/types';
import { toWorldEntity } from '../../../shared/world';
import { workspaceClient } from '../../services/workspaceClient';
import type { FolderContext } from '../../components/hud/abilityBuilder';
import { mergeAgentSelection } from './selection';

interface UseWorkspaceSelectionStateParams {
  workspacePath: string;
  hero: Hero;
  agents: Agent[];
  folders: Folder[];
  browsers: BrowserPanel[];
  terminals: Record<string, TerminalPanelRecord>;
  terminalProcessById: Record<string, string | null>;
  renameState: { folderId: string | null };
  setRenamingFolderId: (id: string | null) => void;
  setRenameDropdownOpen: (open: boolean) => void;
  selectedEntityRef: SelectedEntityRef | null;
  setSelectedEntityRef: React.Dispatch<React.SetStateAction<SelectedEntityRef | null>>;
  selectedAgentIds: string[];
  setSelectedAgentIds: React.Dispatch<React.SetStateAction<string[]>>;
  bringBrowserToFront: (id: string) => void;
  bringTerminalToFront: (id: string) => void;
}

interface UseWorkspaceSelectionStateResult {
  selectedEntity: WorldEntity | null;
  selectedTerminalProcess: string | null;
  folderContext?: FolderContext;
  handleSelect: (id: string, type: SelectedEntityRef['type'], options?: { additive?: boolean }) => void;
  handleSelectAgents: (ids: string[], options?: { additive?: boolean }) => void;
  handleDeselect: () => void;
}

export function useWorkspaceSelectionState({
  workspacePath,
  hero,
  agents,
  folders,
  browsers,
  terminals,
  terminalProcessById,
  renameState,
  setRenamingFolderId,
  setRenameDropdownOpen,
  selectedEntityRef,
  setSelectedEntityRef,
  selectedAgentIds,
  setSelectedAgentIds,
  bringBrowserToFront,
  bringTerminalToFront,
}: UseWorkspaceSelectionStateParams): UseWorkspaceSelectionStateResult {
  const [folderGitInfo, setFolderGitInfo] = useState<{ isRepo: boolean; isWorktree: boolean } | null>(null);

  useEffect(() => {
    if (selectedEntityRef?.type !== 'folder') {
      setFolderGitInfo(null);
      return;
    }
    const folder = folders.find((f) => f.id === selectedEntityRef.id);
    if (!folder) {
      setFolderGitInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const info = await workspaceClient.probeFolderGit(workspacePath, folder.relativePath);
        if (!cancelled) setFolderGitInfo(info);
      } catch (err) {
        console.error('Failed to probe folder git info', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedEntityRef, folders, workspacePath]);

  useEffect(() => {
    if (renameState.folderId && selectedEntityRef?.id !== renameState.folderId) {
      setRenamingFolderId(null);
      setRenameDropdownOpen(false);
    }
  }, [renameState.folderId, selectedEntityRef, setRenamingFolderId, setRenameDropdownOpen]);

  const handleSelect = useCallback(
    (id: string, type: SelectedEntityRef['type'], options?: { additive?: boolean }) => {
      const additive = options?.additive ?? false;
      if (type === 'agent' && additive) {
        const existingIds =
          selectedAgentIds.length > 0
            ? selectedAgentIds
            : selectedEntityRef?.type === 'agent'
              ? [selectedEntityRef.id]
              : [];
        const next = new Set(existingIds);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        const result = Array.from(next);
        if (result.length === 0) {
          setSelectedAgentIds([]);
          setSelectedEntityRef(null);
          return;
        }
        if (result.length === 1) {
          setSelectedAgentIds([]);
          setSelectedEntityRef({ id: result[0], type: 'agent' });
          return;
        }
        setSelectedEntityRef(null);
        setSelectedAgentIds(result);
        return;
      }

      setSelectedAgentIds([]);
      setSelectedEntityRef({ id, type });
      if (type === 'browser') bringBrowserToFront(id);
      if (type === 'terminal') bringTerminalToFront(id);
    },
    [
      bringBrowserToFront,
      bringTerminalToFront,
      selectedAgentIds,
      selectedEntityRef,
      setSelectedAgentIds,
      setSelectedEntityRef,
    ]
  );

  const handleSelectAgents = useCallback(
    (ids: string[], options?: { additive?: boolean }) => {
      const existingAgents =
        selectedAgentIds.length > 0
          ? selectedAgentIds
          : selectedEntityRef?.type === 'agent'
            ? [selectedEntityRef.id]
            : [];
      const merged = mergeAgentSelection(ids, existingAgents, options?.additive ?? false);
      if (merged.length === 0) {
        setSelectedAgentIds([]);
        setSelectedEntityRef(null);
        return;
      }
      if (merged.length === 1) {
        setSelectedAgentIds([]);
        setSelectedEntityRef({ id: merged[0], type: 'agent' });
        return;
      }
      setSelectedEntityRef(null);
      setSelectedAgentIds(merged);
    },
    [selectedAgentIds, selectedEntityRef, setSelectedAgentIds, setSelectedEntityRef]
  );

  const handleDeselect = useCallback(() => {
    setSelectedEntityRef(null);
    setSelectedAgentIds([]);
    setRenamingFolderId(null);
    setRenameDropdownOpen(false);
  }, [setRenameDropdownOpen, setRenamingFolderId, setSelectedAgentIds, setSelectedEntityRef]);

  const selectedEntity = useMemo<WorldEntity | null>(() => {
    if (!selectedEntityRef) return null;
    switch (selectedEntityRef.type) {
      case 'hero':
        return toWorldEntity('hero', hero);
      case 'agent': {
        const agent = agents.find((entry) => entry.id === selectedEntityRef.id);
        return agent ? toWorldEntity('agent', agent) : null;
      }
      case 'folder': {
        const folder = folders.find((entry) => entry.id === selectedEntityRef.id);
        return folder ? toWorldEntity('folder', folder) : null;
      }
      case 'browser': {
        const browser = browsers.find((entry) => entry.id === selectedEntityRef.id);
        return browser ? toWorldEntity('browser', browser) : null;
      }
      case 'terminal': {
        const terminal = terminals[selectedEntityRef.id];
        return terminal ? toWorldEntity('terminal', terminal) : null;
      }
      default:
        return null;
    }
  }, [agents, browsers, folders, hero, selectedEntityRef, terminals]);

  const selectedTerminalProcess = useMemo(() => {
    if (selectedEntity?.type !== 'terminal') return null;
    return terminalProcessById[selectedEntity.id] ?? null;
  }, [selectedEntity, terminalProcessById]);

  const folderContext = useMemo<FolderContext | undefined>(() => {
    if (selectedEntity?.type !== 'folder') return undefined;
    return { gitInfo: folderGitInfo };
  }, [folderGitInfo, selectedEntity]);

  return {
    selectedEntity,
    selectedTerminalProcess,
    folderContext,
    handleSelect,
    handleSelectAgents,
    handleDeselect,
  };
}
