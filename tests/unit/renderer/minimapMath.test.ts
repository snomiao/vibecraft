import { describe, expect, test } from 'vitest';
import {
  computeMinimapBounds,
  getVisibleWorldRect,
  minimapPercentToWorld,
  worldPointToMinimapPercent,
  worldRectToMinimapPercent,
} from '../../../src/renderer/components/minimap/minimapMath';

describe('computeMinimapBounds', () => {
  test('expands building bounds with margin and minimum size', () => {
    const bounds = computeMinimapBounds({
      buildingRects: [{ x: 0, y: 0, width: 100, height: 100 }],
    });

    expect(bounds.minX).toBeCloseTo(-950);
    expect(bounds.maxX).toBeCloseTo(1050);
    expect(bounds.minY).toBeCloseTo(-700);
    expect(bounds.maxY).toBeCloseTo(800);
    expect(bounds.width).toBeCloseTo(2000);
    expect(bounds.height).toBeCloseTo(1500);
  });

  test('extends bounds to include units outside the building envelope', () => {
    const bounds = computeMinimapBounds({
      buildingRects: [{ x: 0, y: 0, width: 100, height: 100 }],
      unitPoints: [{ x: 4000, y: 0 }],
    });

    expect(bounds.minX).toBeCloseTo(-128);
    expect(bounds.maxX).toBeCloseTo(4000);
    expect(bounds.minY).toBeCloseTo(-700);
    expect(bounds.maxY).toBeCloseTo(800);
    expect(bounds.width).toBeCloseTo(4128);
  });
});

describe('minimap coordinate helpers', () => {
  test('maps world points to minimap percentages with clamping', () => {
    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 200, width: 100, height: 200 };

    expect(worldPointToMinimapPercent({ x: 50, y: 100 }, bounds)).toEqual({ x: 50, y: 50 });
    expect(worldPointToMinimapPercent({ x: 150, y: -100 }, bounds)).toEqual({ x: 100, y: 0 });
  });

  test('maps world points without clamping when requested', () => {
    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };

    expect(worldPointToMinimapPercent({ x: 150, y: -50 }, bounds, false)).toEqual({ x: 150, y: -50 });
  });

  test('maps minimap percentages back to world coordinates', () => {
    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 200, width: 100, height: 200 };

    expect(minimapPercentToWorld({ x: 25, y: 50 }, bounds)).toEqual({ x: 25, y: 100 });
  });

  test('converts world rectangles to minimap percentages', () => {
    const bounds = { minX: 0, minY: 0, maxX: 200, maxY: 100, width: 200, height: 100 };
    const rect = { x: 50, y: 25, width: 100, height: 50 };

    expect(worldRectToMinimapPercent(rect, bounds)).toEqual({ x: 25, y: 25, width: 50, height: 50 });
  });

  test('computes visible world rect from camera state', () => {
    const rect = getVisibleWorldRect({
      pan: { x: 100, y: 50 },
      zoom: 2,
      viewport: { width: 800, height: 600 },
    });

    expect(rect).toEqual({ x: -50, y: -25, width: 400, height: 300 });
  });
});
