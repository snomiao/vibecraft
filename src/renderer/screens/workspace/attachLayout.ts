import type { Agent, Folder, Position } from '../../../shared/types';
import * as WORKSPACE_CONSTANTS from './constants';

export type Bounds = { x: number; y: number; width: number; height: number };
type OccupiedAttachAngleOptions = {
  excludeIds?: Set<string>;
  includePendingAttach?: boolean;
};
type AttachLayoutEntry = {
  id: string;
  preferredAngleDeg: number;
};
type AttachLayoutResult = {
  angleDeg: number;
  radiusPx: number;
  position: Position;
};

const ANGLE_EPS_DEG = 0.5;
const TAU = Math.PI * 2;
const MIN_ATTACH_ANGLE_RAD = 0.045;
const ATTACH_CHORD_MARGIN_PX = 12;
const MAX_ATTACH_RINGS = 8;

export const getAgentRadius = () => WORKSPACE_CONSTANTS.AGENT_TOKEN_SIZE_PX / 2;
export const getHeroRadius = () => WORKSPACE_CONSTANTS.HERO_TOKEN_SIZE_PX / 2;
export const getFolderRadius = () => WORKSPACE_CONSTANTS.FOLDER_ICON_SIZE_PX / 2;

export const getAgentCenter = (pos: Position): Position => ({
  x: pos.x + getAgentRadius(),
  y: pos.y + getAgentRadius(),
});

export const getHeroCenter = (pos: Position): Position => ({
  x: pos.x + getHeroRadius(),
  y: pos.y + getHeroRadius(),
});

export const getFolderCenter = (folder: Folder): Position => ({
  x: folder.x + getFolderRadius(),
  y: folder.y + getFolderRadius(),
});

export const getAgentBounds = (pos: Position): Bounds => ({
  x: pos.x,
  y: pos.y,
  width: WORKSPACE_CONSTANTS.AGENT_TOKEN_SIZE_PX,
  height: WORKSPACE_CONSTANTS.AGENT_TOKEN_SIZE_PX,
});

export const getFolderBounds = (folder: Folder): Bounds => ({
  x: folder.x,
  y: folder.y,
  width: WORKSPACE_CONSTANTS.FOLDER_ICON_SIZE_PX,
  height: WORKSPACE_CONSTANTS.FOLDER_ICON_SIZE_PX,
});

export const distance = (a: Position, b: Position): number => Math.hypot(a.x - b.x, a.y - b.y);

export const getAngleDeg = (from: Position, to: Position): number =>
  (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;

export const getAngleRad = (from: Position, to: Position): number => Math.atan2(to.y - from.y, to.x - from.x);

export const normalizeAngleDeg = (angle: number): number => {
  const normalized = angle % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const anglesMatch = (a: number, b: number) => {
  const diff = Math.abs(normalizeAngleDeg(a - b));
  return diff < ANGLE_EPS_DEG || Math.abs(diff - 360) < ANGLE_EPS_DEG;
};

/**
 * The gravity radius - when agent center is within this distance of folder center,
 * the agent snaps to the attach position.
 */
export const getGravityRadius = (): number => WORKSPACE_CONSTANTS.FOLDER_SNAP_GRAVITY_RADIUS_PX;

/**
 * Calculate the agent's top-left position when snapped at a given angle.
 */
export const getSnapPosition = (folder: Folder, angleRad: number): Position => {
  const folderCenter = getFolderCenter(folder);
  const snapOffset = WORKSPACE_CONSTANTS.FOLDER_ATTACH_DISTANCE_PX;
  const agentRadius = getAgentRadius();
  return {
    x: folderCenter.x + Math.cos(angleRad) * snapOffset - agentRadius,
    y: folderCenter.y + Math.sin(angleRad) * snapOffset - agentRadius,
  };
};

export const getAttachSlotPositionAtRadius = (
  folder: Folder,
  angleDeg: number,
  radiusPx: number = WORKSPACE_CONSTANTS.FOLDER_ATTACH_DISTANCE_PX
): Position => {
  const angleRad = (angleDeg * Math.PI) / 180;
  const folderCenter = getFolderCenter(folder);
  const agentRadius = getAgentRadius();
  return {
    x: folderCenter.x + Math.cos(angleRad) * radiusPx - agentRadius,
    y: folderCenter.y + Math.sin(angleRad) * radiusPx - agentRadius,
  };
};

/**
 * Find the nearest folder within gravity range of the given agent position.
 */
export const findNearestFolderInGravity = (agentPos: Position, folders: Folder[]): Folder | null => {
  const agentCenter = getAgentCenter(agentPos);
  const gravityRadius = getGravityRadius();

  let nearest: Folder | null = null;
  let nearestDistance = Infinity;

  for (const folder of folders) {
    const folderCenter = getFolderCenter(folder);
    const dist = distance(agentCenter, folderCenter);
    if (dist <= gravityRadius && dist < nearestDistance) {
      nearest = folder;
      nearestDistance = dist;
    }
  }

  return nearest;
};

/**
 * Check if agent is outside gravity range of its attached folder (should detach).
 */
export const isOutsideGravity = (agentPos: Position, folder: Folder): boolean => {
  const agentCenter = getAgentCenter(agentPos);
  const folderCenter = getFolderCenter(folder);
  return distance(agentCenter, folderCenter) > getGravityRadius();
};

export const findAvailableAttachAngle = (
  baseAngle: number,
  occupiedAngles: number[],
  stepDeg: number = WORKSPACE_CONSTANTS.ATTACH_ANGLE_STEP_DEG
): number => {
  const normalizedBase = normalizeAngleDeg(baseAngle);
  let candidate = normalizedBase;
  const maxSteps = Math.ceil(360 / stepDeg) + occupiedAngles.length + 1;
  for (let i = 0; i < maxSteps; i += 1) {
    const occupied = occupiedAngles.some((angle) => anglesMatch(angle, candidate));
    if (!occupied) return candidate;
    candidate = normalizeAngleDeg(candidate + stepDeg);
  }
  return normalizedBase;
};

/**
 * Get the attach slot position for right-click movement to a folder.
 * Uses the same snap offset as drag-to-attach.
 */
export const getAttachSlotPosition = (folder: Folder, angleDeg: number): Position => {
  return getAttachSlotPositionAtRadius(folder, angleDeg);
};

export const findNearestFolderInAttachRange = (position: Position, folders: Folder[]): Folder | null => {
  const attachRadius = WORKSPACE_CONSTANTS.FOLDER_RIGHT_CLICK_ATTACH_RADIUS_PX;
  let nearest: Folder | null = null;
  let nearestDistance = Infinity;

  for (const folder of folders) {
    const folderCenter = getFolderCenter(folder);
    const dist = distance(position, folderCenter);
    if (dist <= attachRadius && dist < nearestDistance) {
      nearest = folder;
      nearestDistance = dist;
    }
  }

  return nearest;
};

export const getAttachedAgentAngles = (
  folder: Folder,
  agents: Agent[],
  excludeIds: Set<string> = new Set()
): number[] => {
  return getOccupiedAttachAngles(folder, agents, { excludeIds });
};

export const getOccupiedAttachAngles = (
  folder: Folder,
  agents: Agent[],
  options: OccupiedAttachAngleOptions = {}
): number[] => {
  const { excludeIds = new Set(), includePendingAttach = false } = options;
  const center = getFolderCenter(folder);
  const isPendingAttachToFolder = (agent: Agent) =>
    includePendingAttach &&
    agent.movementIntent?.intentType === 'move+attach' &&
    agent.movementIntent.targetId === folder.id;

  return agents
    .filter((agent) => !excludeIds.has(agent.id))
    .filter((agent) => agent.attachedFolderId === folder.id || isPendingAttachToFolder(agent))
    .map((agent) => {
      const sourcePos = isPendingAttachToFolder(agent) ? agent.movementIntent!.targetPos : agent;
      return normalizeAngleDeg(getAngleDeg(center, getAgentCenter(sourcePos)));
    });
};

export const resolveAttachSlot = (
  folder: Folder,
  sourcePos: Position,
  agents: Agent[],
  options: OccupiedAttachAngleOptions & { extraOccupiedAngles?: number[] } = {}
): { angleDeg: number; position: Position } => {
  const occupiedAngles = getOccupiedAttachAngles(folder, agents, options);
  if (options.extraOccupiedAngles?.length) {
    occupiedAngles.push(...options.extraOccupiedAngles);
  }
  const baseAngle = getAngleDeg(getFolderCenter(folder), getAgentCenter(sourcePos));
  const angleDeg = findAvailableAttachAngle(baseAngle, occupiedAngles);
  return {
    angleDeg,
    position: getAttachSlotPosition(folder, angleDeg),
  };
};

const getShortestDiffDeg = (a: number, b: number): number => {
  const diff = Math.abs(normalizeAngleDeg(a - b));
  return diff > 180 ? 360 - diff : diff;
};

const getRingCapacity = (radiusPx: number): number => {
  const seatSpanPx = WORKSPACE_CONSTANTS.AGENT_TOKEN_SIZE_PX + ATTACH_CHORD_MARGIN_PX;
  const chordTerm = Math.min(1, seatSpanPx / Math.max(1, 2 * radiusPx));
  const minDeltaRad = Math.max(2 * Math.asin(chordTerm), MIN_ATTACH_ANGLE_RAD);
  return Math.max(1, Math.floor(TAU / minDeltaRad));
};

const getCircularMeanDeg = (anglesDeg: number[]): number => {
  if (anglesDeg.length === 0) return 0;
  let sumSin = 0;
  let sumCos = 0;
  anglesDeg.forEach((angleDeg) => {
    const rad = (normalizeAngleDeg(angleDeg) * Math.PI) / 180;
    sumSin += Math.sin(rad);
    sumCos += Math.cos(rad);
  });
  if (Math.abs(sumSin) < 1e-6 && Math.abs(sumCos) < 1e-6) {
    return normalizeAngleDeg(anglesDeg[0]);
  }
  return normalizeAngleDeg((Math.atan2(sumSin, sumCos) * 180) / Math.PI);
};

const assignRingSlots = (
  folder: Folder,
  entries: AttachLayoutEntry[],
  radiusPx: number
): Map<string, AttachLayoutResult> => {
  const result = new Map<string, AttachLayoutResult>();
  if (entries.length === 0) return result;

  const capacity = getRingCapacity(radiusPx);
  const seatCount = Math.max(entries.length, capacity);
  const stepDeg = 360 / seatCount;
  const biasDeg = getCircularMeanDeg(entries.map((entry) => entry.preferredAngleDeg));

  const taken = new Array<boolean>(seatCount).fill(false);
  const seatById = new Map<string, number>();

  const toSeatIndex = (angleDeg: number) => {
    const relative = normalizeAngleDeg(angleDeg - biasDeg);
    return Math.round(relative / stepDeg) % seatCount;
  };

  entries.forEach((entry) => {
    const targetIndex = toSeatIndex(entry.preferredAngleDeg);
    if (!taken[targetIndex]) {
      taken[targetIndex] = true;
      seatById.set(entry.id, targetIndex);
      return;
    }

    let bestIndex = targetIndex;
    let bestError = Number.POSITIVE_INFINITY;
    for (let offset = 1; offset < seatCount; offset += 1) {
      const left = (targetIndex - offset + seatCount) % seatCount;
      if (!taken[left]) {
        const leftAngle = normalizeAngleDeg(biasDeg + left * stepDeg);
        const leftError = getShortestDiffDeg(leftAngle, entry.preferredAngleDeg);
        if (leftError < bestError) {
          bestError = leftError;
          bestIndex = left;
        }
      }
      const right = (targetIndex + offset) % seatCount;
      if (!taken[right]) {
        const rightAngle = normalizeAngleDeg(biasDeg + right * stepDeg);
        const rightError = getShortestDiffDeg(rightAngle, entry.preferredAngleDeg);
        if (rightError < bestError) {
          bestError = rightError;
          bestIndex = right;
        }
      }
      if (bestError !== Number.POSITIVE_INFINITY) break;
    }

    taken[bestIndex] = true;
    seatById.set(entry.id, bestIndex);
  });

  entries.forEach((entry) => {
    const seat = seatById.get(entry.id);
    if (seat === undefined) return;
    const angleDeg = normalizeAngleDeg(biasDeg + seat * stepDeg);
    result.set(entry.id, {
      angleDeg,
      radiusPx,
      position: getAttachSlotPositionAtRadius(folder, angleDeg, radiusPx),
    });
  });
  return result;
};

const getAttachRingGap = (): number =>
  Math.max(10, Math.round((WORKSPACE_CONSTANTS.AGENT_TOKEN_SIZE_PX + ATTACH_CHORD_MARGIN_PX) * 0.8));

const buildAngleCandidates = (baseAngleDeg: number, seatCount: number): number[] => {
  const normalizedBase = normalizeAngleDeg(baseAngleDeg);
  const safeSeatCount = Math.max(1, seatCount);
  const stepDeg = 360 / safeSeatCount;
  const baseSeat = Math.round(normalizedBase / stepDeg);
  const angles: number[] = [];
  const seen = new Set<number>();

  const pushSeat = (seatIndex: number) => {
    const angleDeg = normalizeAngleDeg(seatIndex * stepDeg);
    const key = Number(angleDeg.toFixed(6));
    if (seen.has(key)) return;
    seen.add(key);
    angles.push(angleDeg);
  };

  pushSeat(baseSeat);
  for (let offset = 1; offset < safeSeatCount; offset += 1) {
    pushSeat(baseSeat + offset);
    pushSeat(baseSeat - offset);
  }

  return angles;
};

export const resolveIncrementalAttachSlot = (
  folder: Folder,
  sourcePos: Position,
  occupiedAgents: Pick<Agent, 'x' | 'y'>[],
  minSeparationPx: number = WORKSPACE_CONSTANTS.AGENT_TOKEN_SIZE_PX - 1
): AttachLayoutResult | null => {
  const baseAngle = normalizeAngleDeg(getAngleDeg(getFolderCenter(folder), getAgentCenter(sourcePos)));
  const occupiedCenters = occupiedAgents.map((agent) => getAgentCenter(agent));
  const baseRadius = WORKSPACE_CONSTANTS.FOLDER_ATTACH_DISTANCE_PX;
  const ringGap = getAttachRingGap();

  const isPositionFree = (position: Position) =>
    occupiedCenters.every((center) => distance(getAgentCenter(position), center) >= minSeparationPx);

  for (let ring = 0; ring <= MAX_ATTACH_RINGS; ring += 1) {
    const radiusPx = baseRadius + ring * ringGap;
    const seatCount = getRingCapacity(radiusPx);
    const candidateAngles = buildAngleCandidates(baseAngle, seatCount);
    for (const angleDeg of candidateAngles) {
      const position = getAttachSlotPositionAtRadius(folder, angleDeg, radiusPx);
      if (!isPositionFree(position)) continue;
      return {
        angleDeg,
        radiusPx,
        position,
      };
    }
  }

  return null;
};

export const layoutAttachedAgents = (
  folder: Folder,
  agents: Pick<Agent, 'id' | 'x' | 'y'>[]
): Map<string, AttachLayoutResult> => {
  const entries = agents
    .map((agent) => ({
      id: agent.id,
      preferredAngleDeg: normalizeAngleDeg(getAngleDeg(getFolderCenter(folder), getAgentCenter(agent))),
    }))
    .sort((a, b) => a.preferredAngleDeg - b.preferredAngleDeg || a.id.localeCompare(b.id));

  const layout = new Map<string, AttachLayoutResult>();
  if (entries.length === 0) return layout;

  const baseRadius = WORKSPACE_CONSTANTS.FOLDER_ATTACH_DISTANCE_PX;
  const ringGap = getAttachRingGap();

  let cursor = 0;
  for (let ring = 0; cursor < entries.length && ring < MAX_ATTACH_RINGS; ring += 1) {
    const radiusPx = baseRadius + ring * ringGap;
    const capacity = getRingCapacity(radiusPx);
    const ringEntries = entries.slice(cursor, cursor + capacity);
    const ringLayout = assignRingSlots(folder, ringEntries, radiusPx);
    ringLayout.forEach((value, id) => layout.set(id, value));
    cursor += ringEntries.length;
  }

  if (cursor < entries.length) {
    const radiusPx = baseRadius + MAX_ATTACH_RINGS * ringGap;
    const ringLayout = assignRingSlots(folder, entries.slice(cursor), radiusPx);
    ringLayout.forEach((value, id) => layout.set(id, value));
  }

  return layout;
};
