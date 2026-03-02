import { act, cleanup, render, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { Agent, Folder } from '../../../src/shared/types';
import { useAgentMagnetism } from '../../../src/renderer/screens/workspace/useAgentMagnetism';
import {
  getFolderCenter,
  getGravityRadius,
  getSnapPosition,
} from '../../../src/renderer/screens/workspace/attachLayout';

afterEach(() => {
  cleanup();
});

const buildAgent = (id: string, x: number, y: number, attachedFolderId?: string): Agent => ({
  id,
  provider: 'claude',
  model: '',
  color: '#ff0000',
  name: id,
  displayName: id,
  workspacePath: '/workspace',
  x,
  y,
  status: attachedFolderId ? 'online' : 'offline',
  attachedFolderId,
});

const buildFolder = (id: string, x: number, y: number): Folder => ({
  id,
  kind: 'folder',
  name: id,
  relativePath: id,
  x,
  y,
  createdAt: Date.now(),
});

type Controls = {
  getAgents: () => Agent[];
  getMagnetizedFolderIds: () => string[];
  handleAgentMove: (id: string, x: number, y: number) => void;
  handleAgentDragStart: (id: string) => void;
  handleAgentDragEnd: (id: string) => void;
};

function MagnetismHarness({
  initialAgents,
  folders,
  onReady,
}: {
  initialAgents: Agent[];
  folders: Folder[];
  onReady: (controls: Controls) => void;
}) {
  const [agents, setAgents] = useState(initialAgents);

  const { handleAgentMove, handleAgentDragStart, handleAgentDragEnd, magnetizedFolderIds } =
    useAgentMagnetism({
      agents,
      folders,
      setAgents,
      persistAgentPosition: vi.fn().mockResolvedValue({ ok: true }),
      attachAgentToFolder: vi.fn().mockResolvedValue({ ok: true }),
      detachAgent: vi.fn().mockResolvedValue({ ok: true }),
      clearMovementGroupIfComplete: vi.fn(),
      clearPendingArrival: vi.fn(),
    });

  useEffect(() => {
    onReady({
      getAgents: () => agents,
      getMagnetizedFolderIds: () => magnetizedFolderIds,
      handleAgentMove: (id, x, y) => handleAgentMove(id, x, y),
      handleAgentDragStart,
      handleAgentDragEnd,
    });
  }, [agents, magnetizedFolderIds, handleAgentMove, handleAgentDragStart, handleAgentDragEnd, onReady]);

  return null;
}

describe('System Coupling: Magnetism', () => {
  test('dragging agent into folder gravity range snaps agent and sets magnetized folder', async () => {
    const folder = buildFolder('folder-1', 200, 200);
    const agent = buildAgent('agent-1', 500, 500);
    let controls: Controls | null = null;

    render(
      <MagnetismHarness
        initialAgents={[agent]}
        folders={[folder]}
        onReady={(c) => {
          controls = c;
        }}
      />
    );

    expect(controls).not.toBeNull();

    const folderCenter = getFolderCenter(folder);
    const nearFolderPos = { x: folderCenter.x + 10, y: folderCenter.y + 10 };

    act(() => {
      controls!.handleAgentDragStart('agent-1');
      controls!.handleAgentMove('agent-1', nearFolderPos.x, nearFolderPos.y);
    });

    await waitFor(() => {
      const updatedAgents = controls!.getAgents();
      const updatedAgent = updatedAgents.find((a) => a.id === 'agent-1');
      expect(updatedAgent?.attachedFolderId).toBe('folder-1');
    });

    await waitFor(() => {
      const magnetized = controls!.getMagnetizedFolderIds();
      expect(magnetized).toContain('folder-1');
    });
  });

  test('dragging attached agent outside gravity range detaches and clears magnetized folder', async () => {
    const folder = buildFolder('folder-1', 200, 200);
    const folderCenter = getFolderCenter(folder);
    const snapPos = getSnapPosition(folder, 0);
    const agent = buildAgent('agent-1', snapPos.x, snapPos.y, 'folder-1');
    let controls: Controls | null = null;

    render(
      <MagnetismHarness
        initialAgents={[agent]}
        folders={[folder]}
        onReady={(c) => {
          controls = c;
        }}
      />
    );

    expect(controls).not.toBeNull();

    const gravityRadius = getGravityRadius();
    const farFromFolder = {
      x: folderCenter.x + gravityRadius + 100,
      y: folderCenter.y + gravityRadius + 100,
    };

    act(() => {
      controls!.handleAgentDragStart('agent-1');
      controls!.handleAgentMove('agent-1', farFromFolder.x, farFromFolder.y);
    });

    await waitFor(() => {
      const updatedAgents = controls!.getAgents();
      const updatedAgent = updatedAgents.find((a) => a.id === 'agent-1');
      expect(updatedAgent?.attachedFolderId).toBeUndefined();
    });
  });

  test('dragging agent maintains snap angle when moving within gravity', async () => {
    const folder = buildFolder('folder-1', 200, 200);
    const agent = buildAgent('agent-1', 500, 500);
    let controls: Controls | null = null;

    render(
      <MagnetismHarness
        initialAgents={[agent]}
        folders={[folder]}
        onReady={(c) => {
          controls = c;
        }}
      />
    );

    expect(controls).not.toBeNull();

    const folderCenter = getFolderCenter(folder);
    const nearFolderPos1 = { x: folderCenter.x + 20, y: folderCenter.y };
    const nearFolderPos2 = { x: folderCenter.x + 30, y: folderCenter.y + 5 };

    act(() => {
      controls!.handleAgentDragStart('agent-1');
      controls!.handleAgentMove('agent-1', nearFolderPos1.x, nearFolderPos1.y);
    });

    let firstSnapPos: { x: number; y: number } | null = null;
    await waitFor(() => {
      const updatedAgents = controls!.getAgents();
      const updatedAgent = updatedAgents.find((a) => a.id === 'agent-1');
      expect(updatedAgent?.attachedFolderId).toBe('folder-1');
      firstSnapPos = { x: updatedAgent!.x, y: updatedAgent!.y };
    });

    act(() => {
      controls!.handleAgentMove('agent-1', nearFolderPos2.x, nearFolderPos2.y);
    });

    await waitFor(() => {
      const updatedAgents = controls!.getAgents();
      const updatedAgent = updatedAgents.find((a) => a.id === 'agent-1');
      expect(updatedAgent!.x).toBe(firstSnapPos!.x);
      expect(updatedAgent!.y).toBe(firstSnapPos!.y);
    });
  });
});

describe('System Coupling: Agent status and attachment', () => {
  test('agent status changes to online when attached', async () => {
    const folder = buildFolder('folder-1', 200, 200);
    const agent = buildAgent('agent-1', 500, 500);
    let controls: Controls | null = null;

    render(
      <MagnetismHarness
        initialAgents={[agent]}
        folders={[folder]}
        onReady={(c) => {
          controls = c;
        }}
      />
    );

    expect(controls).not.toBeNull();

    const initialAgents = controls!.getAgents();
    expect(initialAgents[0].status).toBe('offline');

    const folderCenter = getFolderCenter(folder);
    act(() => {
      controls!.handleAgentDragStart('agent-1');
      controls!.handleAgentMove('agent-1', folderCenter.x, folderCenter.y);
    });

    await waitFor(() => {
      const updatedAgents = controls!.getAgents();
      const updatedAgent = updatedAgents.find((a) => a.id === 'agent-1');
      expect(updatedAgent?.status).toBe('online');
    });
  });

  test('agent status changes to offline when detached', async () => {
    const folder = buildFolder('folder-1', 200, 200);
    const snapPos = getSnapPosition(folder, 0);
    const agent = buildAgent('agent-1', snapPos.x, snapPos.y, 'folder-1');
    let controls: Controls | null = null;

    render(
      <MagnetismHarness
        initialAgents={[agent]}
        folders={[folder]}
        onReady={(c) => {
          controls = c;
        }}
      />
    );

    expect(controls).not.toBeNull();

    const initialAgents = controls!.getAgents();
    expect(initialAgents[0].status).toBe('online');

    const folderCenter = getFolderCenter(folder);
    const gravityRadius = getGravityRadius();
    const farAway = { x: folderCenter.x + gravityRadius + 200, y: folderCenter.y };

    act(() => {
      controls!.handleAgentDragStart('agent-1');
      controls!.handleAgentMove('agent-1', farAway.x, farAway.y);
    });

    await waitFor(() => {
      const updatedAgents = controls!.getAgents();
      const updatedAgent = updatedAgents.find((a) => a.id === 'agent-1');
      expect(updatedAgent?.status).toBe('offline');
    });
  });
});
