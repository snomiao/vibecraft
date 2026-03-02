import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Agent, BrowserPanel, Folder, Hero, TerminalPanel } from '../../../shared/types';
import { AGENT_TOKEN_SIZE_PX, HERO_TOKEN_SIZE_PX } from '../../screens/workspace/constants';
import { entityIcons } from '../../assets/icons';
import { getProviderIconUrl } from '../../utils/providerIcons';
import {
  computeMinimapBounds,
  getVisibleWorldRect,
  minimapPercentToWorld,
  MINIMAP_MIN_SIZE,
  worldPointToMinimapPercent,
  worldRectToMinimapPercent,
  type MinimapPercentRect,
  type WorldRect,
} from './minimapMath';
import type { CameraStore } from './cameraStore';

const FOLDER_MINIMAP_SIZE = { width: 80, height: 80 };

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const clampRectToPercentBounds = (rect: MinimapPercentRect): MinimapPercentRect => {
  const minX = clamp(rect.x, 0, 100);
  const minY = clamp(rect.y, 0, 100);
  const maxX = clamp(rect.x + rect.width, 0, 100);
  const maxY = clamp(rect.y + rect.height, 0, 100);
  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
  };
};

const buildPanelRect = (panel: { x: number; y: number; width: number; height: number }): WorldRect => ({
  x: panel.x,
  y: panel.y,
  width: panel.width,
  height: panel.height,
});

const buildFolderRect = (folder: Folder): WorldRect => ({
  x: folder.x,
  y: folder.y,
  width: FOLDER_MINIMAP_SIZE.width,
  height: FOLDER_MINIMAP_SIZE.height,
});

interface MinimapOverlayProps {
  hero: Hero;
  agents: Agent[];
  folders: Folder[];
  browsers: BrowserPanel[];
  terminals: TerminalPanel[];
  cameraStore: CameraStore;
  onRecenter?: (point: { x: number; y: number }) => void;
}

type MinimapAgentPoint = {
  agent: Agent;
  point: { x: number; y: number };
};

type MinimapFolderRect = {
  folder: Folder;
  rect: MinimapPercentRect;
};

type MinimapBrowserRect = {
  browser: BrowserPanel;
  rect: MinimapPercentRect;
};

type MinimapTerminalRect = {
  terminal: TerminalPanel;
  rect: MinimapPercentRect;
};

const MinimapViewportLayer = memo(function MinimapViewportLayer({
  viewportPercent,
  viewportOutside,
  arrowPosition,
  arrowRotation,
}: {
  viewportPercent: MinimapPercentRect;
  viewportOutside: boolean;
  arrowPosition: { x: number; y: number };
  arrowRotation: number;
}) {
  return (
    <>
      <div
        className="minimap-viewport"
        data-testid="minimap-viewport"
        style={{
          left: `${viewportPercent.x}%`,
          top: `${viewportPercent.y}%`,
          width: `${viewportPercent.width}%`,
          height: `${viewportPercent.height}%`,
        }}
      />

      {viewportOutside && (
        <div
          className="minimap-camera-arrow"
          data-testid="minimap-camera-arrow"
          style={{
            left: `${arrowPosition.x}%`,
            top: `${arrowPosition.y}%`,
            transform: `translate(-50%, -50%) rotate(${arrowRotation}deg)`,
          }}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 2l6 12-6-3-6 3z" />
          </svg>
        </div>
      )}
    </>
  );
});

const MinimapStaticLayer = memo(function MinimapStaticLayer({
  heroPoint,
  agentPoints,
  folderRects,
  browserRects,
  terminalRects,
}: {
  heroPoint: { x: number; y: number };
  agentPoints: MinimapAgentPoint[];
  folderRects: MinimapFolderRect[];
  browserRects: MinimapBrowserRect[];
  terminalRects: MinimapTerminalRect[];
}) {
  return (
    <>
      <div
        className="minimap-unit minimap-hero"
        data-testid="minimap-hero"
        style={{ left: `${heroPoint.x}%`, top: `${heroPoint.y}%` }}
      >
        <img
          className="minimap-unit-icon minimap-hero-icon"
          src={entityIcons.hero}
          alt=""
          aria-hidden="true"
        />
      </div>

      {agentPoints.map(({ agent, point }) => (
        <div
          key={agent.id}
          className="minimap-unit minimap-agent"
          data-testid={`minimap-agent-${agent.id}`}
          style={
            {
              left: `${point.x}%`,
              top: `${point.y}%`,
              '--agent-color': agent.color,
            } as React.CSSProperties
          }
          title={agent.displayName}
        >
          <img
            className="minimap-unit-icon minimap-agent-icon"
            src={getProviderIconUrl(agent.provider)}
            alt=""
            aria-hidden="true"
          />
        </div>
      ))}

      {folderRects.map(({ folder, rect }) => (
        <div
          key={folder.id}
          className={`minimap-building minimap-folder ${folder.isWorktree ? 'worktree' : ''} ${
            folder.conflictState ? 'conflict' : ''
          }`.trim()}
          data-testid={`minimap-folder-${folder.id}`}
          style={{
            left: `${rect.x}%`,
            top: `${rect.y}%`,
            width: `${rect.width}%`,
            height: `${rect.height}%`,
          }}
        >
          <img
            className="minimap-folder-icon"
            src={folder.isWorktree ? entityIcons.folderWorktree : entityIcons.folder}
            alt=""
            aria-hidden="true"
          />
        </div>
      ))}

      {browserRects.map(({ browser, rect }) => (
        <div
          key={browser.id}
          className="minimap-building minimap-panel minimap-browser"
          data-testid={`minimap-panel-browser-${browser.id}`}
          style={{
            left: `${rect.x}%`,
            top: `${rect.y}%`,
            width: `${rect.width}%`,
            height: `${rect.height}%`,
          }}
        >
          <img
            className="minimap-panel-icon"
            src={browser.faviconUrl ?? entityIcons.browser}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            onError={(event) => {
              const target = event.currentTarget;
              if (target.src !== entityIcons.browser) {
                target.src = entityIcons.browser;
              }
            }}
          />
        </div>
      ))}

      {terminalRects.map(({ terminal, rect }) => (
        <div
          key={terminal.id}
          className="minimap-building minimap-panel minimap-terminal"
          data-testid={`minimap-panel-terminal-${terminal.id}`}
          style={{
            left: `${rect.x}%`,
            top: `${rect.y}%`,
            width: `${rect.width}%`,
            height: `${rect.height}%`,
          }}
        >
          <span className="minimap-panel-label">&gt;_</span>
        </div>
      ))}
    </>
  );
});

function MinimapOverlay({
  hero,
  agents,
  folders,
  browsers,
  terminals,
  cameraStore,
  onRecenter,
}: MinimapOverlayProps) {
  const camera = useSyncExternalStore(
    cameraStore.subscribe,
    cameraStore.getSnapshot,
    cameraStore.getSnapshot
  );

  const folderWorldRects = useMemo(
    () =>
      folders.map((folder) => ({
        folder,
        worldRect: buildFolderRect(folder),
      })),
    [folders]
  );

  const browserWorldRects = useMemo(
    () =>
      browsers.map((browser) => ({
        browser,
        worldRect: buildPanelRect(browser),
      })),
    [browsers]
  );

  const terminalWorldRects = useMemo(
    () =>
      terminals.map((terminal) => ({
        terminal,
        worldRect: buildPanelRect(terminal),
      })),
    [terminals]
  );

  const buildingRects = useMemo(
    () => [
      ...folderWorldRects.map((entry) => entry.worldRect),
      ...browserWorldRects.map((entry) => entry.worldRect),
      ...terminalWorldRects.map((entry) => entry.worldRect),
    ],
    [browserWorldRects, folderWorldRects, terminalWorldRects]
  );

  const unitPoints = useMemo(
    () => [
      { x: hero.x + HERO_TOKEN_SIZE_PX / 2, y: hero.y + HERO_TOKEN_SIZE_PX / 2 },
      ...agents.map((agent) => ({
        x: agent.x + AGENT_TOKEN_SIZE_PX / 2,
        y: agent.y + AGENT_TOKEN_SIZE_PX / 2,
      })),
    ],
    [agents, hero.x, hero.y]
  );

  const minSize = useMemo(() => {
    const width = Math.max(1, camera.viewport.width);
    const height = Math.max(1, camera.viewport.height);
    if (width <= 1 || height <= 1) {
      return MINIMAP_MIN_SIZE;
    }
    return { width, height };
  }, [camera.viewport.height, camera.viewport.width]);

  const bounds = useMemo(
    () =>
      computeMinimapBounds({
        buildingRects,
        unitPoints,
        minSize,
      }),
    [buildingRects, minSize, unitPoints]
  );

  const heroPoint = useMemo(
    () =>
      worldPointToMinimapPercent(
        { x: hero.x + HERO_TOKEN_SIZE_PX / 2, y: hero.y + HERO_TOKEN_SIZE_PX / 2 },
        bounds
      ),
    [bounds, hero.x, hero.y]
  );
  const agentPoints = useMemo(
    () =>
      agents.map((agent) => ({
        agent,
        point: worldPointToMinimapPercent(
          { x: agent.x + AGENT_TOKEN_SIZE_PX / 2, y: agent.y + AGENT_TOKEN_SIZE_PX / 2 },
          bounds
        ),
      })),
    [agents, bounds]
  );

  const folderRects = useMemo(
    () =>
      folderWorldRects.map(({ folder, worldRect }) => ({
        folder,
        rect: clampRectToPercentBounds(worldRectToMinimapPercent(worldRect, bounds, false)),
      })),
    [bounds, folderWorldRects]
  );

  const browserRects = useMemo(
    () =>
      browserWorldRects.map(({ browser, worldRect }) => ({
        browser,
        rect: clampRectToPercentBounds(worldRectToMinimapPercent(worldRect, bounds, false)),
      })),
    [bounds, browserWorldRects]
  );

  const terminalRects = useMemo(
    () =>
      terminalWorldRects.map(({ terminal, worldRect }) => ({
        terminal,
        rect: clampRectToPercentBounds(worldRectToMinimapPercent(worldRect, bounds, false)),
      })),
    [bounds, terminalWorldRects]
  );

  const viewportPercent = useMemo(
    () => worldRectToMinimapPercent(getVisibleWorldRect(camera), bounds, false),
    [bounds, camera]
  );

  const viewportCenter = useMemo(
    () => ({
      x: viewportPercent.x + viewportPercent.width / 2,
      y: viewportPercent.y + viewportPercent.height / 2,
    }),
    [viewportPercent]
  );

  const viewportOutside = useMemo(
    () =>
      viewportPercent.x + viewportPercent.width < 0 ||
      viewportPercent.x > 100 ||
      viewportPercent.y + viewportPercent.height < 0 ||
      viewportPercent.y > 100,
    [viewportPercent]
  );

  const arrowPosition = useMemo(
    () => ({
      x: clamp(viewportCenter.x, 8, 92),
      y: clamp(viewportCenter.y, 8, 92),
    }),
    [viewportCenter.x, viewportCenter.y]
  );

  const arrowRotation = useMemo(
    () => Math.atan2(viewportCenter.y - 50, viewportCenter.x - 50) * (180 / Math.PI) + 90,
    [viewportCenter.x, viewportCenter.y]
  );

  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const draggingPointerId = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [surfaceSize, setSurfaceSize] = useState({ width: 268, height: 188 });

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const updateSize = () => {
      const rect = surface.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSurfaceSize((prev) =>
          prev.width === rect.width && prev.height === rect.height
            ? prev
            : { width: rect.width, height: rect.height }
        );
      }
    };

    updateSize();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateSize);
      observer.observe(surface);
      return () => observer.disconnect();
    }

    return undefined;
  }, []);

  const { contentWidthPercent, contentHeightPercent } = useMemo(() => {
    const boundsAspectRatio = bounds.width / bounds.height;
    const surfaceAspectRatio = surfaceSize.width / surfaceSize.height;

    if (boundsAspectRatio > surfaceAspectRatio) {
      return {
        contentWidthPercent: 100,
        contentHeightPercent: (surfaceAspectRatio / boundsAspectRatio) * 100,
      };
    }
    return {
      contentHeightPercent: 100,
      contentWidthPercent: (boundsAspectRatio / surfaceAspectRatio) * 100,
    };
  }, [bounds.height, bounds.width, surfaceSize.height, surfaceSize.width]);

  const getMinimapPercentFromEvent = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const content = contentRef.current;
    if (!content) return null;
    const rect = content.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const rawX = ((event.clientX - rect.left) / rect.width) * 100;
    const rawY = ((event.clientY - rect.top) / rect.height) * 100;
    if (rawX < 0 || rawX > 100 || rawY < 0 || rawY > 100) {
      return null;
    }
    return { x: rawX, y: rawY };
  }, []);

  const handleRecenter = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!onRecenter) return;
      const percentPoint = getMinimapPercentFromEvent(event);
      if (!percentPoint) return;
      onRecenter(minimapPercentToWorld(percentPoint, bounds));
    },
    [bounds, getMinimapPercentFromEvent, onRecenter]
  );

  return (
    <div className="minimap-overlay" role="region" aria-label="Minimap" data-testid="minimap-overlay">
      <div className="minimap-frame">
        <div
          ref={surfaceRef}
          className={`minimap-surface${isDragging ? ' dragging' : ''}`}
          data-testid="minimap-surface"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            draggingPointerId.current = event.pointerId;
            setIsDragging(true);
            event.currentTarget.setPointerCapture?.(event.pointerId);
            handleRecenter(event);
          }}
          onPointerMove={(event) => {
            if (draggingPointerId.current !== event.pointerId) return;
            event.preventDefault();
            event.stopPropagation();
            handleRecenter(event);
          }}
          onPointerUp={(event) => {
            if (draggingPointerId.current !== event.pointerId) return;
            event.preventDefault();
            event.stopPropagation();
            draggingPointerId.current = null;
            setIsDragging(false);
            event.currentTarget.releasePointerCapture?.(event.pointerId);
          }}
          onPointerCancel={(event) => {
            if (draggingPointerId.current !== event.pointerId) return;
            draggingPointerId.current = null;
            setIsDragging(false);
            event.currentTarget.releasePointerCapture?.(event.pointerId);
          }}
        >
          <div
            ref={contentRef}
            className="minimap-content"
            data-testid="minimap-content"
            style={
              {
                '--content-width': `${contentWidthPercent}%`,
                '--content-height': `${contentHeightPercent}%`,
              } as React.CSSProperties
            }
          >
            <MinimapViewportLayer
              viewportPercent={viewportPercent}
              viewportOutside={viewportOutside}
              arrowPosition={arrowPosition}
              arrowRotation={arrowRotation}
            />
            <MinimapStaticLayer
              heroPoint={heroPoint}
              agentPoints={agentPoints}
              folderRects={folderRects}
              browserRects={browserRects}
              terminalRects={terminalRects}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const areMinimapPropsEqual = (previous: MinimapOverlayProps, next: MinimapOverlayProps): boolean =>
  previous.hero === next.hero &&
  previous.agents === next.agents &&
  previous.folders === next.folders &&
  previous.browsers === next.browsers &&
  previous.terminals === next.terminals &&
  previous.cameraStore === next.cameraStore &&
  previous.onRecenter === next.onRecenter;

export default memo(MinimapOverlay, areMinimapPropsEqual);
