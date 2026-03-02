import type { CanvasCameraState } from '../canvas/types';

export type WorldPoint = { x: number; y: number };
export type WorldRect = { x: number; y: number; width: number; height: number };

export type MinimapBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
};

export type MinimapPercentPoint = { x: number; y: number };
export type MinimapPercentRect = { x: number; y: number; width: number; height: number };

export const MINIMAP_MIN_SIZE = { width: 2000, height: 1500 };
export const MINIMAP_MARGIN_RATIO = 0.05;
export const MINIMAP_MIN_MARGIN = { x: 128, y: 96 };

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const boundsFromRects = (rects: WorldRect[]): MinimapBounds | null => {
  if (rects.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  rects.forEach((rect) => {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  });

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

const boundsFromPoints = (points: WorldPoint[]): MinimapBounds | null => {
  if (points.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  points.forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

const applyMinSize = (bounds: MinimapBounds, minSize: { width: number; height: number }): MinimapBounds => {
  let { minX, maxX, minY, maxY } = bounds;
  const width = maxX - minX;
  const height = maxY - minY;

  if (width < minSize.width) {
    const centerX = (minX + maxX) / 2;
    minX = centerX - minSize.width / 2;
    maxX = centerX + minSize.width / 2;
  }

  if (height < minSize.height) {
    const centerY = (minY + maxY) / 2;
    minY = centerY - minSize.height / 2;
    maxY = centerY + minSize.height / 2;
  }

  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

export type MinimapBoundsParams = {
  buildingRects: WorldRect[];
  unitPoints?: WorldPoint[];
  minSize?: { width: number; height: number };
  marginRatio?: number;
  minMargin?: { x: number; y: number };
};

export const computeMinimapBounds = ({
  buildingRects,
  unitPoints = [],
  minSize = MINIMAP_MIN_SIZE,
  marginRatio = MINIMAP_MARGIN_RATIO,
  minMargin = MINIMAP_MIN_MARGIN,
}: MinimapBoundsParams): MinimapBounds => {
  const baseBounds = boundsFromRects(buildingRects) ?? boundsFromPoints(unitPoints);
  let bounds: MinimapBounds = baseBounds ?? {
    minX: -minSize.width / 2,
    minY: -minSize.height / 2,
    maxX: minSize.width / 2,
    maxY: minSize.height / 2,
    width: minSize.width,
    height: minSize.height,
  };

  const marginX = Math.max(bounds.width * marginRatio, minMargin.x);
  const marginY = Math.max(bounds.height * marginRatio, minMargin.y);

  bounds = {
    minX: bounds.minX - marginX,
    minY: bounds.minY - marginY,
    maxX: bounds.maxX + marginX,
    maxY: bounds.maxY + marginY,
    width: bounds.width + marginX * 2,
    height: bounds.height + marginY * 2,
  };

  unitPoints.forEach((point) => {
    if (point.x < bounds.minX) bounds.minX = point.x;
    if (point.x > bounds.maxX) bounds.maxX = point.x;
    if (point.y < bounds.minY) bounds.minY = point.y;
    if (point.y > bounds.maxY) bounds.maxY = point.y;
  });

  bounds.width = bounds.maxX - bounds.minX;
  bounds.height = bounds.maxY - bounds.minY;

  return applyMinSize(bounds, minSize);
};

export const worldPointToMinimapPercent = (
  point: WorldPoint,
  bounds: MinimapBounds,
  clampToBounds = true
): MinimapPercentPoint => {
  const x = ((point.x - bounds.minX) / bounds.width) * 100;
  const y = ((point.y - bounds.minY) / bounds.height) * 100;
  return {
    x: clampToBounds ? clamp(x, 0, 100) : x,
    y: clampToBounds ? clamp(y, 0, 100) : y,
  };
};

export const worldRectToMinimapPercent = (
  rect: WorldRect,
  bounds: MinimapBounds,
  clampToBounds = true
): MinimapPercentRect => {
  const origin = worldPointToMinimapPercent({ x: rect.x, y: rect.y }, bounds, clampToBounds);
  return {
    x: origin.x,
    y: origin.y,
    width: (rect.width / bounds.width) * 100,
    height: (rect.height / bounds.height) * 100,
  };
};

export const minimapPercentToWorld = (point: MinimapPercentPoint, bounds: MinimapBounds): WorldPoint => ({
  x: bounds.minX + (point.x / 100) * bounds.width,
  y: bounds.minY + (point.y / 100) * bounds.height,
});

export const getVisibleWorldRect = (camera: CanvasCameraState): WorldRect => {
  const { pan, zoom, viewport } = camera;
  const left = -pan.x / zoom;
  const top = -pan.y / zoom;
  return {
    x: left,
    y: top,
    width: viewport.width / zoom,
    height: viewport.height / zoom,
  };
};
