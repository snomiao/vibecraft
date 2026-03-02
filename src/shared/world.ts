import type {
  BuildingType,
  EntityByType,
  EntityKind,
  EntityType,
  UnitType,
  WindowedBuildingType,
  WorldEntity,
} from './types';

export const isUnitType = (type: EntityType): type is UnitType => type === 'hero' || type === 'agent';

export const isBuildingType = (type: EntityType): type is BuildingType =>
  type === 'folder' || type === 'browser' || type === 'terminal';

export const isWindowedBuildingType = (type: EntityType): type is WindowedBuildingType =>
  type === 'browser' || type === 'terminal';

export const getEntityKind = (type: EntityType): EntityKind => (isUnitType(type) ? 'unit' : 'building');

export const toWorldEntity = <T extends EntityType>(type: T, entity: EntityByType[T]): WorldEntity =>
  ({ ...entity, type, entityKind: getEntityKind(type) }) as WorldEntity;
