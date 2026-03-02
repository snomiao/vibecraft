import type { CanvasCameraState } from '../canvas/types';

type CameraListener = () => void;

const areCamerasEqual = (left: CanvasCameraState, right: CanvasCameraState): boolean =>
  left.zoom === right.zoom &&
  left.pan.x === right.pan.x &&
  left.pan.y === right.pan.y &&
  left.viewport.width === right.viewport.width &&
  left.viewport.height === right.viewport.height;

export interface CameraStore {
  getSnapshot: () => CanvasCameraState;
  subscribe: (listener: CameraListener) => () => void;
  setSnapshot: (next: CanvasCameraState) => void;
}

export const createCameraStore = (initial: CanvasCameraState): CameraStore => {
  let snapshot = initial;
  const listeners = new Set<CameraListener>();

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setSnapshot: (next) => {
      if (areCamerasEqual(snapshot, next)) return;
      snapshot = next;
      listeners.forEach((listener) => listener());
    },
  };
};
