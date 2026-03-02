import DetailsPanel from './DetailsPanel';
import AbilitiesPanel from './AbilitiesPanel';
import GroupSelectionPanel from './GroupSelectionPanel';
import type { Agent, WorldEntity } from '../../../shared/types';
import type { CommandInvocation } from '../../commands/registry';
import { buildAbilities, type FolderContext } from './abilityBuilder';

interface HUDProps {
  selectedEntity: WorldEntity | null;
  selectedAgents: Agent[];
  onAbility: (ability: CommandInvocation) => void;
  onSelectAgent: (agentId: string) => void;
  folderContext?: FolderContext;
  terminalProcess: string | null;
  activeAgentTerminalId: string | null;
  onHeroNameCommit: (name: string) => void;
  onAgentNameCommit: (agentId: string, name: string) => void;
}

export default function HUD({
  selectedEntity,
  selectedAgents,
  onAbility,
  onSelectAgent,
  folderContext,
  terminalProcess,
  activeAgentTerminalId,
  onHeroNameCommit,
  onAgentNameCommit,
}: HUDProps) {
  if (selectedAgents.length > 1) {
    const abilities = [
      {
        id: 'destroy-agent' as const,
        label: 'Delete',
        icon: '🗑️',
        kind: 'warning' as const,
        action: { id: 'destroy-agent' } as CommandInvocation,
      },
    ];
    return (
      <div className="hud">
        <GroupSelectionPanel agents={selectedAgents} onSelectAgent={onSelectAgent} />
        <AbilitiesPanel entityType="agent" abilities={abilities} onAbility={onAbility} />
      </div>
    );
  }

  if (!selectedEntity) {
    return (
      <div className="hud hud-empty">
        <div className="hud-hint">Select an entity to view details</div>
      </div>
    );
  }

  const abilities = buildAbilities({
    entity: selectedEntity,
    ctx: folderContext,
    agentTerminalOpen: selectedEntity.type === 'agent' && selectedEntity.id === activeAgentTerminalId,
  });

  return (
    <div className="hud">
      <DetailsPanel
        entity={selectedEntity}
        terminalProcess={terminalProcess}
        onHeroNameCommit={onHeroNameCommit}
        onAgentNameCommit={onAgentNameCommit}
      />
      <AbilitiesPanel entityType={selectedEntity.type} abilities={abilities} onAbility={onAbility} />
    </div>
  );
}
