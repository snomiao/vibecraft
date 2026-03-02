import { bench, describe } from 'vitest';
import {
  computeMinimapBounds,
  worldRectToMinimapPercent,
  type WorldPoint,
  type WorldRect,
} from '../../../src/renderer/components/minimap/minimapMath';
import {
  resolveDragSelection,
  type SelectionCandidate,
} from '../../../src/renderer/screens/workspace/selection';

const selectionCandidates: SelectionCandidate[] = Array.from({ length: 2500 }, (_, index) => ({
  id: `entity-${index}`,
  type: index % 7 === 0 ? 'folder' : index % 5 === 0 ? 'browser' : 'agent',
  center: {
    x: (index % 100) * 32,
    y: Math.floor(index / 100) * 28,
  },
  zIndex: (index % 12) * 100,
  order: index,
}));

const dragRect = {
  left: 400,
  right: 2100,
  top: 200,
  bottom: 1100,
};

const dragStart = { x: 512, y: 512 };

const buildingRects: WorldRect[] = Array.from({ length: 360 }, (_, index) => ({
  x: (index % 30) * 180,
  y: Math.floor(index / 30) * 140,
  width: 120 + (index % 4) * 30,
  height: 90 + (index % 3) * 20,
}));

const unitPoints: WorldPoint[] = Array.from({ length: 520 }, (_, index) => ({
  x: (index % 40) * 120 + (index % 3) * 12,
  y: Math.floor(index / 40) * 96 + (index % 5) * 7,
}));

const minimapBounds = computeMinimapBounds({ buildingRects, unitPoints });

describe('workspace hot path benchmarks', () => {
  bench('resolveDragSelection (2.5k candidates)', () => {
    resolveDragSelection(selectionCandidates, dragRect, dragStart);
  });

  bench('computeMinimapBounds (360 buildings + 520 units)', () => {
    computeMinimapBounds({ buildingRects, unitPoints });
  });

  bench('worldRectToMinimapPercent (360 rects)', () => {
    for (const rect of buildingRects) {
      worldRectToMinimapPercent(rect, minimapBounds, false);
    }
  });
});
