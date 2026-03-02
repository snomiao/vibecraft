import { render } from '@testing-library/react';
import { bench, describe } from 'vitest';
import type { Agent, BrowserPanel, Folder, Hero, TerminalPanel } from '../../../src/shared/types';
import MinimapOverlay from '../../../src/renderer/components/minimap/MinimapOverlay';
import { AGENT_TOKEN_SIZE_PX, HERO_TOKEN_SIZE_PX } from '../../../src/renderer/screens/workspace/constants';
import { computeMinimapBounds } from '../../../src/renderer/components/minimap/minimapMath';
import { createCameraStore } from '../../../src/renderer/components/minimap/cameraStore';

const WORKSPACE_PATH = '/tmp/vibecraft-perf';

const hero: Hero = {
  id: 'hero',
  name: 'Hero',
  provider: 'claude',
  model: 'claude-sonnet-4',
  x: 1800,
  y: 1200,
};

const agents: Agent[] = Array.from({ length: 280 }, (_, index) => {
  const lane = index % 28;
  const row = Math.floor(index / 28);
  const status = index % 6 === 0 ? 'working' : index % 5 === 0 ? 'offline' : 'online';
  return {
    id: `agent-${index}`,
    provider: index % 2 === 0 ? 'claude' : 'codex',
    model: index % 2 === 0 ? 'claude-sonnet-4' : 'gpt-5',
    color: index % 2 === 0 ? '#7be0ff' : '#ffd77b',
    name: `Agent ${index}`,
    displayName: `Agent ${index}`,
    workspacePath: WORKSPACE_PATH,
    x: 300 + lane * 120,
    y: 240 + row * 140,
    status,
  };
});

const folders: Folder[] = Array.from({ length: 140 }, (_, index) => ({
  kind: 'folder',
  id: `folder-${index}`,
  name: `Project ${index}`,
  relativePath: `project-${index}`,
  x: 200 + (index % 20) * 190,
  y: 180 + Math.floor(index / 20) * 180,
  createdAt: 1700000000000 + index,
}));

const browsers: BrowserPanel[] = Array.from({ length: 90 }, (_, index) => ({
  id: `browser-${index}`,
  url: `https://example.com/${index}`,
  x: 220 + (index % 15) * 230,
  y: 260 + Math.floor(index / 15) * 220,
  width: 520,
  height: 320,
  createdAt: 1700000100000 + index,
}));

const terminals: TerminalPanel[] = Array.from({ length: 90 }, (_, index) => ({
  id: `terminal-${index}`,
  originFolderName: `Project ${index}`,
  x: 240 + (index % 15) * 230,
  y: 290 + Math.floor(index / 15) * 220,
  width: 520,
  height: 320,
  createdAt: 1700000200000 + index,
}));

const baseCamera = {
  pan: { x: -1000, y: -800 },
  zoom: 1,
  viewport: { width: 1920, height: 1080 },
};

const cameraFrames = Array.from({ length: 120 }, (_, frame) => ({
  pan: {
    x: baseCamera.pan.x - frame * 14,
    y: baseCamera.pan.y - frame * 11,
  },
  zoom: baseCamera.zoom,
  viewport: baseCamera.viewport,
}));

const folderBuildingRects = folders.map((folder) => ({
  x: folder.x,
  y: folder.y,
  width: 80,
  height: 80,
}));

const browserBuildingRects = browsers.map((browser) => ({
  x: browser.x,
  y: browser.y,
  width: browser.width,
  height: browser.height,
}));

const terminalBuildingRects = terminals.map((terminal) => ({
  x: terminal.x,
  y: terminal.y,
  width: terminal.width,
  height: terminal.height,
}));

const unitPoints = [
  { x: hero.x + HERO_TOKEN_SIZE_PX / 2, y: hero.y + HERO_TOKEN_SIZE_PX / 2 },
  ...agents.map((agent) => ({
    x: agent.x + AGENT_TOKEN_SIZE_PX / 2,
    y: agent.y + AGENT_TOKEN_SIZE_PX / 2,
  })),
];

const buildingRects = [...folderBuildingRects, ...browserBuildingRects, ...terminalBuildingRects];

describe('workspace panning stress benchmarks', () => {
  bench('MinimapOverlay panning updates (heavy entities)', () => {
    const cameraStore = createCameraStore(cameraFrames[0]);
    const { rerender, unmount } = render(
      <MinimapOverlay
        hero={hero}
        agents={agents}
        folders={folders}
        browsers={browsers}
        terminals={terminals}
        cameraStore={cameraStore}
      />
    );

    for (let index = 1; index < cameraFrames.length; index += 1) {
      cameraStore.setSnapshot(cameraFrames[index]);
    }

    rerender(
      <MinimapOverlay
        hero={hero}
        agents={agents}
        folders={folders}
        browsers={browsers}
        terminals={terminals}
        cameraStore={cameraStore}
      />
    );
    unmount();
  });

  bench('computeMinimapBounds (heavy entities)', () => {
    computeMinimapBounds({
      buildingRects,
      unitPoints,
      minSize: { width: 1920, height: 1080 },
    });
  });
});
