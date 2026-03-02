import type { EntityType, SelectedEntityRef } from '../../../shared/types';
import { SELECTION_DRAG_THRESHOLD_PX } from './constants';

export type Point = { x: number; y: number };
export type SelectionRect = { left: number; right: number; top: number; bottom: number };

export type SelectionCandidate = {
  id: string;
  type: EntityType;
  center: Point;
  zIndex: number;
  order: number;
};

export type DragSelectionResult =
  | { agentIds: string[]; nonAgent: null }
  | { agentIds: []; nonAgent: SelectionCandidate | null };

export const buildSelectionRect = (start: Point, end: Point): SelectionRect => ({
  left: Math.min(start.x, end.x),
  right: Math.max(start.x, end.x),
  top: Math.min(start.y, end.y),
  bottom: Math.max(start.y, end.y),
});

export const isPointInRect = (point: Point, rect: SelectionRect): boolean =>
  point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;

export const isDragSelection = (
  start: Point,
  end: Point,
  thresholdPx: number = SELECTION_DRAG_THRESHOLD_PX
): boolean => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return Math.hypot(dx, dy) > thresholdPx;
};

const distance = (a: Point, b: Point): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
};

const pickClosest = (candidates: SelectionCandidate[], dragStart: Point): SelectionCandidate => {
  return candidates.reduce((best, candidate) => {
    const bestDistance = distance(best.center, dragStart);
    const candidateDistance = distance(candidate.center, dragStart);
    if (candidateDistance < bestDistance) return candidate;
    if (candidateDistance > bestDistance) return best;
    if (candidate.zIndex > best.zIndex) return candidate;
    if (candidate.zIndex < best.zIndex) return best;
    return candidate.order > best.order ? candidate : best;
  });
};

export const resolveDragSelection = (
  candidates: SelectionCandidate[],
  rect: SelectionRect,
  dragStart: Point
): DragSelectionResult => {
  const hits = candidates.filter((candidate) => isPointInRect(candidate.center, rect));
  const agents = hits.filter((candidate) => candidate.type === 'agent');

  if (agents.length > 0) {
    return {
      agentIds: agents.map((agent) => agent.id),
      nonAgent: null,
    };
  }

  if (hits.length === 0) {
    return { agentIds: [], nonAgent: null };
  }

  const heroes = hits.filter((candidate) => candidate.type === 'hero');
  if (heroes.length > 0) {
    return { agentIds: [], nonAgent: pickClosest(heroes, dragStart) };
  }

  const nonAgents = hits.filter((candidate) => candidate.type !== 'agent');
  if (nonAgents.length === 0) {
    return { agentIds: [], nonAgent: null };
  }

  return { agentIds: [], nonAgent: pickClosest(nonAgents, dragStart) };
};

export const mergeAgentSelection = (
  incomingIds: string[],
  existingAgentIds: string[],
  additive: boolean
): string[] => {
  if (!additive) {
    return [...new Set(incomingIds)];
  }

  const next = new Set(existingAgentIds);
  incomingIds.forEach((id) => next.add(id));
  return Array.from(next);
};

export const resolveAgentDragEndSelection = (
  selectedAgentIds: string[],
  selectedEntity: SelectedEntityRef | null,
  anchorId: string
): string[] => {
  const selectionIds =
    selectedAgentIds.length > 0
      ? selectedAgentIds
      : selectedEntity?.type === 'agent'
        ? [selectedEntity.id]
        : [];
  if (selectionIds.length > 1 && selectionIds.includes(anchorId)) {
    return selectionIds;
  }
  return [anchorId];
};
