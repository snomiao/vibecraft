import { useCallback, type CSSProperties, type ReactNode, type MouseEvent, type Ref } from 'react';
import type { EntityType } from '../../../shared/types';

interface EntityProps {
  entityType: EntityType;
  entityId?: string;
  entityName?: string;
  selected?: boolean;
  onSelect?: (event?: MouseEvent) => void;
  onMouseDown?: (event: MouseEvent) => void;
  className?: string;
  style?: CSSProperties;
  testId?: string;
  children: ReactNode;
  x?: number;
  y?: number;
  entityZIndex?: number;
  elementRef?: Ref<HTMLDivElement>;
}

export default function Entity({
  entityType,
  entityId,
  entityName,
  selected = false,
  onSelect,
  onMouseDown,
  className = '',
  style,
  testId,
  children,
  x,
  y,
  entityZIndex,
  elementRef,
}: EntityProps) {
  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!onSelect) return;
      e.stopPropagation();
      onSelect(e);
    },
    [onSelect]
  );

  const positionStyle =
    x !== undefined && y !== undefined
      ? {
          transform: `translate(${x}px, ${y}px)`,
        }
      : undefined;

  return (
    <div
      ref={elementRef}
      className={`${className} ${selected ? 'selected' : ''}`.trim()}
      style={{ ...positionStyle, ...style }}
      onMouseDown={onMouseDown}
      onClick={handleClick}
      data-testid={testId}
      data-entity-id={entityId}
      data-entity-type={entityType}
      data-entity-name={entityName}
      data-entity-z={entityZIndex}
    >
      {children}
    </div>
  );
}
