import type { CSSProperties, ReactNode, MouseEvent, Ref } from 'react';
import type { EntityType } from '../../../shared/types';
import Entity from './Entity';

interface BuildingEntityProps {
  entityType: Extract<EntityType, 'folder' | 'browser' | 'terminal'>;
  entityId?: string;
  entityName?: string;
  selected?: boolean;
  onSelect?: (event?: MouseEvent) => void;
  onMouseDown?: (event: MouseEvent) => void;
  className?: string;
  style?: CSSProperties;
  testId?: string;
  entityZIndex?: number;
  children: ReactNode;
  elementRef?: Ref<HTMLDivElement>;
}

export default function BuildingEntity({
  entityType,
  entityId,
  entityName,
  selected = false,
  onSelect,
  onMouseDown,
  className,
  style,
  testId,
  entityZIndex,
  children,
  elementRef,
}: BuildingEntityProps) {
  return (
    <Entity
      entityType={entityType}
      entityId={entityId}
      entityName={entityName}
      selected={selected}
      onSelect={onSelect}
      onMouseDown={onMouseDown}
      className={className}
      style={style}
      testId={testId}
      entityZIndex={entityZIndex}
      elementRef={elementRef}
    >
      {children}
    </Entity>
  );
}
