import { describe, expect, test } from 'vitest';
import {
  createMovementIntent,
  getFormationTargets,
  getMovementPosition,
} from '../../../src/renderer/screens/workspace/movement';
import * as WORKSPACE_CONSTANTS from '../../../src/renderer/screens/workspace/constants';

describe('createMovementIntent', () => {
  test('caps duration at max time for long distances', () => {
    const start = { x: 0, y: 0 };
    const target = { x: 3000, y: 0 };
    const intent = createMovementIntent(start, target, 'move', 0);
    expect(intent.duration).toBe(WORKSPACE_CONSTANTS.MOVE_MAX_DURATION_MS);
  });

  test('respects minimum speed for short distances', () => {
    const start = { x: 0, y: 0 };
    const target = { x: 300, y: 0 };
    const intent = createMovementIntent(start, target, 'move', 0);
    const expected = (300 / WORKSPACE_CONSTANTS.MIN_MOVE_SPEED) * 1000;
    expect(intent.duration).toBeCloseTo(expected, 3);
  });

  test('handles zero distance (same start and target)', () => {
    const pos = { x: 100, y: 100 };
    const intent = createMovementIntent(pos, pos, 'move', 0);
    expect(intent.duration).toBe(0);
    expect(intent.startPos).toEqual(pos);
    expect(intent.targetPos).toEqual(pos);
  });

  test('preserves intent type in result', () => {
    const intent = createMovementIntent({ x: 0, y: 0 }, { x: 100, y: 0 }, 'move+attach', 1000, 'folder-1');
    expect(intent.intentType).toBe('move+attach');
    expect(intent.targetId).toBe('folder-1');
  });

  test('preserves start time in result', () => {
    const startTime = Date.now();
    const intent = createMovementIntent({ x: 0, y: 0 }, { x: 100, y: 0 }, 'move', startTime);
    expect(intent.startTime).toBe(startTime);
  });

  test('calculates correct duration for diagonal movement', () => {
    const start = { x: 0, y: 0 };
    const target = { x: 300, y: 400 };
    const intent = createMovementIntent(start, target, 'move', 0);
    const distance = Math.hypot(300, 400);
    const expected = (distance / WORKSPACE_CONSTANTS.MIN_MOVE_SPEED) * 1000;
    expect(intent.duration).toBeCloseTo(expected, 3);
  });

  test('handles negative coordinates', () => {
    const start = { x: -100, y: -100 };
    const target = { x: 100, y: 100 };
    const intent = createMovementIntent(start, target, 'move', 0);
    expect(intent.startPos).toEqual(start);
    expect(intent.targetPos).toEqual(target);
    expect(intent.duration).toBeGreaterThan(0);
  });
});

describe('getMovementPosition', () => {
  test('interpolates linearly', () => {
    const intent = createMovementIntent({ x: 0, y: 0 }, { x: 100, y: 0 }, 'move', 0);
    const halfway = getMovementPosition(intent, intent.startTime + intent.duration / 2);
    expect(halfway.position.x).toBeCloseTo(50, 2);
    expect(halfway.position.y).toBeCloseTo(0, 2);
  });

  test('returns start position at start time', () => {
    const intent = createMovementIntent({ x: 0, y: 0 }, { x: 100, y: 100 }, 'move', 1000);
    const result = getMovementPosition(intent, 1000);
    expect(result.position.x).toBeCloseTo(0, 2);
    expect(result.position.y).toBeCloseTo(0, 2);
    expect(result.progress).toBeCloseTo(0, 2);
    expect(result.done).toBe(false);
  });

  test('returns target position at end time', () => {
    const intent = createMovementIntent({ x: 0, y: 0 }, { x: 100, y: 100 }, 'move', 0);
    const result = getMovementPosition(intent, intent.duration);
    expect(result.position.x).toBeCloseTo(100, 2);
    expect(result.position.y).toBeCloseTo(100, 2);
    expect(result.progress).toBeCloseTo(1, 2);
    expect(result.done).toBe(true);
  });

  test('clamps progress to 0 when before start time', () => {
    const intent = createMovementIntent({ x: 0, y: 0 }, { x: 100, y: 0 }, 'move', 1000);
    const result = getMovementPosition(intent, 500);
    expect(result.position.x).toBeCloseTo(0, 2);
    expect(result.progress).toBeCloseTo(0, 2);
    expect(result.done).toBe(false);
  });

  test('clamps progress to 1 when past end time', () => {
    const intent = createMovementIntent({ x: 0, y: 0 }, { x: 100, y: 0 }, 'move', 0);
    const result = getMovementPosition(intent, intent.duration + 10000);
    expect(result.position.x).toBeCloseTo(100, 2);
    expect(result.progress).toBeCloseTo(1, 2);
    expect(result.done).toBe(true);
  });

  test('returns done immediately for zero duration intent', () => {
    const pos = { x: 50, y: 50 };
    const intent = createMovementIntent(pos, pos, 'move', 0);
    const result = getMovementPosition(intent, 0);
    expect(result.position).toEqual(pos);
    expect(result.progress).toBe(1);
    expect(result.done).toBe(true);
  });

  test('interpolates correctly at 25% progress', () => {
    const intent = createMovementIntent({ x: 0, y: 0 }, { x: 100, y: 200 }, 'move', 0);
    const result = getMovementPosition(intent, intent.duration * 0.25);
    expect(result.position.x).toBeCloseTo(25, 2);
    expect(result.position.y).toBeCloseTo(50, 2);
    expect(result.progress).toBeCloseTo(0.25, 2);
  });
});

describe('getFormationTargets', () => {
  test('centers around destination for 4 agents', () => {
    const center = { x: 200, y: 200 };
    const targets = getFormationTargets(4, center);
    const radius = WORKSPACE_CONSTANTS.AGENT_TOKEN_SIZE_PX / 2;
    const centers = targets.map((pos) => ({ x: pos.x + radius, y: pos.y + radius }));
    const avg = {
      x: centers.reduce((sum, pos) => sum + pos.x, 0) / centers.length,
      y: centers.reduce((sum, pos) => sum + pos.y, 0) / centers.length,
    };
    expect(avg.x).toBeCloseTo(center.x, 4);
    expect(avg.y).toBeCloseTo(center.y, 4);
  });

  test('returns empty array for count 0', () => {
    const targets = getFormationTargets(0, { x: 100, y: 100 });
    expect(targets).toEqual([]);
  });

  test('returns single position offset for count 1', () => {
    const center = { x: 200, y: 200 };
    const targets = getFormationTargets(1, center);
    expect(targets).toHaveLength(1);

    const radius = WORKSPACE_CONSTANTS.AGENT_TOKEN_SIZE_PX / 2;
    const agentCenter = { x: targets[0].x + radius, y: targets[0].y + radius };
    expect(agentCenter.x).toBeCloseTo(center.x, 4);
    expect(agentCenter.y).toBeCloseTo(center.y, 4);
  });

  test('returns correct count of positions', () => {
    expect(getFormationTargets(2, { x: 0, y: 0 })).toHaveLength(2);
    expect(getFormationTargets(5, { x: 0, y: 0 })).toHaveLength(5);
    expect(getFormationTargets(9, { x: 0, y: 0 })).toHaveLength(9);
  });

  test('forms a grid layout for larger groups', () => {
    const targets = getFormationTargets(9, { x: 200, y: 200 });
    expect(targets).toHaveLength(9);

    const uniqueX = new Set(targets.map((pos) => Math.round(pos.x)));
    const uniqueY = new Set(targets.map((pos) => Math.round(pos.y)));
    expect(uniqueX.size).toBe(3);
    expect(uniqueY.size).toBe(3);
  });

  test('spacing respects formation padding', () => {
    const targets = getFormationTargets(4, { x: 200, y: 200 });
    const expectedSpacing =
      WORKSPACE_CONSTANTS.AGENT_TOKEN_SIZE_PX + WORKSPACE_CONSTANTS.FORMATION_PADDING_PX;

    const uniqueXValues = [...new Set(targets.map((pos) => pos.x))].sort((a, b) => a - b);
    expect(uniqueXValues.length).toBe(2);
    const xDiff = uniqueXValues[1] - uniqueXValues[0];
    expect(xDiff).toBeCloseTo(expectedSpacing, 1);
  });
});
