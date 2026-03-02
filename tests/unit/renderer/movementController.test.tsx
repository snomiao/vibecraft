import { act, cleanup, render, waitFor } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Agent, Folder, Hero, SelectedEntityRef } from '../../../src/shared/types';
import { useMovementController } from '../../../src/renderer/screens/workspace/useMovementController';
import { getFormationTargets } from '../../../src/renderer/screens/workspace/movement';
import { DEFAULT_HERO } from '../../../src/shared/heroDefaults';
import * as WORKSPACE_CONSTANTS from '../../../src/renderer/screens/workspace/constants';

vi.mock('../../../src/renderer/services/workspaceClient', () => ({
  workspaceClient: {
    setAgentMovementIntent: vi.fn().mockResolvedValue(true),
    setHeroMovementIntent: vi.fn().mockResolvedValue(true),
    updateAgentPosition: vi.fn().mockResolvedValue(true),
    updateHeroPosition: vi.fn().mockResolvedValue(true),
  },
}));

afterEach(() => {
  cleanup();
});

type Controls = {
  handleCanvasRightClick: (position: { x: number; y: number }, target: SelectedEntityRef | null) => void;
  getAgents: () => Agent[];
};

const createAgent = (id: string, x: number, y: number): Agent => ({
  id,
  provider: 'claude',
  model: '',
  color: '#ff0000',
  name: id,
  displayName: id,
  workspacePath: '/workspace',
  x,
  y,
  status: 'online',
});

function Harness({
  initialAgents,
  selectedAgentIds,
  folders = [],
  detachAgent = async () => ({ ok: true }),
  onReady,
}: {
  initialAgents: Agent[];
  selectedAgentIds: string[];
  folders?: Folder[];
  detachAgent?: (agentId: string) => Promise<{ ok: boolean }>;
  onReady: (controls: Controls) => void;
}) {
  const [agents, setAgents] = useState(initialAgents);
  const [hero, setHero] = useState<Hero>({ ...DEFAULT_HERO });
  const agentsRef = useRef(agents);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  const { handleCanvasRightClick } = useMovementController({
    agents,
    hero,
    folders,
    selectedEntityRef: null,
    selectedAgentIds,
    setAgents,
    setHero,
    workspacePath: '/workspace',
    attachAgentToFolder: async () => ({ ok: true }),
    detachAgent,
  });

  useEffect(() => {
    onReady({
      handleCanvasRightClick,
      getAgents: () => agentsRef.current,
    });
  }, [handleCanvasRightClick, onReady]);

  return null;
}

describe('right-click movement', () => {
  it('moves multiple selected agents into a grid formation', async () => {
    const selectedAgentIds = ['agent-a', 'agent-b', 'agent-c', 'agent-d'];
    const initialAgents = selectedAgentIds.map((id, idx) => createAgent(id, idx * 20, 0));
    let controls: Controls | null = null;

    render(
      <Harness
        initialAgents={initialAgents}
        selectedAgentIds={selectedAgentIds}
        onReady={(next) => {
          controls = next;
        }}
      />
    );

    expect(controls).not.toBeNull();

    const target = { x: 240, y: 180 };
    act(() => {
      controls!.handleCanvasRightClick(target, null);
    });

    const expectedTargets = getFormationTargets(selectedAgentIds.length, target);

    await waitFor(() => {
      const agents = controls!.getAgents();
      selectedAgentIds.forEach((agentId, index) => {
        const agent = agents.find((entry) => entry.id === agentId);
        expect(agent?.movementIntent?.targetPos).toEqual(expectedTargets[index]);
      });
    });
  });

  it('does not reattach when destination is outside right-click attach radius even if path crosses folder', async () => {
    const folder: Folder = {
      id: 'folder-1',
      name: 'Folder',
      relativePath: 'Folder',
      kind: 'folder',
      x: 100,
      y: 100,
      createdAt: Date.now(),
    };
    const initialAgents: Agent[] = [
      {
        ...createAgent('agent-a', 200, 116),
        attachedFolderId: folder.id,
      },
    ];
    const detachAgent = vi.fn(async () => ({ ok: true }));
    let controls: Controls | null = null;

    render(
      <Harness
        initialAgents={initialAgents}
        selectedAgentIds={['agent-a']}
        folders={[folder]}
        detachAgent={detachAgent}
        onReady={(next) => {
          controls = next;
        }}
      />
    );

    expect(controls).not.toBeNull();

    const folderCenter = { x: folder.x + 40, y: folder.y + 40 };
    const target = {
      x: folderCenter.x - WORKSPACE_CONSTANTS.FOLDER_RIGHT_CLICK_ATTACH_RADIUS_PX - 32,
      y: folderCenter.y,
    };
    act(() => {
      controls!.handleCanvasRightClick(target, null);
    });

    await waitFor(() => {
      expect(detachAgent).toHaveBeenCalledWith('agent-a');
      const agent = controls!.getAgents().find((entry) => entry.id === 'agent-a');
      expect(agent).toBeDefined();
      expect(agent!.attachedFolderId).toBeUndefined();
      expect(agent!.movementIntent?.intentType).toBe('move');
      expect(agent!.movementIntent?.targetId).toBeUndefined();
      expect(agent!.movementIntent?.targetPos).toEqual({
        x: target.x - WORKSPACE_CONSTANTS.AGENT_TOKEN_SIZE_PX / 2,
        y: target.y - WORKSPACE_CONSTANTS.AGENT_TOKEN_SIZE_PX / 2,
      });
    });
  });

  it('does not force attach when folder is event target but click position is outside attach radius', async () => {
    const folder: Folder = {
      id: 'folder-1',
      name: 'Folder',
      relativePath: 'Folder',
      kind: 'folder',
      x: 100,
      y: 100,
      createdAt: Date.now(),
    };
    const initialAgents: Agent[] = [
      {
        ...createAgent('agent-a', 200, 116),
        attachedFolderId: folder.id,
      },
    ];
    const detachAgent = vi.fn(async () => ({ ok: true }));
    let controls: Controls | null = null;

    render(
      <Harness
        initialAgents={initialAgents}
        selectedAgentIds={['agent-a']}
        folders={[folder]}
        detachAgent={detachAgent}
        onReady={(next) => {
          controls = next;
        }}
      />
    );

    expect(controls).not.toBeNull();

    const folderCenter = { x: folder.x + 40, y: folder.y + 40 };
    const target = {
      x: folderCenter.x - WORKSPACE_CONSTANTS.FOLDER_RIGHT_CLICK_ATTACH_RADIUS_PX - 32,
      y: folderCenter.y,
    };
    act(() => {
      controls!.handleCanvasRightClick(target, { id: folder.id, type: 'folder' });
    });

    await waitFor(() => {
      expect(detachAgent).toHaveBeenCalledWith('agent-a');
      const agent = controls!.getAgents().find((entry) => entry.id === 'agent-a');
      expect(agent).toBeDefined();
      expect(agent!.attachedFolderId).toBeUndefined();
      expect(agent!.movementIntent?.intentType).toBe('move');
      expect(agent!.movementIntent?.targetId).toBeUndefined();
    });
  });

  it('detaches and moves when right-clicking opposite side outside right-click attach radius', async () => {
    const folder: Folder = {
      id: 'folder-1',
      name: 'Folder',
      relativePath: 'Folder',
      kind: 'folder',
      x: 100,
      y: 100,
      createdAt: Date.now(),
    };
    const initialAgents: Agent[] = [
      {
        ...createAgent('agent-a', 200, 116),
        attachedFolderId: folder.id,
      },
    ];
    const detachAgent = vi.fn(async () => ({ ok: true }));
    let controls: Controls | null = null;

    render(
      <Harness
        initialAgents={initialAgents}
        selectedAgentIds={['agent-a']}
        folders={[folder]}
        detachAgent={detachAgent}
        onReady={(next) => {
          controls = next;
        }}
      />
    );

    expect(controls).not.toBeNull();

    const folderCenter = { x: folder.x + 40, y: folder.y + 40 };
    const target = {
      x: folderCenter.x - WORKSPACE_CONSTANTS.FOLDER_RIGHT_CLICK_ATTACH_RADIUS_PX - 24,
      y: folderCenter.y,
    };
    act(() => {
      controls!.handleCanvasRightClick(target, null);
    });

    await waitFor(() => {
      expect(detachAgent).toHaveBeenCalledWith('agent-a');
      const agent = controls!.getAgents().find((entry) => entry.id === 'agent-a');
      expect(agent).toBeDefined();
      expect(agent!.attachedFolderId).toBeUndefined();
      expect(agent!.movementIntent?.intentType).toBe('move');
      expect(agent!.movementIntent?.targetId).toBeUndefined();
    });
  });
});
