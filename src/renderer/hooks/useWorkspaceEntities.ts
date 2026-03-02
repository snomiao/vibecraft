import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Agent, AvailableFolder, BrowserPanel, Folder, Hero } from '../../shared/types';
import { workspaceClient } from '../services/workspaceClient';
import { DEFAULT_HERO } from '../../shared/heroDefaults';

interface UseWorkspaceEntitiesResult {
  hero: Hero;
  setHero: Dispatch<SetStateAction<Hero>>;
  agents: Agent[];
  setAgents: Dispatch<SetStateAction<Agent[]>>;
  folders: Folder[];
  setFolders: Dispatch<SetStateAction<Folder[]>>;
  browsers: BrowserPanel[];
  setBrowsers: Dispatch<SetStateAction<BrowserPanel[]>>;
  availableFolders: AvailableFolder[];
  refreshAvailableFolders: () => Promise<void>;
  reloadAgents: () => Promise<Agent[]>;
  reloadFolders: () => Promise<Folder[]>;
  reloadBrowsers: () => Promise<BrowserPanel[]>;
  reloadAll: () => Promise<void>;
}

export function useWorkspaceEntities(workspacePath: string): UseWorkspaceEntitiesResult {
  const [hero, setHeroState] = useState<Hero>(() => ({ ...DEFAULT_HERO }));
  const heroRevisionRef = useRef(0);
  const setHero: Dispatch<SetStateAction<Hero>> = useCallback((value) => {
    heroRevisionRef.current += 1;
    setHeroState(value);
  }, []);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [browsers, setBrowsers] = useState<BrowserPanel[]>([]);
  const [availableFolders, setAvailableFolders] = useState<AvailableFolder[]>([]);

  const refreshAvailableFolders = useCallback(async () => {
    const options = await workspaceClient.listAvailableFolders(workspacePath);
    setAvailableFolders(options);
  }, [workspacePath]);

  const reloadAgents = useCallback(async () => {
    const data = await workspaceClient.loadAgents(workspacePath);
    setAgents(data);
    return data;
  }, [workspacePath]);

  const reloadFolders = useCallback(async () => {
    const data = await workspaceClient.loadFolders(workspacePath);
    setFolders(data);
    return data;
  }, [workspacePath]);

  const reloadBrowsers = useCallback(async () => {
    const data = await workspaceClient.loadBrowserPanels(workspacePath);
    setBrowsers(data);
    return data;
  }, [workspacePath]);

  const reloadAll = useCallback(async () => {
    const profileEnabled = window.electronAPI.isProfileMode;
    const now = () => (typeof performance === 'undefined' ? Date.now() : performance.now());
    const logProfile = (label: string, elapsedMs: number) => {
      if (!profileEnabled) return;
      console.info('[profile:workspace]', label, {
        workspacePath,
        elapsedMs: Math.round(elapsedMs),
      });
    };
    const timed = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
      if (!profileEnabled) {
        return await fn();
      }
      const startedAt = now();
      const result = await fn();
      logProfile(label, now() - startedAt);
      return result;
    };
    const startedAt = now();
    const heroRevision = heroRevisionRef.current;
    const [heroData, agentData, folderData, browserData] = await Promise.all([
      timed('loadHero', () => workspaceClient.loadHero(workspacePath)),
      timed('loadAgents', () => workspaceClient.loadAgents(workspacePath)),
      timed('loadFolders', () => workspaceClient.loadFolders(workspacePath)),
      timed('loadBrowserPanels', () => workspaceClient.loadBrowserPanels(workspacePath)),
    ]);
    if (heroRevisionRef.current === heroRevision) {
      setHeroState(heroData);
    }
    setAgents(agentData);
    setFolders(folderData);
    setBrowsers(browserData);
    setAvailableFolders([]);
    if (profileEnabled) {
      logProfile('reloadAll', now() - startedAt);
    }
  }, [workspacePath]);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  useEffect(() => {
    const unsubscribe = window.electronAPI.onAgentsUpdated((payload) => {
      if (payload.workspacePath !== workspacePath) return;
      setAgents(payload.agents);
    });
    return unsubscribe;
  }, [setAgents, workspacePath]);

  return {
    hero,
    setHero,
    agents,
    setAgents,
    folders,
    setFolders,
    browsers,
    setBrowsers,
    availableFolders,
    refreshAvailableFolders,
    reloadAgents,
    reloadFolders,
    reloadBrowsers,
    reloadAll,
  };
}

export default useWorkspaceEntities;
