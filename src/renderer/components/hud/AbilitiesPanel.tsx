import type { EntityType } from '../../../shared/types';
import type { AbilityDescriptor } from './abilityBuilder';
import type { CommandInvocation } from '../../commands/registry';

const isIconUrl = (icon: string): boolean =>
  icon.startsWith('/') || icon.startsWith('data:') || icon.endsWith('.svg');

const renderIcon = (icon: string | undefined) => {
  if (!icon) return null;
  if (isIconUrl(icon)) {
    return <img className="ability-icon-img" src={icon} alt="" />;
  }
  return <span className="ability-icon">{icon}</span>;
};

interface AbilitiesPanelProps {
  entityType: EntityType;
  abilities: AbilityDescriptor[];
  onAbility: (ability: CommandInvocation) => void;
}

export default function AbilitiesPanel({ entityType, abilities, onAbility }: AbilitiesPanelProps) {
  if (entityType === 'hero' && abilities.length === 0) {
    return (
      <div className="abilities-panel">
        <div className="panel-header">Abilities</div>
        <div className="panel-content abilities-grid">
          <div className="empty-abilities">
            <span className="empty-abilities-hint">Hero unit - future abilities coming soon</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="abilities-panel">
      <div className="panel-header">Abilities</div>
      <div className="panel-content abilities-grid">
        {abilities.map((ability) => (
          <button
            key={ability.id}
            className={`ability-btn ${ability.kind === 'primary' ? 'primary' : ''} ${
              ability.kind === 'warning' ? 'warning' : ''
            } ${ability.selected ? 'selected' : ''}`}
            onClick={() => onAbility(ability.action)}
            disabled={ability.disabled}
            title={ability.tooltip}
            data-testid={`ability-${ability.id}`}
          >
            {renderIcon(ability.icon)}
            <span>{ability.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
