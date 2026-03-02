import { lazy, Profiler, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Canvas from '../../components/canvas/Canvas';
import HeroEntity from '../../components/canvas/HeroEntity';
import AgentEntity from '../../components/canvas/AgentEntity';
import FolderEntity from '../../components/canvas/FolderEntity';
import AttachmentBeams from '../../components/canvas/AttachmentBeams';
import DestinationMarker from '../../components/canvas/DestinationMarker';
import BottomBar from '../../components/hud/BottomBar';
import AgentRosterOverlay from '../../components/AgentRosterOverlay';
import MinimapOverlay from '../../components/minimap/MinimapOverlay';
import { createCameraStore, type CameraStore } from '../../components/minimap/cameraStore';
import type { CanvasCameraControls, CanvasCameraState } from '../../components/canvas/types';
import type { EntityType } from '../../../shared/types';
import type { WorkspaceController } from './useWorkspaceController';
import { resolveDragSelection, type SelectionCandidate } from './selection';
import { useAbilityHotkeys } from './hotkeys/useAbilityHotkeys';
import { useAbilityResolution } from './useAbilityResolution';
import * as WORKSPACE_CONSTANTS from './constants';
import { DEFAULT_HERO } from '../../../shared/heroDefaults';
import { setAbilityVariantSelection, useAppSettings } from '../../state/appSettingsStore';
import { DEFAULT_TUTORIAL_STATE } from '../../tutorial/constants';
import { getTutorialAbilityPolicy } from '../../tutorial/policy';
import PerformanceOverlay from './PerformanceOverlay';
import { useHeroThinking } from '../../hooks/useHeroThinking';
import {
  useAdaptivePerformanceTier,
  useFrameDiagnostics,
  useRenderDiagnostics,
} from './usePerformanceDiagnostics';

interface WorkspaceCanvasProps {
  controller: WorkspaceController;
}

const PERF_OVERLAY_STORAGE_KEY = `vibecraft:workspace-perf-overlay:${import.meta.env.DEV ? 'dev' : 'prod'}`;

const areCamerasEqual = (left: CanvasCameraState, right: CanvasCameraState): boolean =>
  left.zoom === right.zoom &&
  left.pan.x === right.pan.x &&
  left.pan.y === right.pan.y &&
  left.viewport.width === right.viewport.width &&
  left.viewport.height === right.viewport.height;

const nowMs = (): number => (typeof performance === 'undefined' ? Date.now() : performance.now());
const INITIAL_CAMERA: CanvasCameraState = {
  pan: { x: 0, y: 0 },
  zoom: 1,
  viewport: { width: 0, height: 0 },
};

const BrowserEntity = lazy(() => import('../../components/canvas/BrowserEntity'));
const TerminalEntity = lazy(() => import('../../components/canvas/TerminalEntity'));
const AgentTerminalPanel = lazy(() => import('../../components/AgentTerminalPanel'));
const GlobalChat = lazy(() => import('../../components/GlobalChat'));

export default function WorkspaceCanvas({ controller }: WorkspaceCanvasProps) {
  const {
    registerHotkeyHandler,
    workspace,
    hero,
    renderHero,
    agents,
    renderAgents,
    folders,
    browsers,
    availableFolders,
    selectedEntity,
    selectedAgentIds,
    selectedAgents,
    selectedTerminalProcess,
    folderContext,
    activeAgentTerminalId,
    terminals,
    terminalZIndices,
    folderNameById,
    browserZIndices,
    renameState,
    magnetizedFolderIds,
    tutorialMoveZone,
    tutorialMoveBounds,
    destinationMarker,
    handleSelect,
    handleSelectAgents,
    handleDeselect,
    handleAbility,
    handleHeroMove,
    handleAgentMove,
    handleAgentDragStart,
    handleAgentDragEnd,
    handleFolderMove,
    handleFolderDragEnd,
    handleBrowserMove,
    handleBrowserMoveEnd,
    handleBrowserResize,
    handleBrowserResizeEnd,
    handleBrowserUrlChange,
    handleBrowserFaviconChange,
    handleBrowserClose,
    clearBrowserRefreshToken,
    bringBrowserToFront,
    handleTutorialBrowserMessage,
    beginRename,
    handleRenameChange,
    submitRename,
    handleRenameCancel,
    toggleRenameDropdown,
    handleRenamePickOption,
    closeActiveAgentTerminal,
    closeTerminalById,
    updateTerminalRecord,
    handleTerminalMove,
    handleTerminalMoveEnd,
    handleTerminalResize,
    handleTerminalResizeEnd,
    bringTerminalToFront,
    handleTerminalProcessChange,
    handleCanvasRightClick,
    handleHeroNameCommit,
    handleSetHeroModel,
    handleAgentNameCommit,
    runCommand,
    globalChatProps,
    completedAgentIds,
  } = controller;

  const heroToRender = renderHero ?? hero ?? DEFAULT_HERO;
  const isHeroThinking = useHeroThinking();
  const agentsToRender = renderAgents;
  const activeAgent = activeAgentTerminalId
    ? agents.find((agent) => agent.id === activeAgentTerminalId)
    : undefined;
  const terminalList = useMemo(() => Object.values(terminals), [terminals]);
  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const activeAgentFolder = activeAgent?.attachedFolderId
    ? folderById.get(activeAgent.attachedFolderId)
    : undefined;
  const terminalRenderData = useMemo(
    () =>
      terminalList.map((terminal) => {
        const originFolder = terminal.originFolderId ? folderById.get(terminal.originFolderId) : undefined;
        const originName = terminal.originFolderId
          ? (originFolder?.name ?? terminal.originFolderName ?? 'Terminal')
          : (workspace.name ?? terminal.originFolderName ?? 'Terminal');
        const startPath =
          terminal.lastKnownCwd ?? originFolder?.relativePath ?? terminal.originRelativePath ?? '.';
        return {
          terminal,
          originName,
          startPath,
        };
      }),
    [folderById, terminalList, workspace.name]
  );
  const totalEntityCount = agentsToRender.length + folders.length + browsers.length + terminalList.length;
  const { settings } = useAppSettings();
  const effectiveHeroProvider = settings.heroProvider ?? hero.provider;
  const tutorialState = settings.tutorial ?? DEFAULT_TUTORIAL_STATE;
  const tutorialPolicy = getTutorialAbilityPolicy(tutorialState, effectiveHeroProvider);
  const tutorialEnabled = tutorialPolicy.enabled;

  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectionPreview, setSelectionPreview] = useState<{
    agentIds: string[];
    nonAgent: SelectionCandidate | null;
  }>({
    agentIds: [],
    nonAgent: null,
  });
  const [selectionDragging, setSelectionDragging] = useState(false);
  const selectionDraggingRef = useRef(false);
  const selectionCandidatesRef = useRef<SelectionCandidate[] | null>(null);
  const cameraStore = useMemo<CameraStore>(() => createCameraStore(INITIAL_CAMERA), []);
  const pendingCameraRef = useRef<CanvasCameraState>(cameraStore.getSnapshot());
  const cameraSyncTimeoutRef = useRef<number | null>(null);
  const lastCameraSyncAtRef = useRef(0);
  const [cameraControls, setCameraControls] = useState<CanvasCameraControls | null>(null);
  const passThroughTimeoutRef = useRef<number | null>(null);
  const panningRef = useRef(false);
  const wheelPassThroughRef = useRef(false);
  const overlayPassThroughEnabledRef = useRef(false);
  const [overlayPassThroughEnabled, setOverlayPassThroughEnabled] = useState(false);
  const TRACKPAD_PASS_THROUGH_RELEASE_MS = 500;
  const [panOptimizing, setPanOptimizing] = useState(false);
  const [abilityTriggerPress, setAbilityTriggerPress] = useState<{ index: number; key: number } | null>(null);
  const triggerKeyRef = useRef(0);
  const [performanceOverlayVisible, setPerformanceOverlayVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (window.electronAPI?.isProfileMode) return true;
    try {
      const persisted = window.localStorage.getItem(PERF_OVERLAY_STORAGE_KEY);
      if (persisted === '1') return true;
      if (persisted === '0') return false;
      return import.meta.env.DEV;
    } catch {
      return import.meta.env.DEV;
    }
  });
  const diagnosticsEnabled =
    window.electronAPI.isProfileMode ||
    (!window.electronAPI.isTestMode &&
      (performanceOverlayVisible ||
        totalEntityCount >= WORKSPACE_CONSTANTS.PERF_DIAGNOSTICS_ENTITY_THRESHOLD));
  const frameDiagnostics = useFrameDiagnostics({ enabled: diagnosticsEnabled });
  const performanceTier = useAdaptivePerformanceTier({
    enabled: diagnosticsEnabled,
    frame: frameDiagnostics,
  });
  const reducedEffects = performanceTier === 'reduced';
  const { snapshot: renderDiagnostics, onRender: handleSceneRender } = useRenderDiagnostics({
    enabled: performanceOverlayVisible,
  });
  const cameraSyncMinIntervalMs =
    totalEntityCount >= WORKSPACE_CONSTANTS.CAMERA_HIGH_ENTITY_THRESHOLD
      ? WORKSPACE_CONSTANTS.CAMERA_SYNC_INTERVAL_HIGH_ENTITY_MS
      : WORKSPACE_CONSTANTS.CAMERA_SYNC_INTERVAL_DEFAULT_MS;
  const commitPendingCamera = useCallback(() => {
    const nextCamera = pendingCameraRef.current;
    const previous = cameraStore.getSnapshot();
    if (areCamerasEqual(previous, nextCamera)) return;
    cameraStore.setSnapshot(nextCamera);
  }, [cameraStore]);

  const handleCameraChange = useCallback(
    (nextCamera: CanvasCameraState) => {
      pendingCameraRef.current = nextCamera;
      const now = nowMs();
      const elapsed = now - lastCameraSyncAtRef.current;
      if (elapsed >= cameraSyncMinIntervalMs && cameraSyncTimeoutRef.current === null) {
        lastCameraSyncAtRef.current = now;
        commitPendingCamera();
        return;
      }

      if (typeof window === 'undefined') {
        lastCameraSyncAtRef.current = now;
        commitPendingCamera();
        return;
      }

      if (cameraSyncTimeoutRef.current !== null) return;
      const delay = Math.max(0, cameraSyncMinIntervalMs - elapsed);
      cameraSyncTimeoutRef.current = window.setTimeout(() => {
        cameraSyncTimeoutRef.current = null;
        lastCameraSyncAtRef.current = nowMs();
        commitPendingCamera();
      }, delay);
    },
    [cameraSyncMinIntervalMs, commitPendingCamera]
  );

  const handleAbilityPress = useCallback((index: number) => {
    triggerKeyRef.current += 1;
    setAbilityTriggerPress({ index, key: triggerKeyRef.current });
  }, []);
  const handleAbilityTrigger = useCallback(
    (ability: Parameters<typeof handleAbility>[0]) => {
      void handleAbility(ability);
    },
    [handleAbility]
  );

  const abilityResolution = useAbilityResolution({
    selectedEntity,
    selectedAgents,
    ctx: folderContext,
    activeAgentTerminalId,
  });

  const allowedAbilities = tutorialPolicy.allowedAbilities;
  const browserCreationBlocked = tutorialPolicy.browserCreationBlocked;
  useEffect(() => {
    if (!tutorialEnabled) return;
    if (
      ![
        'create-agent',
        'attach-agent',
        'open-global-chat',
        'send-prompt',
        'close-terminal',
        'create-project-2',
        'rename-project-2',
        'create-agent-2',
        'attach-agent-2',
        'open-global-chat-2',
        'send-prompt-2',
        'open-browser-1',
        'open-browser-2',
      ].includes(tutorialState.stepId)
    ) {
      return;
    }
    const provider =
      effectiveHeroProvider === 'codex'
        ? 'create-agent-codex'
        : effectiveHeroProvider === 'claude'
          ? 'create-agent-claude'
          : null;
    if (!provider) return;
    setAbilityVariantSelection('create-agent-claude', provider);
  }, [effectiveHeroProvider, tutorialEnabled, tutorialState.stepId]);
  const visibleGlobalAbilities =
    tutorialEnabled && abilityResolution.isGlobal ? tutorialPolicy.visibleGlobalAbilities : null;
  const abilities = (() => {
    const isAllowed = (ability: (typeof abilityResolution.abilities)[number]) => {
      if (!allowedAbilities) return true;
      if (browserCreationBlocked && ability.id === 'create-browser') return false;
      if (allowedAbilities.includes(ability.id)) return true;
      if (!ability.variants) return false;
      return ability.variants.some((variant) => allowedAbilities.includes(variant.id));
    };
    let next = abilityResolution.abilities;
    if (visibleGlobalAbilities) {
      next = next.filter((ability) => visibleGlobalAbilities.includes(ability.id));
    }
    if (tutorialEnabled && allowedAbilities) {
      if (allowedAbilities.length === 0) {
        return [];
      }
      next = next.map((ability) => ({
        ...ability,
        disabled: ability.disabled || !isAllowed(ability),
      }));
    }
    return next;
  })();
  const hotkeyMode = abilityResolution.hotkeyMode;
  const tutorialAbilityResolution = useMemo(
    () => ({ ...abilityResolution, abilities }),
    [abilityResolution, abilities]
  );

  useAbilityHotkeys({
    registerHotkeyHandler,
    abilities,
    hotkeyMode,
    onAbility: handleAbilityTrigger,
    onAbilityPress: handleAbilityPress,
  });

  const setOverlayPassThrough = useCallback(
    (enabled: boolean) => {
      if (overlayPassThroughEnabledRef.current === enabled) return;
      overlayPassThroughEnabledRef.current = enabled;
      setOverlayPassThroughEnabled(enabled);
    },
    [setOverlayPassThroughEnabled]
  );

  const schedulePassThroughRelease = useCallback(() => {
    if (passThroughTimeoutRef.current) {
      window.clearTimeout(passThroughTimeoutRef.current);
    }
    passThroughTimeoutRef.current = window.setTimeout(() => {
      wheelPassThroughRef.current = false;
      if (!selectionDraggingRef.current && !panningRef.current) {
        setOverlayPassThrough(false);
        setPanOptimizing(false);
      }
      passThroughTimeoutRef.current = null;
    }, TRACKPAD_PASS_THROUGH_RELEASE_MS);
  }, [setOverlayPassThrough, setPanOptimizing]);

  const handleWheelPanActivity = useCallback(() => {
    wheelPassThroughRef.current = true;
    setOverlayPassThrough(true);
    setPanOptimizing(true);
    schedulePassThroughRelease();
  }, [schedulePassThroughRelease, setOverlayPassThrough, setPanOptimizing]);

  const handlePanStart = useCallback(() => {
    panningRef.current = true;
    if (passThroughTimeoutRef.current) {
      window.clearTimeout(passThroughTimeoutRef.current);
      passThroughTimeoutRef.current = null;
    }
    wheelPassThroughRef.current = false;
    setOverlayPassThrough(true);
    setPanOptimizing(true);
  }, [setOverlayPassThrough, setPanOptimizing]);

  const handlePanEnd = useCallback(() => {
    panningRef.current = false;
    if (!selectionDraggingRef.current && !wheelPassThroughRef.current) {
      setOverlayPassThrough(false);
      setPanOptimizing(false);
    }
  }, [setOverlayPassThrough, setPanOptimizing]);

  useEffect(() => {
    selectionDraggingRef.current = selectionDragging;
  }, [selectionDragging]);

  useEffect(() => {
    return () => {
      if (passThroughTimeoutRef.current) {
        window.clearTimeout(passThroughTimeoutRef.current);
        passThroughTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (cameraSyncTimeoutRef.current !== null) {
        window.clearTimeout(cameraSyncTimeoutRef.current);
        cameraSyncTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (cameraSyncTimeoutRef.current !== null) {
      window.clearTimeout(cameraSyncTimeoutRef.current);
      cameraSyncTimeoutRef.current = null;
      commitPendingCamera();
    }
    lastCameraSyncAtRef.current = 0;
  }, [cameraSyncMinIntervalMs, commitPendingCamera]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(PERF_OVERLAY_STORAGE_KEY, performanceOverlayVisible ? '1' : '0');
    } catch {
      return;
    }
  }, [performanceOverlayVisible]);

  useEffect(() => {
    if (window.electronAPI.isTestMode) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key !== 'f3') return;
      event.preventDefault();
      setPerformanceOverlayVisible((current) => !current);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const selectedAgentIdSet = useMemo(() => new Set(selectedAgentIds), [selectedAgentIds]);
  const previewAgentIdSet = useMemo(() => new Set(selectionPreview.agentIds), [selectionPreview.agentIds]);

  const collectSelectionCandidates = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return [];
    const elements = Array.from(canvas.querySelectorAll<HTMLElement>('[data-entity-type]'));
    return elements
      .map((element, index) => {
        const type = element.dataset.entityType as EntityType | undefined;
        const id = element.dataset.entityId;
        if (!type || !id) return null;
        const rect = element.getBoundingClientRect();
        const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        const zIndexValue = Number.parseInt(element.dataset.entityZ ?? '', 10);
        const zIndex = Number.isNaN(zIndexValue) ? 0 : zIndexValue;
        return { id, type, center, zIndex, order: index };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  }, []);

  const handleSelectionUpdate = useCallback(
    (payload: {
      rect: { left: number; right: number; top: number; bottom: number };
      dragStart: { x: number; y: number };
    }) => {
      const candidates = selectionCandidatesRef.current ?? collectSelectionCandidates();
      const result = resolveDragSelection(candidates, payload.rect, payload.dragStart);
      setSelectionPreview({
        agentIds: result.agentIds,
        nonAgent: result.nonAgent,
      });
    },
    [collectSelectionCandidates, setSelectionPreview]
  );

  const handleSelectionEnd = useCallback(
    (payload: {
      rect: { left: number; right: number; top: number; bottom: number };
      dragStart: { x: number; y: number };
      additive: boolean;
    }) => {
      setSelectionDragging(false);
      selectionDraggingRef.current = false;
      if (!panningRef.current && !wheelPassThroughRef.current) {
        setOverlayPassThrough(false);
        setPanOptimizing(false);
      }
      const candidates = selectionCandidatesRef.current ?? collectSelectionCandidates();
      selectionCandidatesRef.current = null;
      const result = resolveDragSelection(candidates, payload.rect, payload.dragStart);
      setSelectionPreview({ agentIds: [], nonAgent: null });
      if (result.agentIds.length > 0) {
        handleSelectAgents(result.agentIds, { additive: payload.additive });
        return;
      }
      if (result.nonAgent) {
        handleSelect(result.nonAgent.id, result.nonAgent.type);
        return;
      }
      handleDeselect();
    },
    [
      collectSelectionCandidates,
      handleDeselect,
      handleSelect,
      handleSelectAgents,
      setOverlayPassThrough,
      setPanOptimizing,
      setSelectionDragging,
      setSelectionPreview,
    ]
  );

  const handleMinimapRecenter = useCallback(
    (point: { x: number; y: number }) => {
      cameraControls?.setCameraCenter(point);
    },
    [cameraControls]
  );
  useEffect(() => {
    const cleanup = window.electronAPI.onAgentNotificationClick((payload) => {
      if (payload.workspacePath !== workspace.path) return;
      const agent = agents.find((entry) => entry.id === payload.agentId);
      if (!agent || !cameraControls) return;
      handleSelect(agent.id, 'agent');
      cameraControls.setCameraCenter({ x: agent.x, y: agent.y });
    });
    return () => {
      cleanup();
    };
  }, [agents, cameraControls, handleSelect, workspace.path]);

  const entityCounts = useMemo(
    () => ({
      agents: agentsToRender.length,
      folders: folders.length,
      browsers: browsers.length,
      terminals: terminalList.length,
    }),
    [agentsToRender.length, browsers.length, folders.length, terminalList.length]
  );

  const sceneContent = useMemo(
    () => (
      <>
        {tutorialMoveZone && (
          <div
            className="tutorial-move-zone"
            style={{
              left: tutorialMoveZone.x,
              top: tutorialMoveZone.y,
              width: tutorialMoveZone.width,
              height: tutorialMoveZone.height,
            }}
            data-tutorial-target="tutorial-move-zone"
            aria-hidden="true"
          />
        )}
        {tutorialMoveBounds && (
          <div
            className="tutorial-move-bounds"
            style={{
              left: tutorialMoveBounds.x,
              top: tutorialMoveBounds.y,
              width: tutorialMoveBounds.width,
              height: tutorialMoveBounds.height,
            }}
            data-tutorial-target="tutorial-move-bounds"
            aria-hidden="true"
          />
        )}
        <AttachmentBeams agents={agentsToRender} folders={folders} />
        {destinationMarker && <DestinationMarker x={destinationMarker.x} y={destinationMarker.y} />}
        <HeroEntity
          hero={heroToRender}
          selected={selectedEntity?.type === 'hero'}
          previewed={selectionPreview.nonAgent?.type === 'hero'}
          thinking={isHeroThinking}
          onSelect={() => handleSelect('hero', 'hero')}
          onMove={handleHeroMove}
        />

        {folders.map((folder) => (
          <FolderEntity
            key={folder.id}
            folder={folder}
            selected={selectedEntity?.type === 'folder' && selectedEntity.id === folder.id}
            previewed={
              selectionPreview.nonAgent?.type === 'folder' && selectionPreview.nonAgent.id === folder.id
            }
            onSelect={() => handleSelect(folder.id, 'folder')}
            onMove={(x, y) => handleFolderMove(folder.id, x, y)}
            onDragEnd={() => handleFolderDragEnd(folder.id)}
            magnetized={magnetizedFolderIds.includes(folder.id)}
            onNameClick={() => {
              beginRename(folder);
            }}
            renaming={renameState.folderId === folder.id}
            renameValue={renameState.folderId === folder.id ? renameState.value : undefined}
            renameOptions={availableFolders}
            renameDropdownOpen={renameState.folderId === folder.id ? renameState.dropdownOpen : false}
            onRenameChange={(value) => {
              handleRenameChange(folder.id, value);
            }}
            onRenameSubmit={() => submitRename(renameState.value)}
            onRenameCancel={handleRenameCancel}
            onToggleDropdown={toggleRenameDropdown}
            onPickOption={handleRenamePickOption}
          />
        ))}

        {agentsToRender.map((agent) => (
          <AgentEntity
            key={agent.id}
            agent={agent}
            selected={
              selectedEntity?.type === 'agent'
                ? selectedEntity.id === agent.id
                : selectedAgentIdSet.has(agent.id)
            }
            previewed={previewAgentIdSet.has(agent.id)}
            reduceEffects={reducedEffects}
            onSelect={(event) =>
              handleSelect(agent.id, 'agent', { additive: event?.metaKey || event?.ctrlKey })
            }
            onMove={(x, y) => handleAgentMove(agent.id, x, y)}
            onDragStart={() => handleAgentDragStart(agent.id)}
            onDragEnd={(data) => handleAgentDragEnd(agent.id, data)}
            isTerminalOpen={activeAgentTerminalId === agent.id}
            showCompletionBadge={completedAgentIds.has(agent.id)}
          />
        ))}

        {browsers.length > 0 && (
          <Suspense fallback={null}>
            {browsers.map((browser) => (
              <BrowserEntity
                key={browser.id}
                panel={browser}
                selected={selectedEntity?.type === 'browser' && selectedEntity.id === browser.id}
                previewed={
                  selectionPreview.nonAgent?.type === 'browser' && selectionPreview.nonAgent.id === browser.id
                }
                dragSelecting={selectionDragging}
                zIndex={browserZIndices[browser.id] || 2000}
                onSelect={() => handleSelect(browser.id, 'browser')}
                onMove={(x, y) => handleBrowserMove(browser.id, x, y)}
                onMoveEnd={(x, y) => handleBrowserMoveEnd(browser.id, x, y)}
                onUrlChange={(url) => handleBrowserUrlChange(browser.id, url)}
                onFaviconChange={(faviconUrl) => handleBrowserFaviconChange(browser.id, faviconUrl)}
                onClose={() => handleBrowserClose(browser.id)}
                onResize={(width, height) => handleBrowserResize(browser.id, width, height)}
                onResizeEnd={(width, height) => handleBrowserResizeEnd(browser.id, width, height)}
                onBringToFront={() => bringBrowserToFront(browser.id)}
                onRefreshHandled={clearBrowserRefreshToken}
                onTutorialMessage={handleTutorialBrowserMessage}
              />
            ))}
          </Suspense>
        )}

        {terminalRenderData.length > 0 && (
          <Suspense fallback={null}>
            {terminalRenderData.map(({ terminal, originName, startPath }) => {
              return (
                <TerminalEntity
                  key={terminal.id}
                  terminalId={terminal.id}
                  workspacePath={workspace.path}
                  originName={originName}
                  startPath={startPath}
                  x={terminal.x}
                  y={terminal.y}
                  width={terminal.width}
                  height={terminal.height}
                  zIndex={terminalZIndices[terminal.id] || 2000}
                  onClose={() => void closeTerminalById(terminal.id)}
                  onMove={(x, y) => handleTerminalMove(terminal.id, x, y)}
                  onMoveEnd={(x, y) => handleTerminalMoveEnd(terminal.id, x, y)}
                  onResize={(width, height) => handleTerminalResize(terminal.id, width, height)}
                  onResizeEnd={(width, height) => handleTerminalResizeEnd(terminal.id, width, height)}
                  onBringToFront={() => {
                    bringTerminalToFront(terminal.id);
                    updateTerminalRecord(terminal.id, { lastUsedAt: Date.now() });
                  }}
                  onSelect={() => handleSelect(terminal.id, 'terminal')}
                  selected={selectedEntity?.type === 'terminal' && selectedEntity.id === terminal.id}
                  previewed={
                    selectionPreview.nonAgent?.type === 'terminal' &&
                    selectionPreview.nonAgent.id === terminal.id
                  }
                  dragSelecting={selectionDragging}
                  onProcessChange={(processLabel) => handleTerminalProcessChange(terminal.id, processLabel)}
                />
              );
            })}
          </Suspense>
        )}
      </>
    ),
    [
      tutorialMoveZone,
      tutorialMoveBounds,
      agentsToRender,
      folders,
      destinationMarker,
      heroToRender,
      isHeroThinking,
      selectedEntity,
      selectionPreview,
      handleSelect,
      handleHeroMove,
      handleFolderMove,
      handleFolderDragEnd,
      magnetizedFolderIds,
      beginRename,
      renameState,
      availableFolders,
      handleRenameChange,
      submitRename,
      handleRenameCancel,
      toggleRenameDropdown,
      handleRenamePickOption,
      selectedAgentIdSet,
      previewAgentIdSet,
      reducedEffects,
      handleAgentMove,
      handleAgentDragStart,
      handleAgentDragEnd,
      activeAgentTerminalId,
      completedAgentIds,
      browsers,
      selectionDragging,
      browserZIndices,
      handleBrowserMove,
      handleBrowserMoveEnd,
      handleBrowserUrlChange,
      handleBrowserFaviconChange,
      handleBrowserClose,
      handleBrowserResize,
      handleBrowserResizeEnd,
      bringBrowserToFront,
      clearBrowserRefreshToken,
      handleTutorialBrowserMessage,
      terminalRenderData,
      workspace.path,
      terminalZIndices,
      closeTerminalById,
      handleTerminalMove,
      handleTerminalMoveEnd,
      handleTerminalResize,
      handleTerminalResizeEnd,
      bringTerminalToFront,
      updateTerminalRecord,
      handleTerminalProcessChange,
    ]
  );

  const canvasChildren = performanceOverlayVisible ? (
    <Profiler id="workspace-scene" onRender={handleSceneRender}>
      {sceneContent}
    </Profiler>
  ) : (
    sceneContent
  );

  useEffect(() => {
    const target = window as Window & {
      __vibecraftPerformance?: {
        getSnapshot: () => {
          workspacePath: string;
          performanceTier: string;
          frame: ReturnType<typeof useFrameDiagnostics>;
          render: ReturnType<typeof useRenderDiagnostics>['snapshot'];
          entityCounts: typeof entityCounts;
          capturedAt: number;
        };
      };
    };

    const diagnosticsHandle = {
      getSnapshot: () => ({
        workspacePath: workspace.path,
        performanceTier,
        frame: frameDiagnostics,
        render: renderDiagnostics,
        entityCounts,
        capturedAt: Date.now(),
      }),
    };

    target.__vibecraftPerformance = diagnosticsHandle;
    return () => {
      if (target.__vibecraftPerformance === diagnosticsHandle) {
        delete target.__vibecraftPerformance;
      }
    };
  }, [entityCounts, frameDiagnostics, performanceTier, renderDiagnostics, workspace.path]);

  return (
    <div className="workspace-main">
      <div className="workspace-canvas-container">
        <div
          className={`workspace-canvas-stage${reducedEffects ? ' perf-reduced' : ''}${panOptimizing ? ' pan-optimizing' : ''}${overlayPassThroughEnabled ? ' pass-through-active' : ''}`}
        >
          <AgentRosterOverlay
            agents={agents}
            selectedId={selectedEntity?.type === 'agent' ? selectedEntity.id : null}
            onSelect={(id) => handleSelect(id, 'agent')}
            folderNameById={folderNameById}
            completedAgentIds={completedAgentIds}
          />
          <Canvas
            ref={canvasRef}
            onClickEmpty={handleDeselect}
            onRightClick={handleCanvasRightClick}
            onCameraChange={handleCameraChange}
            onCameraControlsReady={setCameraControls}
            onPanStart={handlePanStart}
            onPanEnd={handlePanEnd}
            onSelectionStart={() => {
              setSelectionPreview({ agentIds: [], nonAgent: null });
              setSelectionDragging(true);
              selectionDraggingRef.current = true;
              selectionCandidatesRef.current = collectSelectionCandidates();
              if (passThroughTimeoutRef.current) {
                window.clearTimeout(passThroughTimeoutRef.current);
                passThroughTimeoutRef.current = null;
              }
              wheelPassThroughRef.current = false;
              setOverlayPassThrough(true);
            }}
            onSelectionUpdate={handleSelectionUpdate}
            onSelectionEnd={handleSelectionEnd}
            onSelectionCancel={() => {
              setSelectionDragging(false);
              selectionDraggingRef.current = false;
              selectionCandidatesRef.current = null;
              if (!panningRef.current && !wheelPassThroughRef.current) {
                setOverlayPassThrough(false);
                setPanOptimizing(false);
              }
            }}
            onWheelPanActivity={handleWheelPanActivity}
            selectionDragThresholdPx={WORKSPACE_CONSTANTS.SELECTION_DRAG_THRESHOLD_PX}
          >
            {canvasChildren}
          </Canvas>
          <MinimapOverlay
            hero={heroToRender}
            agents={agentsToRender}
            folders={folders}
            browsers={browsers}
            terminals={terminalList}
            cameraStore={cameraStore}
            onRecenter={handleMinimapRecenter}
          />
          <PerformanceOverlay
            visible={performanceOverlayVisible}
            frame={frameDiagnostics}
            render={renderDiagnostics}
            tier={performanceTier}
            entityCounts={entityCounts}
          />
          {activeAgentTerminalId && (
            <Suspense fallback={null}>
              <AgentTerminalPanel
                key={activeAgentTerminalId}
                agentId={activeAgentTerminalId}
                agentName={activeAgent?.displayName ?? activeAgentTerminalId}
                agentProvider={activeAgent?.provider ?? 'claude'}
                agentModel={activeAgent?.model ?? ''}
                agentReasoningEffort={activeAgent?.reasoningEffort ?? null}
                agentSummary={activeAgent?.summary ?? null}
                agentPresenceStatus={activeAgent?.status ?? 'offline'}
                agentContextLeft={activeAgent?.contextLeft}
                agentContextWindow={activeAgent?.contextWindow}
                agentTotalTokensUsed={activeAgent?.totalTokensUsed}
                workspacePath={workspace.path}
                attachedRelativePath={activeAgentFolder?.relativePath}
                runCommand={runCommand}
                onClose={closeActiveAgentTerminal}
              />
            </Suspense>
          )}
          <BottomBar
            selectedEntity={selectedEntity}
            selectedAgents={selectedAgents}
            onSelectAgent={(agentId) => handleSelect(agentId, 'agent')}
            terminalProcess={selectedTerminalProcess}
            onHeroNameCommit={handleHeroNameCommit}
            onHeroModelCommit={handleSetHeroModel}
            onAgentNameCommit={handleAgentNameCommit}
            onAbility={handleAbilityTrigger}
            abilityResolution={tutorialAbilityResolution}
            triggerPress={abilityTriggerPress}
          />
        </div>

        <Suspense fallback={null}>
          <GlobalChat {...globalChatProps} />
        </Suspense>
      </div>
    </div>
  );
}
