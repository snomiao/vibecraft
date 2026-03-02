import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import MinimapOverlay from '../../../src/renderer/components/minimap/MinimapOverlay';
import type { Agent, BrowserPanel, Folder, Hero, TerminalPanel } from '../../../src/shared/types';
import type { CanvasCameraState } from '../../../src/renderer/components/canvas/types';
import { AGENT_TOKEN_SIZE_PX, HERO_TOKEN_SIZE_PX } from '../../../src/renderer/screens/workspace/constants';
import {
  computeMinimapBounds,
  getVisibleWorldRect,
  minimapPercentToWorld,
  worldRectToMinimapPercent,
} from '../../../src/renderer/components/minimap/minimapMath';
import { createCameraStore } from '../../../src/renderer/components/minimap/cameraStore';

const baseCamera: CanvasCameraState = {
  pan: { x: 0, y: 0 },
  zoom: 1,
  viewport: { width: 1000, height: 750 },
};

const baseHero: Hero = {
  id: 'hero',
  name: 'Hero',
  provider: 'claude',
  model: '',
  x: 0,
  y: 0,
};

const baseAgent: Agent = {
  id: 'agent-1',
  provider: 'claude',
  model: '',
  color: '#ff0000',
  name: 'Claude',
  displayName: 'Claude',
  workspacePath: '/tmp',
  x: 200,
  y: 100,
  status: 'online',
};

const baseFolder: Folder = {
  kind: 'folder',
  id: 'folder-1',
  name: 'Repo',
  relativePath: 'repo',
  x: -40,
  y: -40,
  createdAt: Date.now(),
};

const baseBrowser: BrowserPanel = {
  id: 'browser-1',
  url: 'https://example.com',
  x: 240,
  y: -120,
  width: 480,
  height: 320,
  createdAt: Date.now(),
};

const baseTerminal: TerminalPanel = {
  id: 'terminal-1',
  x: -320,
  y: 200,
  width: 360,
  height: 240,
  createdAt: Date.now(),
};

describe('MinimapOverlay', () => {
  afterEach(() => {
    cleanup();
  });

  test('renders viewport rectangle sized to camera', () => {
    const cameraStore = createCameraStore(baseCamera);
    render(
      <MinimapOverlay
        hero={baseHero}
        agents={[]}
        folders={[]}
        browsers={[]}
        terminals={[]}
        cameraStore={cameraStore}
      />
    );

    const viewport = screen.getByTestId('minimap-viewport');
    const bounds = computeMinimapBounds({
      buildingRects: [],
      unitPoints: [{ x: baseHero.x + HERO_TOKEN_SIZE_PX / 2, y: baseHero.y + HERO_TOKEN_SIZE_PX / 2 }],
      minSize: { width: baseCamera.viewport.width, height: baseCamera.viewport.height },
    });
    const expected = worldRectToMinimapPercent(getVisibleWorldRect(baseCamera), bounds, false);
    expect(viewport).toBeInTheDocument();
    expect(viewport).toHaveStyle({
      left: `${expected.x}%`,
      top: `${expected.y}%`,
      width: `${expected.width}%`,
      height: `${expected.height}%`,
    });
  });

  test('renders units and buildings with labels', () => {
    const cameraStore = createCameraStore(baseCamera);
    render(
      <MinimapOverlay
        hero={baseHero}
        agents={[baseAgent]}
        folders={[baseFolder]}
        browsers={[baseBrowser]}
        terminals={[baseTerminal]}
        cameraStore={cameraStore}
      />
    );

    expect(screen.getByTestId('minimap-hero')).toBeInTheDocument();
    expect(screen.getByTestId('minimap-agent-agent-1')).toBeInTheDocument();

    const folder = screen.getByTestId('minimap-folder-folder-1');
    const bounds = computeMinimapBounds({
      buildingRects: [
        { x: baseFolder.x, y: baseFolder.y, width: 80, height: 80 },
        { x: baseBrowser.x, y: baseBrowser.y, width: baseBrowser.width, height: baseBrowser.height },
        { x: baseTerminal.x, y: baseTerminal.y, width: baseTerminal.width, height: baseTerminal.height },
      ],
      unitPoints: [
        { x: baseHero.x + HERO_TOKEN_SIZE_PX / 2, y: baseHero.y + HERO_TOKEN_SIZE_PX / 2 },
        { x: baseAgent.x + AGENT_TOKEN_SIZE_PX / 2, y: baseAgent.y + AGENT_TOKEN_SIZE_PX / 2 },
      ],
      minSize: { width: baseCamera.viewport.width, height: baseCamera.viewport.height },
    });
    const expectedFolder = worldRectToMinimapPercent(
      { x: baseFolder.x, y: baseFolder.y, width: 80, height: 80 },
      bounds,
      false
    );
    const widthValue = Number.parseFloat(folder.style.width);
    const heightValue = Number.parseFloat(folder.style.height);
    expect(widthValue).toBeCloseTo(expectedFolder.width, 6);
    expect(heightValue).toBeCloseTo(expectedFolder.height, 6);

    const browserPanel = screen.getByTestId('minimap-panel-browser-browser-1');
    expect(browserPanel.querySelector('img.minimap-panel-icon')).toBeInTheDocument();
    expect(screen.getByText('>_')).toBeInTheDocument();
  });

  test('recenters camera on minimap click', () => {
    const onRecenter = vi.fn();
    const cameraStore = createCameraStore(baseCamera);
    render(
      <MinimapOverlay
        hero={baseHero}
        agents={[baseAgent]}
        folders={[baseFolder]}
        browsers={[baseBrowser]}
        terminals={[baseTerminal]}
        cameraStore={cameraStore}
        onRecenter={onRecenter}
      />
    );

    const content = screen.getByTestId('minimap-content');
    content.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 200,
        height: 150,
        right: 200,
        bottom: 150,
        x: 0,
        y: 0,
        toJSON: () => '',
      }) as DOMRect;

    fireEvent.pointerDown(screen.getByTestId('minimap-surface'), {
      clientX: 100,
      clientY: 75,
      pointerId: 1,
      button: 0,
    });

    const bounds = computeMinimapBounds({
      buildingRects: [
        { x: baseFolder.x, y: baseFolder.y, width: 80, height: 80 },
        { x: baseBrowser.x, y: baseBrowser.y, width: baseBrowser.width, height: baseBrowser.height },
        { x: baseTerminal.x, y: baseTerminal.y, width: baseTerminal.width, height: baseTerminal.height },
      ],
      unitPoints: [
        { x: baseHero.x + HERO_TOKEN_SIZE_PX / 2, y: baseHero.y + HERO_TOKEN_SIZE_PX / 2 },
        { x: baseAgent.x + AGENT_TOKEN_SIZE_PX / 2, y: baseAgent.y + AGENT_TOKEN_SIZE_PX / 2 },
      ],
      minSize: { width: baseCamera.viewport.width, height: baseCamera.viewport.height },
    });
    const expected = minimapPercentToWorld({ x: 50, y: 50 }, bounds);

    expect(onRecenter).toHaveBeenCalledTimes(1);
    expect(onRecenter).toHaveBeenCalledWith({ x: expected.x, y: expected.y });
  });

  test('recenters while dragging on minimap', () => {
    const onRecenter = vi.fn();
    const cameraStore = createCameraStore(baseCamera);
    render(
      <MinimapOverlay
        hero={baseHero}
        agents={[baseAgent]}
        folders={[baseFolder]}
        browsers={[baseBrowser]}
        terminals={[baseTerminal]}
        cameraStore={cameraStore}
        onRecenter={onRecenter}
      />
    );

    const content = screen.getByTestId('minimap-content');
    content.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 200,
        height: 150,
        right: 200,
        bottom: 150,
        x: 0,
        y: 0,
        toJSON: () => '',
      }) as DOMRect;

    const surface = screen.getByTestId('minimap-surface');
    fireEvent.pointerDown(surface, { clientX: 20, clientY: 20, pointerId: 2, button: 0 });
    fireEvent.pointerMove(surface, { clientX: 180, clientY: 120, pointerId: 2 });
    fireEvent.pointerUp(surface, { clientX: 180, clientY: 120, pointerId: 2 });

    const bounds = computeMinimapBounds({
      buildingRects: [
        { x: baseFolder.x, y: baseFolder.y, width: 80, height: 80 },
        { x: baseBrowser.x, y: baseBrowser.y, width: baseBrowser.width, height: baseBrowser.height },
        { x: baseTerminal.x, y: baseTerminal.y, width: baseTerminal.width, height: baseTerminal.height },
      ],
      unitPoints: [
        { x: baseHero.x + HERO_TOKEN_SIZE_PX / 2, y: baseHero.y + HERO_TOKEN_SIZE_PX / 2 },
        { x: baseAgent.x + AGENT_TOKEN_SIZE_PX / 2, y: baseAgent.y + AGENT_TOKEN_SIZE_PX / 2 },
      ],
      minSize: { width: baseCamera.viewport.width, height: baseCamera.viewport.height },
    });
    const expected = minimapPercentToWorld({ x: 90, y: 80 }, bounds);
    const lastCall = onRecenter.mock.calls.at(-1)?.[0];

    expect(onRecenter.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(lastCall?.x).toBeCloseTo(expected.x, 5);
    expect(lastCall?.y).toBeCloseTo(expected.y, 5);
  });
});
