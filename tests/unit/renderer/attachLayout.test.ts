import { describe, expect, test } from 'vitest';
import type { Agent, Folder } from '../../../src/shared/types';
import {
  distance,
  findAvailableAttachAngle,
  findNearestFolderInAttachRange,
  findNearestFolderInGravity,
  getAgentCenter,
  getAgentRadius,
  getAngleDeg,
  getAttachedAgentAngles,
  getAttachSlotPosition,
  getFolderCenter,
  getFolderRadius,
  getGravityRadius,
  getOccupiedAttachAngles,
  layoutAttachedAgents,
  resolveIncrementalAttachSlot,
  resolveAttachSlot,
  getSnapPosition,
  isOutsideGravity,
  normalizeAngleDeg,
} from '../../../src/renderer/screens/workspace/attachLayout';
import * as WORKSPACE_CONSTANTS from '../../../src/renderer/screens/workspace/constants';

const buildFolder = (overrides?: Partial<Folder>): Folder => ({
  id: 'folder-1',
  name: 'Folder',
  relativePath: 'Folder',
  kind: 'folder',
  x: 100,
  y: 100,
  createdAt: Date.now(),
  ...overrides,
});

test('gravity radius matches configured value', () => {
  expect(getGravityRadius()).toBe(WORKSPACE_CONSTANTS.FOLDER_SNAP_GRAVITY_RADIUS_PX);
});

test('getSnapPosition returns correct position at angle', () => {
  const folder = buildFolder({ x: 100, y: 100 });
  const folderCenter = { x: 100 + getFolderRadius(), y: 100 + getFolderRadius() };
  const snapOffset = WORKSPACE_CONSTANTS.FOLDER_ATTACH_DISTANCE_PX;
  const agentRadius = getAgentRadius();

  // Angle 0 (right)
  const posRight = getSnapPosition(folder, 0);
  expect(posRight.x).toBeCloseTo(folderCenter.x + snapOffset - agentRadius);
  expect(posRight.y).toBeCloseTo(folderCenter.y - agentRadius);

  // Angle PI/2 (down)
  const posDown = getSnapPosition(folder, Math.PI / 2);
  expect(posDown.x).toBeCloseTo(folderCenter.x - agentRadius);
  expect(posDown.y).toBeCloseTo(folderCenter.y + snapOffset - agentRadius);
});

test('findNearestFolderInGravity returns null when outside range', () => {
  const folder = buildFolder({ x: 100, y: 100 });
  const farAwayPos = { x: 1000, y: 1000 };
  expect(findNearestFolderInGravity(farAwayPos, [folder])).toBeNull();
});

test('findNearestFolderInGravity returns folder when inside range', () => {
  const folder = buildFolder({ x: 100, y: 100 });
  const nearbyPos = { x: 120, y: 120 };
  expect(findNearestFolderInGravity(nearbyPos, [folder])).toBe(folder);
});

test('findNearestFolderInGravity returns nearest of multiple', () => {
  const folder1 = buildFolder({ id: 'f1', x: 100, y: 100 });
  const folder2 = buildFolder({ id: 'f2', x: 150, y: 100 });
  const agentPos = { x: 140, y: 100 };
  const nearest = findNearestFolderInGravity(agentPos, [folder1, folder2]);
  expect(nearest?.id).toBe('f1');
});

test('isOutsideGravity returns true when beyond gravity radius', () => {
  const folder = buildFolder({ x: 100, y: 100 });
  const farPos = { x: 1000, y: 1000 };
  expect(isOutsideGravity(farPos, folder)).toBe(true);
});

test('isOutsideGravity returns false when within gravity radius', () => {
  const folder = buildFolder({ x: 100, y: 100 });
  const nearPos = { x: 120, y: 120 };
  expect(isOutsideGravity(nearPos, folder)).toBe(false);
});

test('attach angle steps clockwise when occupied', () => {
  const base = 270;
  const occupied = [270, 300];
  const next = findAvailableAttachAngle(base, occupied, WORKSPACE_CONSTANTS.ATTACH_ANGLE_STEP_DEG);
  expect(next).toBe(330);
});

describe('normalizeAngleDeg', () => {
  test('normalizes positive angles', () => {
    expect(normalizeAngleDeg(0)).toBe(0);
    expect(normalizeAngleDeg(90)).toBe(90);
    expect(normalizeAngleDeg(360)).toBe(0);
    expect(normalizeAngleDeg(450)).toBe(90);
  });

  test('normalizes negative angles', () => {
    expect(normalizeAngleDeg(-90)).toBe(270);
    expect(normalizeAngleDeg(-180)).toBe(180);
    expect(Math.abs(normalizeAngleDeg(-360))).toBe(0);
  });
});

describe('findAvailableAttachAngle priority resolution', () => {
  test('returns base angle when no slots occupied', () => {
    const result = findAvailableAttachAngle(45, []);
    expect(result).toBe(45);
  });

  test('wraps around 360 boundary when searching', () => {
    const occupied = [330, 0];
    const result = findAvailableAttachAngle(330, occupied, 30);
    expect(result).toBe(30);
  });

  test('returns base angle after full circle when all slots occupied', () => {
    const step = 30;
    const allAngles = Array.from({ length: 12 }, (_, i) => i * step);
    const result = findAvailableAttachAngle(0, allAngles, step);
    expect(result).toBe(0);
  });

  test('handles angle close to boundary (359 degrees)', () => {
    const result = findAvailableAttachAngle(359, [359], 30);
    expect(result).toBe(29);
  });
});

describe('getAttachedAgentAngles', () => {
  const buildAgent = (id: string, x: number, y: number, attachedFolderId?: string): Agent => ({
    id,
    provider: 'claude',
    model: '',
    color: '#ff0000',
    name: id,
    displayName: id,
    workspacePath: '/test',
    x,
    y,
    status: 'online',
    attachedFolderId,
  });

  test('returns empty array when no agents attached', () => {
    const folder = buildFolder({ id: 'f1', x: 100, y: 100 });
    const agents = [buildAgent('a1', 200, 200), buildAgent('a2', 300, 300)];
    const angles = getAttachedAgentAngles(folder, agents);
    expect(angles).toEqual([]);
  });

  test('returns angles for attached agents', () => {
    const folder = buildFolder({ id: 'f1', x: 100, y: 100 });
    const folderCenter = getFolderCenter(folder);
    const agentRadius = getAgentRadius();
    const attachedAgent = buildAgent(
      'a1',
      folderCenter.x + 50 - agentRadius,
      folderCenter.y - agentRadius,
      'f1'
    );
    const angles = getAttachedAgentAngles(folder, [attachedAgent]);
    expect(angles).toHaveLength(1);
    expect(angles[0]).toBeCloseTo(0, 0);
  });

  test('excludes specified agents from result', () => {
    const folder = buildFolder({ id: 'f1', x: 100, y: 100 });
    const folderCenter = getFolderCenter(folder);
    const agentRadius = getAgentRadius();
    const agent1 = buildAgent('a1', folderCenter.x + 50 - agentRadius, folderCenter.y - agentRadius, 'f1');
    const agent2 = buildAgent('a2', folderCenter.x - agentRadius, folderCenter.y + 50 - agentRadius, 'f1');
    const angles = getAttachedAgentAngles(folder, [agent1, agent2], new Set(['a1']));
    expect(angles).toHaveLength(1);
    expect(angles[0]).toBeCloseTo(90, 0);
  });
});

describe('getOccupiedAttachAngles', () => {
  const buildAgent = (id: string, x: number, y: number, attachedFolderId?: string): Agent => ({
    id,
    provider: 'claude',
    model: '',
    color: '#ff0000',
    name: id,
    displayName: id,
    workspacePath: '/test',
    x,
    y,
    status: 'online',
    attachedFolderId,
  });

  test('includes incoming move+attach intents when enabled', () => {
    const folder = buildFolder({ id: 'f1', x: 100, y: 100 });
    const folderCenter = getFolderCenter(folder);
    const agentRadius = getAgentRadius();
    const movingAgent = buildAgent('moving', 0, 0);
    movingAgent.movementIntent = {
      startPos: { x: 0, y: 0 },
      targetPos: { x: folderCenter.x + 40 - agentRadius, y: folderCenter.y - agentRadius },
      startTime: Date.now(),
      duration: 1000,
      intentType: 'move+attach',
      targetId: folder.id,
    };

    const withoutIncoming = getOccupiedAttachAngles(folder, [movingAgent], { includePendingAttach: false });
    const withIncoming = getOccupiedAttachAngles(folder, [movingAgent], { includePendingAttach: true });

    expect(withoutIncoming).toEqual([]);
    expect(withIncoming).toHaveLength(1);
    expect(withIncoming[0]).toBeCloseTo(0, 0);
  });
});

describe('resolveAttachSlot', () => {
  test('finds a new slot when desired source angle is occupied', () => {
    const folder = buildFolder({ id: 'f1', x: 100, y: 100 });
    const occupiedPos = getAttachSlotPosition(folder, 0);
    const existing: Agent = {
      id: 'a1',
      provider: 'claude',
      model: '',
      color: '#f00',
      name: 'a1',
      displayName: 'a1',
      workspacePath: '/test',
      x: occupiedPos.x,
      y: occupiedPos.y,
      status: 'online',
      attachedFolderId: folder.id,
    };

    const resolved = resolveAttachSlot(folder, occupiedPos, [existing], {
      includePendingAttach: true,
    });

    expect(resolved.position).not.toEqual(occupiedPos);
  });
});

describe('resolveIncrementalAttachSlot', () => {
  test('keeps existing attached agents fixed and picks an open nearby slot', () => {
    const folder = buildFolder({ id: 'folder-1', x: 100, y: 100 });
    const occupiedA = getAttachSlotPosition(folder, 0);
    const occupiedB = getAttachSlotPosition(folder, 30);

    const resolved = resolveIncrementalAttachSlot(folder, { x: occupiedA.x, y: occupiedA.y }, [
      { x: occupiedA.x, y: occupiedA.y },
      { x: occupiedB.x, y: occupiedB.y },
    ]);

    expect(resolved).not.toBeNull();
    const pos = resolved!.position;
    expect(pos).not.toEqual(occupiedA);
    expect(pos).not.toEqual(occupiedB);
    expect(distance(getAgentCenter(pos), getAgentCenter(occupiedA))).toBeGreaterThan(
      WORKSPACE_CONSTANTS.AGENT_TOKEN_SIZE_PX - 1
    );
    expect(distance(getAgentCenter(pos), getAgentCenter(occupiedB))).toBeGreaterThan(
      WORKSPACE_CONSTANTS.AGENT_TOKEN_SIZE_PX - 1
    );
  });
});

describe('distance calculation', () => {
  test('returns correct euclidean distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distance({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
    expect(distance({ x: -1, y: -1 }, { x: 2, y: 3 })).toBe(5);
  });
});

describe('getAngleDeg', () => {
  test('returns correct angles in degrees', () => {
    const center = { x: 0, y: 0 };
    expect(getAngleDeg(center, { x: 1, y: 0 })).toBeCloseTo(0);
    expect(getAngleDeg(center, { x: 0, y: 1 })).toBeCloseTo(90);
    expect(getAngleDeg(center, { x: -1, y: 0 })).toBeCloseTo(180);
    expect(getAngleDeg(center, { x: 0, y: -1 })).toBeCloseTo(-90);
  });
});

describe('findNearestFolderInAttachRange', () => {
  test('returns null when no folders in range', () => {
    const pos = { x: 0, y: 0 };
    const folder = buildFolder({ x: 1000, y: 1000 });
    expect(findNearestFolderInAttachRange(pos, [folder])).toBeNull();
  });

  test('returns nearest folder when multiple in range', () => {
    const pos = { x: 100, y: 100 };
    const folder1 = buildFolder({ id: 'f1', x: 90, y: 90 });
    const folder2 = buildFolder({ id: 'f2', x: 110, y: 110 });
    const nearest = findNearestFolderInAttachRange(pos, [folder1, folder2]);
    expect(nearest?.id).toBe('f1');
  });
});

describe('getAttachSlotPosition', () => {
  test('returns position at specified angle', () => {
    const folder = buildFolder({ x: 100, y: 100 });
    const pos0 = getAttachSlotPosition(folder, 0);
    const pos90 = getAttachSlotPosition(folder, 90);
    const pos180 = getAttachSlotPosition(folder, 180);
    const pos270 = getAttachSlotPosition(folder, 270);

    expect(pos0.x).toBeGreaterThan(pos180.x);
    expect(pos90.y).toBeGreaterThan(pos270.y);
  });
});

describe('center calculations', () => {
  test('getAgentCenter returns correct center', () => {
    const pos = { x: 100, y: 100 };
    const center = getAgentCenter(pos);
    const radius = getAgentRadius();
    expect(center.x).toBe(pos.x + radius);
    expect(center.y).toBe(pos.y + radius);
  });

  test('getFolderCenter returns correct center', () => {
    const folder = buildFolder({ x: 100, y: 100 });
    const center = getFolderCenter(folder);
    const radius = getFolderRadius();
    expect(center.x).toBe(folder.x + radius);
    expect(center.y).toBe(folder.y + radius);
  });
});

describe('layoutAttachedAgents', () => {
  const buildAgent = (id: string, x: number, y: number): Agent => ({
    id,
    provider: 'claude',
    model: '',
    color: '#ff0000',
    name: id,
    displayName: id,
    workspacePath: '/test',
    x,
    y,
    status: 'online',
    attachedFolderId: 'folder-1',
  });

  test('redistributes overlapping attached agents to non-overlapping slots', () => {
    const folder = buildFolder({ id: 'folder-1', x: 100, y: 100 });
    const stackedPos = getAttachSlotPosition(folder, 0);
    const agents = [
      buildAgent('a1', stackedPos.x, stackedPos.y),
      buildAgent('a2', stackedPos.x, stackedPos.y),
    ];

    const layout = layoutAttachedAgents(folder, agents);
    const p1 = layout.get('a1')?.position;
    const p2 = layout.get('a2')?.position;
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    expect(p1).not.toEqual(p2);
    expect(distance(getAgentCenter(p1!), getAgentCenter(p2!))).toBeGreaterThan(
      WORKSPACE_CONSTANTS.AGENT_TOKEN_SIZE_PX - 1
    );
  });

  test('expands to additional rings without overlap when many agents are attached', () => {
    const folder = buildFolder({ id: 'folder-1', x: 100, y: 100 });
    const folderCenter = getFolderCenter(folder);
    const agentRadius = getAgentRadius();
    const agents = Array.from({ length: 16 }, (_, index) =>
      buildAgent(`a${index}`, folderCenter.x - agentRadius, folderCenter.y - agentRadius)
    );

    const layout = layoutAttachedAgents(folder, agents);
    expect(layout.size).toBe(16);
    const points = agents.map((agent) => layout.get(agent.id)?.position).filter(Boolean) as Array<{
      x: number;
      y: number;
    }>;
    points.forEach((pointA, i) => {
      points.slice(i + 1).forEach((pointB) => {
        const separation = distance(getAgentCenter(pointA), getAgentCenter(pointB));
        expect(separation).toBeGreaterThan(WORKSPACE_CONSTANTS.AGENT_TOKEN_SIZE_PX - 1);
      });
    });
  });
});
