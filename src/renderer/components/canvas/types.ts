export type CanvasPan = { x: number; y: number };
export type CanvasViewport = { width: number; height: number };

export type CanvasCameraState = {
  pan: CanvasPan;
  zoom: number;
  viewport: CanvasViewport;
};

export type CanvasCameraControls = {
  setCameraCenter: (point: { x: number; y: number }) => void;
};
