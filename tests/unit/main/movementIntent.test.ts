import { expect, test } from 'vitest';
import { resolveMovementIntent } from '../../../src/shared/movement';

test('resolveMovementIntent snaps to target and clears intent', () => {
  const intent = {
    startPos: { x: 0, y: 0 },
    targetPos: { x: 120, y: 80 },
    startTime: 0,
    duration: 1000,
    intentType: 'move' as const,
  };
  const { entity, resolved } = resolveMovementIntent({ x: 0, y: 0, movementIntent: intent });
  expect(resolved).toBe(true);
  expect(entity.x).toBe(120);
  expect(entity.y).toBe(80);
  expect(entity.movementIntent).toBeUndefined();
});
