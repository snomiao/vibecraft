import React from 'react';

export interface CanvasTransform {
  zoom: number;
}

export const CanvasTransformContext = React.createContext<CanvasTransform>({
  zoom: 1,
});

export function useCanvasTransform(): CanvasTransform {
  return React.useContext(CanvasTransformContext);
}
