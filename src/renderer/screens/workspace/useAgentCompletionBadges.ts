import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Agent, AgentConnectEventPayload, SelectedEntityRef } from '../../../shared/types';
import { workspaceClient } from '../../services/workspaceClient';

type UseAgentCompletionBadgesParams = {
  workspacePath: string;
  agents: Agent[];
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
  selectedEntityRef: SelectedEntityRef | null;
  selectedAgentIds: string[];
};

type UseAgentCompletionBadgesResult = {
  completedAgentIds: ReadonlySet<string>;
  clearAgentCompletionBadges: (agentIds: string[]) => void;
};

export function useAgentCompletionBadges({
  workspacePath,
  agents,
  setAgents,
  selectedEntityRef,
  selectedAgentIds,
}: UseAgentCompletionBadgesParams): UseAgentCompletionBadgesResult {
  const agentIdsRef = useRef<Set<string>>(new Set());
  const agentMapRef = useRef<Map<string, Agent>>(new Map());
  const selectionRef = useRef<{ entity: SelectedEntityRef | null; agentIds: string[] }>({
    entity: null,
    agentIds: [],
  });

  useEffect(() => {
    agentIdsRef.current = new Set(agents.map((agent) => agent.id));
    agentMapRef.current = new Map(agents.map((agent) => [agent.id, agent]));
  }, [agents]);

  useEffect(() => {
    selectionRef.current = { entity: selectedEntityRef, agentIds: selectedAgentIds };
  }, [selectedAgentIds, selectedEntityRef]);

  const clearAgentCompletionBadges = useCallback(
    (agentIds: string[]) => {
      if (agentIds.length === 0) return;
      const idsToClear = agentIds.filter((id) => agentMapRef.current.get(id)?.hasUnreadCompletion);
      if (idsToClear.length === 0) return;
      setAgents((prev) =>
        prev.map((agent) =>
          idsToClear.includes(agent.id) ? { ...agent, hasUnreadCompletion: false } : agent
        )
      );
      void Promise.all(
        idsToClear.map((agentId) =>
          workspaceClient.updateAgentUnreadCompletion(workspacePath, agentId, false)
        )
      );
    },
    [setAgents, workspacePath]
  );

  const markAgentUnread = useCallback(
    (agentId: string) => {
      const agent = agentMapRef.current.get(agentId);
      if (agent?.hasUnreadCompletion) return;
      setAgents((prev) =>
        prev.map((entry) => (entry.id === agentId ? { ...entry, hasUnreadCompletion: true } : entry))
      );
      void workspaceClient.updateAgentUnreadCompletion(workspacePath, agentId, true);
    },
    [setAgents, workspacePath]
  );

  const completedAgentIds = useMemo(
    () => new Set(agents.filter((agent) => agent.hasUnreadCompletion).map((agent) => agent.id)),
    [agents]
  );

  useEffect(() => {
    if (window.electronAPI.isTestMode) return;
    const handledRuns = new Set<string>();

    const cleanup = window.electronAPI.onAgentConnectEvent((payload: AgentConnectEventPayload) => {
      if (payload.unit.type !== 'agent') return;
      if (!agentIdsRef.current.has(payload.unit.id)) return;
      if (payload.event.type !== 'final' || payload.event.cancelled) return;
      if (handledRuns.has(payload.runId)) return;

      handledRuns.add(payload.runId);
      const { entity, agentIds } = selectionRef.current;
      const isSelected =
        (entity?.type === 'agent' && entity.id === payload.unit.id) || agentIds.includes(payload.unit.id);
      if (isSelected) return;
      markAgentUnread(payload.unit.id);
    });

    return () => {
      cleanup();
    };
  }, [markAgentUnread]);

  return {
    completedAgentIds,
    clearAgentCompletionBadges,
  };
}
