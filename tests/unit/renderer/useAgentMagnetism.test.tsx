import { act, render, waitFor } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { Agent, Folder } from '../../../src/shared/types';
import { useAgentMagnetism } from '../../../src/renderer/screens/workspace/useAgentMagnetism';

type Controls = {
  handleAgentMoveBatch: (moves: Array<{ id: string; x: number; y: number }>) => void;
  handleAgentDragStart: (id: string) => void;
  handleAgentDragEnd: (id: string, data?: { pos: { x: number; y: number }; dragDistance: number }) => void;
  getAgents: () => Agent[];
};

function Harness({
  initialAgents,
  folders,
  attachAgentToFolder,
  detachAgent,
  persistAgentPosition,
  onReady,
}: {
  initialAgents: Agent[];
  folders: Folder[];
  attachAgentToFolder?: (
    agentId: string,
    folderId: string,
    targetPos?: { x: number; y: number }
  ) => Promise<{ ok: boolean }>;
  detachAgent?: (agentId: string) => Promise<{ ok: boolean }>;
  persistAgentPosition?: (id: string, x: number, y: number) => Promise<{ ok: boolean }>;
  onReady: (controls: Controls) => void;
}) {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const agentsRef = useRef<Agent[]>(agents);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  const { handleAgentMoveBatch, handleAgentDragStart, handleAgentDragEnd } = useAgentMagnetism({
    agents,
    folders,
    setAgents,
    persistAgentPosition: persistAgentPosition ?? (async () => ({ ok: true })),
    attachAgentToFolder: attachAgentToFolder ?? (async () => ({ ok: true })),
    detachAgent: detachAgent ?? (async () => ({ ok: true })),
    clearMovementGroupIfComplete: () => {},
    clearPendingArrival: () => {},
  });

  useEffect(() => {
    onReady({
      handleAgentMoveBatch: (moves) => {
        handleAgentMoveBatch(moves);
      },
      handleAgentDragStart: (id) => {
        handleAgentDragStart(id);
      },
      handleAgentDragEnd: (id, data) => {
        handleAgentDragEnd(id, data);
      },
      getAgents: () => agentsRef.current,
    });
  }, [handleAgentDragEnd, handleAgentDragStart, handleAgentMoveBatch, onReady]);

  return null;
}

const buildAgent = (id: string, x: number, y: number, overrides?: Partial<Agent>): Agent => ({
  id,
  provider: 'claude',
  model: '',
  color: '#ff0000',
  name: id,
  displayName: id,
  workspacePath: '/workspace',
  x,
  y,
  status: 'offline',
  ...overrides,
});

describe('useAgentMagnetism', () => {
  it('assigns different attach slots when dragging multiple agents to the same folder', async () => {
    const folder: Folder = {
      id: 'folder-1',
      name: 'Folder',
      relativePath: 'Folder',
      kind: 'folder',
      x: 100,
      y: 100,
      createdAt: Date.now(),
    };
    const initialAgents = [buildAgent('agent-1', 20, 20), buildAgent('agent-2', 24, 24)];
    let controls: Controls | null = null;

    render(
      <Harness
        initialAgents={initialAgents}
        folders={[folder]}
        onReady={(next) => {
          controls = next;
        }}
      />
    );

    await waitFor(() => {
      expect(controls).not.toBeNull();
    });

    act(() => {
      controls!.handleAgentMoveBatch([
        { id: 'agent-1', x: 140, y: 116 },
        { id: 'agent-2', x: 140, y: 116 },
      ]);
    });

    await waitFor(() => {
      const agents = controls!.getAgents();
      const a1 = agents.find((entry) => entry.id === 'agent-1');
      const a2 = agents.find((entry) => entry.id === 'agent-2');
      expect(a1?.attachedFolderId).toBe(folder.id);
      expect(a2?.attachedFolderId).toBe(folder.id);
      expect(a1?.x).not.toBe(a2?.x);
      expect(a1?.y).not.toBe(a2?.y);
    });
  });

  it('reflows on drag release even when agent remains attached to the same folder', async () => {
    const folder: Folder = {
      id: 'folder-1',
      name: 'Folder',
      relativePath: 'Folder',
      kind: 'folder',
      x: 100,
      y: 100,
      createdAt: Date.now(),
    };
    const attachCalls: Array<{ agentId: string; folderId: string; targetPos?: { x: number; y: number } }> =
      [];
    const persistCalls: Array<{ id: string; x: number; y: number }> = [];
    const initialAgents = [
      buildAgent('agent-1', 140, 116, {
        attachedFolderId: folder.id,
        status: 'online',
      }),
    ];
    let controls: Controls | null = null;

    render(
      <Harness
        initialAgents={initialAgents}
        folders={[folder]}
        attachAgentToFolder={async (agentId, folderId, targetPos) => {
          attachCalls.push({ agentId, folderId, targetPos });
          return { ok: true };
        }}
        persistAgentPosition={async (id, x, y) => {
          persistCalls.push({ id, x, y });
          return { ok: true };
        }}
        onReady={(next) => {
          controls = next;
        }}
      />
    );

    await waitFor(() => {
      expect(controls).not.toBeNull();
    });

    act(() => {
      controls!.handleAgentDragStart('agent-1');
      controls!.handleAgentMoveBatch([{ id: 'agent-1', x: 150, y: 118 }]);
      controls!.handleAgentDragEnd('agent-1', {
        pos: { x: 150, y: 118 },
        dragDistance: 20,
      });
    });

    await waitFor(() => {
      expect(attachCalls).toHaveLength(1);
      expect(attachCalls[0]?.agentId).toBe('agent-1');
      expect(attachCalls[0]?.folderId).toBe(folder.id);
      expect(persistCalls).toHaveLength(0);
    });
  });
});
