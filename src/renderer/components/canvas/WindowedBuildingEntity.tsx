import type { CSSProperties, ReactNode, MouseEvent, Ref } from 'react';
import BuildingEntity from './BuildingEntity';

interface WindowedBuildingEntityProps {
  entityType: 'browser' | 'terminal';
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

export default function WindowedBuildingEntity({
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
}: WindowedBuildingEntityProps) {
  const combinedClassName = [className, 'windowed-building'].filter(Boolean).join(' ');

  return (
    <BuildingEntity
      entityType={entityType}
      entityId={entityId}
      entityName={entityName}
      selected={selected}
      onSelect={onSelect}
      onMouseDown={onMouseDown}
      className={combinedClassName}
      style={style}
      testId={testId}
      entityZIndex={entityZIndex}
      elementRef={elementRef}
    >
      {children}
    </BuildingEntity>
  );
}
