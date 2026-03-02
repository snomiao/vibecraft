import type { Agent } from '../../../shared/types';
import { getProviderIconUrl } from '../../utils/providerIcons';

interface GroupSelectionPanelProps {
  agents: Agent[];
  onSelectAgent: (agentId: string) => void;
}

export default function GroupSelectionPanel({ agents, onSelectAgent }: GroupSelectionPanelProps) {
  return (
    <div className="group-selection-panel">
      <div className="panel-header">Group Selection</div>
      <div className="panel-content">
        <div className="group-selection-count">{agents.length} selected</div>
        <div className="group-selection-list" role="list">
          {agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className="group-selection-chip"
              onClick={() => onSelectAgent(agent.id)}
              role="listitem"
              data-testid="group-selection-chip"
            >
              <img
                className="group-selection-icon"
                src={getProviderIconUrl(agent.provider)}
                alt=""
                aria-hidden="true"
              />
              <span className="group-selection-name">{agent.displayName}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
