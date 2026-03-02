import type { MouseEvent } from 'react';
import UnitEntity from './UnitEntity';
import SelectionIndicator from './SelectionIndicator';
import type { Hero } from '../../../shared/types';
import { entityIcons } from '../../assets/icons';

interface HeroEntityProps {
  hero: Hero;
  selected: boolean;
  previewed?: boolean;
  thinking?: boolean;
  onSelect: (event?: MouseEvent) => void;
  onMove: (x: number, y: number) => void;
}

export default function HeroEntity({
  hero,
  selected,
  previewed = false,
  thinking = false,
  onSelect,
  onMove,
}: HeroEntityProps) {
  return (
    <UnitEntity
      x={hero.x}
      y={hero.y}
      entityType="hero"
      selected={selected}
      previewed={previewed}
      onSelect={onSelect}
      onMove={onMove}
      className={`hero-entity${thinking ? ' thinking' : ''}`}
      testId="entity-hero"
      entityId={hero.id}
      entityName={hero.name}
    >
      {/* The unit container - icon is the center, other elements positioned around it */}
      <div className="hero-unit">
        {/* Hitbox centered on the unit icon */}
        <div className="unit-hitbox hero-hitbox" />

        {/* Selection circle centered on the icon */}
        <SelectionIndicator active={selected || previewed} variant="circle" />

        {/* Unit info above the icon */}
        <div className="unit-overhead">
          <div className="unit-nameplate hero-nameplate">{hero.name}</div>
        </div>

        {/* The hero icon */}
        <img className="hero-icon" src={entityIcons.hero} alt="Hero" />

        {thinking && (
          <div className="hero-thinking-bubble" aria-label="Thinking">
            <span className="hero-thinking-dot" />
            <span className="hero-thinking-dot" />
            <span className="hero-thinking-dot" />
          </div>
        )}
      </div>
    </UnitEntity>
  );
}
