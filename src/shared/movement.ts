import type { MovementIntent } from './types';

export const resolveMovementIntent = <T extends { x: number; y: number; movementIntent?: MovementIntent }>(
  entity: T
): { entity: T; resolved: boolean } => {
  if (!entity.movementIntent) {
    return { entity, resolved: false };
  }

  const { targetPos } = entity.movementIntent;
  return {
    entity: { ...entity, x: targetPos.x, y: targetPos.y, movementIntent: undefined },
    resolved: true,
  };
};
