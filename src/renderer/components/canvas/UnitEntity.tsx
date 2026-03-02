import type { MouseEvent, ReactNode } from 'react';
import type { EntityType } from '../../../shared/types';
import Entity from './Entity';
import { useEntityDrag } from './hooks/useEntityDrag';

interface UnitEntityProps {
  x: number;
  y: number;
  entityType: Extract<EntityType, 'hero' | 'agent'>;
  entityId?: string;
  entityName?: string;
  selected: boolean;
  previewed?: boolean;
  onSelect: (event?: MouseEvent) => void;
  onMove: (x: number, y: number) => void;
  onDragStart?: () => void;
  onDragEnd?: (data?: { pos: { x: number; y: number }; dragDistance: number }) => void;
  draggable?: boolean;
  className?: string;
  testId?: string;
  children: ReactNode;
}

export default function UnitEntity({
  x,
  y,
  entityType,
  entityId,
  entityName,
  selected,
  onSelect,
  onMove,
  onDragStart,
  onDragEnd,
  draggable = true,
  className,
  testId,
  children,
}: UnitEntityProps) {
  const { handleMouseDown } = useEntityDrag({
    x,
    y,
    onMove,
    onDragStart,
    onDragEnd,
    draggable,
  });

  return (
    <Entity
      x={x}
      y={y}
      entityType={entityType}
      entityId={entityId}
      entityName={entityName}
      selected={selected}
      onSelect={onSelect}
      onMouseDown={handleMouseDown}
      className={`entity ${className ?? ''}`.trim()}
      testId={testId}
    >
      {children}
    </Entity>
  );
}
