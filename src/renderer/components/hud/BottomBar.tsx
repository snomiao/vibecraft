import CompactDetailsPanel from './CompactDetailsPanel';
import ActionBar from './ActionBar';
import GroupSelectionPanel from './GroupSelectionPanel';
import type { Agent, WorldEntity } from '../../../shared/types';
import type { CommandInvocation } from '../../commands/registry';
import type { AbilityResolution } from './abilityBuilder';

interface BottomBarProps {
  selectedEntity: WorldEntity | null;
  selectedAgents: Agent[];
  onSelectAgent: (agentId: string) => void;
  terminalProcess: string | null;
  onHeroNameCommit: (name: string) => void;
  onAgentNameCommit: (agentId: string, name: string) => void;
  onHeroModelCommit: (model: string) => Promise<{ ok: boolean; error?: string }>;
  onAbility: (ability: CommandInvocation) => void;
  abilityResolution: AbilityResolution;
  triggerPress?: { index: number; key: number } | null;
}

export default function BottomBar({
  selectedEntity,
  selectedAgents,
  onSelectAgent,
  terminalProcess,
  onHeroNameCommit,
  onAgentNameCommit,
  onHeroModelCommit,
  onAbility,
  abilityResolution,
  triggerPress,
}: BottomBarProps) {
  const { abilities, hotkeyMode, isMultiSelect } = abilityResolution;

  const isUnit = selectedEntity?.entityKind === 'unit';

  return (
    <div className="bottom-bar">
      {isMultiSelect ? (
        <div className="bottom-bar-details">
          <GroupSelectionPanel agents={selectedAgents} onSelectAgent={onSelectAgent} />
        </div>
      ) : isUnit && selectedEntity ? (
        <div className="bottom-bar-details">
          <CompactDetailsPanel
            entity={selectedEntity}
            terminalProcess={terminalProcess}
            onHeroNameCommit={onHeroNameCommit}
            onAgentNameCommit={onAgentNameCommit}
            onHeroModelCommit={onHeroModelCommit}
          />
        </div>
      ) : null}

      <ActionBar
        abilities={abilities}
        hotkeyMode={hotkeyMode}
        onAbility={onAbility}
        triggerPress={triggerPress}
      />
    </div>
  );
}
