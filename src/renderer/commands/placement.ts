import type { EntityType, WindowedBuildingType } from '../../shared/types';

export type PlacementEntity = EntityType;

export type PlacementPoint = {
  x: number;
  y: number;
};

export type PlacementSize = {
  width: number;
  height: number;
};

export function resolveMovePosition(point: PlacementPoint, _entity: PlacementEntity): PlacementPoint {
  void _entity;
  return point;
}

export function resolvePlacementPosition(point: PlacementPoint, _entity: PlacementEntity): PlacementPoint {
  void _entity;
  return point;
}

export function resolveResize(size: PlacementSize, _entity: WindowedBuildingType): PlacementSize {
  void _entity;
  return size;
}
