import type { MovementIntent, Position } from '../../../shared/types';
import * as WORKSPACE_CONSTANTS from './constants';

export const createMovementIntent = (
  startPos: Position,
  targetPos: Position,
  intentType: MovementIntent['intentType'],
  startTime: number,
  targetId?: string
): MovementIntent => {
  const distance = Math.hypot(targetPos.x - startPos.x, targetPos.y - startPos.y);
  const maxTimeSec = WORKSPACE_CONSTANTS.MOVE_MAX_DURATION_MS / 1000;
  const speed = Math.max(WORKSPACE_CONSTANTS.MIN_MOVE_SPEED, distance / maxTimeSec);
  const durationMs =
    speed === 0 ? 0 : Math.min(WORKSPACE_CONSTANTS.MOVE_MAX_DURATION_MS, (distance / speed) * 1000);

  return {
    startPos,
    targetPos,
    startTime,
    duration: durationMs,
    intentType,
    targetId,
  };
};

export const getMovementPosition = (
  intent: MovementIntent,
  now: number
): { position: Position; progress: number; done: boolean } => {
  if (intent.duration <= 0) {
    return { position: intent.targetPos, progress: 1, done: true };
  }
  const elapsed = now - intent.startTime;
  const rawProgress = elapsed / intent.duration;
  const clamped = Math.max(0, Math.min(1, rawProgress));
  const position = {
    x: intent.startPos.x + (intent.targetPos.x - intent.startPos.x) * clamped,
    y: intent.startPos.y + (intent.targetPos.y - intent.startPos.y) * clamped,
  };
  return { position, progress: clamped, done: clamped >= 1 };
};

export const getFormationTargets = (count: number, center: Position): Position[] => {
  if (count === 0) return [];

  const radius = WORKSPACE_CONSTANTS.AGENT_TOKEN_SIZE_PX / 2;

  // For single agent, offset so center ends up at click position
  if (count === 1) {
    return [{ x: center.x - radius, y: center.y - radius }];
  }

  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const spacing = WORKSPACE_CONSTANTS.AGENT_TOKEN_SIZE_PX + WORKSPACE_CONSTANTS.FORMATION_PADDING_PX;
  const gridWidth = (cols - 1) * spacing;
  const gridHeight = (rows - 1) * spacing;
  const startX = center.x - gridWidth / 2 - radius;
  const startY = center.y - gridHeight / 2 - radius;

  return Array.from({ length: count }, (_, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      x: startX + col * spacing,
      y: startY + row * spacing,
    };
  });
};
