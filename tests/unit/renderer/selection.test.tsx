import { describe, expect, it } from 'vitest';
import {
  buildSelectionRect,
  isDragSelection,
  isPointInRect,
  mergeAgentSelection,
  resolveAgentDragEndSelection,
  resolveDragSelection,
} from '../../../src/renderer/screens/workspace/selection';
import type { SelectedEntityRef } from '../../../src/shared/types';

const rect = buildSelectionRect({ x: 0, y: 0 }, { x: 10, y: 10 });

describe('buildSelectionRect', () => {
  it('normalizes coordinates when start is top-left of end', () => {
    const result = buildSelectionRect({ x: 0, y: 0 }, { x: 10, y: 10 });
    expect(result).toEqual({ left: 0, right: 10, top: 0, bottom: 10 });
  });

  it('normalizes coordinates when start is bottom-right of end', () => {
    const result = buildSelectionRect({ x: 10, y: 10 }, { x: 0, y: 0 });
    expect(result).toEqual({ left: 0, right: 10, top: 0, bottom: 10 });
  });

  it('normalizes coordinates with diagonal drag (bottom-left to top-right)', () => {
    const result = buildSelectionRect({ x: 0, y: 10 }, { x: 10, y: 0 });
    expect(result).toEqual({ left: 0, right: 10, top: 0, bottom: 10 });
  });

  it('handles negative coordinates', () => {
    const result = buildSelectionRect({ x: -5, y: -5 }, { x: 5, y: 5 });
    expect(result).toEqual({ left: -5, right: 5, top: -5, bottom: 5 });
  });
});

describe('isPointInRect', () => {
  it('returns true for point inside rect', () => {
    expect(isPointInRect({ x: 5, y: 5 }, rect)).toBe(true);
  });

  it('returns true for point on rect boundary', () => {
    expect(isPointInRect({ x: 0, y: 0 }, rect)).toBe(true);
    expect(isPointInRect({ x: 10, y: 10 }, rect)).toBe(true);
    expect(isPointInRect({ x: 0, y: 10 }, rect)).toBe(true);
    expect(isPointInRect({ x: 10, y: 0 }, rect)).toBe(true);
  });

  it('returns false for point outside rect', () => {
    expect(isPointInRect({ x: -1, y: 5 }, rect)).toBe(false);
    expect(isPointInRect({ x: 11, y: 5 }, rect)).toBe(false);
    expect(isPointInRect({ x: 5, y: -1 }, rect)).toBe(false);
    expect(isPointInRect({ x: 5, y: 11 }, rect)).toBe(false);
  });
});

describe('selection utilities', () => {
  it('respects the drag threshold', () => {
    expect(isDragSelection({ x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false);
    expect(isDragSelection({ x: 0, y: 0 }, { x: 5, y: 0 })).toBe(true);
  });

  it('prioritizes agents over other entities', () => {
    const result = resolveDragSelection(
      [
        { id: 'agent-1', type: 'agent', center: { x: 5, y: 5 }, zIndex: 0, order: 0 },
        { id: 'folder-1', type: 'folder', center: { x: 6, y: 6 }, zIndex: 5, order: 1 },
      ],
      rect,
      { x: 2, y: 2 }
    );

    expect(result.agentIds).toEqual(['agent-1']);
    expect(result.nonAgent).toBeNull();
  });

  it('selects the closest non-agent when no agents are hit', () => {
    const result = resolveDragSelection(
      [
        { id: 'folder-near', type: 'folder', center: { x: 2, y: 2 }, zIndex: 0, order: 0 },
        { id: 'folder-far', type: 'folder', center: { x: 8, y: 8 }, zIndex: 0, order: 1 },
      ],
      rect,
      { x: 0, y: 0 }
    );

    expect(result.agentIds).toEqual([]);
    expect(result.nonAgent?.id).toBe('folder-near');
  });

  it('breaks non-agent ties by z-index', () => {
    const result = resolveDragSelection(
      [
        { id: 'folder-low', type: 'folder', center: { x: 1, y: 1 }, zIndex: 1, order: 0 },
        { id: 'folder-high', type: 'folder', center: { x: -1, y: -1 }, zIndex: 5, order: 1 },
      ],
      buildSelectionRect({ x: -5, y: -5 }, { x: 5, y: 5 }),
      { x: 0, y: 0 }
    );

    expect(result.nonAgent?.id).toBe('folder-high');
  });

  it('selects hero when it is the closest non-agent', () => {
    const result = resolveDragSelection(
      [
        { id: 'hero', type: 'hero', center: { x: 3, y: 3 }, zIndex: 0, order: 0 },
        { id: 'folder', type: 'folder', center: { x: 9, y: 9 }, zIndex: 0, order: 1 },
      ],
      rect,
      { x: 0, y: 0 }
    );

    expect(result.nonAgent?.id).toBe('hero');
  });

  it('prioritizes hero over buildings even when farther', () => {
    const result = resolveDragSelection(
      [
        { id: 'hero', type: 'hero', center: { x: 8, y: 8 }, zIndex: 0, order: 0 },
        { id: 'folder', type: 'folder', center: { x: 2, y: 2 }, zIndex: 0, order: 1 },
        { id: 'browser', type: 'browser', center: { x: 3, y: 3 }, zIndex: 0, order: 2 },
      ],
      rect,
      { x: 0, y: 0 }
    );

    expect(result.nonAgent?.id).toBe('hero');
  });

  it('merges agent selections when additive', () => {
    expect(mergeAgentSelection(['b'], ['a'], true).sort()).toEqual(['a', 'b']);
    expect(mergeAgentSelection(['b'], ['a'], false)).toEqual(['b']);
  });

  it('resolves drag end selection to all selected agents when dragging within a group', () => {
    const selectedEntity: SelectedEntityRef = { type: 'agent', id: 'agent-1' };
    const result = resolveAgentDragEndSelection(['agent-1', 'agent-2'], selectedEntity, 'agent-1');

    expect(result).toEqual(['agent-1', 'agent-2']);
  });

  it('resolves drag end selection to the anchor when no multi-selection exists', () => {
    const result = resolveAgentDragEndSelection([], null, 'agent-3');
    expect(result).toEqual(['agent-3']);
  });

  it('returns empty result when no candidates are in the selection rect', () => {
    const result = resolveDragSelection(
      [
        { id: 'agent-1', type: 'agent', center: { x: 100, y: 100 }, zIndex: 0, order: 0 },
        { id: 'folder-1', type: 'folder', center: { x: 200, y: 200 }, zIndex: 0, order: 1 },
      ],
      rect,
      { x: 0, y: 0 }
    );

    expect(result.agentIds).toEqual([]);
    expect(result.nonAgent).toBeNull();
  });

  it('returns empty result when candidates array is empty', () => {
    const result = resolveDragSelection([], rect, { x: 0, y: 0 });
    expect(result.agentIds).toEqual([]);
    expect(result.nonAgent).toBeNull();
  });

  it('selects all agents in rect when multiple are present', () => {
    const result = resolveDragSelection(
      [
        { id: 'agent-1', type: 'agent', center: { x: 2, y: 2 }, zIndex: 0, order: 0 },
        { id: 'agent-2', type: 'agent', center: { x: 5, y: 5 }, zIndex: 0, order: 1 },
        { id: 'agent-3', type: 'agent', center: { x: 8, y: 8 }, zIndex: 0, order: 2 },
        { id: 'folder-1', type: 'folder', center: { x: 6, y: 6 }, zIndex: 5, order: 3 },
      ],
      rect,
      { x: 0, y: 0 }
    );

    expect(result.agentIds.sort()).toEqual(['agent-1', 'agent-2', 'agent-3']);
    expect(result.nonAgent).toBeNull();
  });

  it('mergeAgentSelection removes duplicates in incoming ids', () => {
    const result = mergeAgentSelection(['a', 'a', 'b', 'b'], [], false);
    expect(result.sort()).toEqual(['a', 'b']);
  });

  it('mergeAgentSelection handles empty incoming ids', () => {
    const result = mergeAgentSelection([], ['existing'], true);
    expect(result).toEqual(['existing']);
  });

  it('mergeAgentSelection handles both arrays empty', () => {
    const result = mergeAgentSelection([], [], true);
    expect(result).toEqual([]);
  });

  it('breaks non-agent ties by order when distance and z-index are equal', () => {
    const result = resolveDragSelection(
      [
        { id: 'folder-first', type: 'folder', center: { x: 5, y: 5 }, zIndex: 1, order: 0 },
        { id: 'folder-second', type: 'folder', center: { x: 5, y: 5 }, zIndex: 1, order: 1 },
      ],
      rect,
      { x: 5, y: 5 }
    );

    expect(result.nonAgent?.id).toBe('folder-second');
  });

  it('resolves drag end to anchor when anchor is not in selection', () => {
    const selectedEntity: SelectedEntityRef = { type: 'agent', id: 'agent-1' };
    const result = resolveAgentDragEndSelection(['agent-1', 'agent-2'], selectedEntity, 'agent-3');

    expect(result).toEqual(['agent-3']);
  });

  it('uses selectedEntity as fallback when selectedAgentIds is empty', () => {
    const selectedEntity: SelectedEntityRef = { type: 'agent', id: 'agent-selected' };
    const result = resolveAgentDragEndSelection([], selectedEntity, 'agent-selected');

    expect(result).toEqual(['agent-selected']);
  });

  it('ignores selectedEntity when its type is not agent', () => {
    const selectedEntity: SelectedEntityRef = { type: 'folder', id: 'folder-1' };
    const result = resolveAgentDragEndSelection([], selectedEntity, 'agent-1');

    expect(result).toEqual(['agent-1']);
  });
});
