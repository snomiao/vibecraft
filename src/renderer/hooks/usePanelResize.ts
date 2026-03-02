import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useCanvasTransform } from '../components/canvas/CanvasContext';

interface PanelSize {
  width: number;
  height: number;
}

interface UsePanelResizeOptions {
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  onResize?: (size: PanelSize) => void;
  onResizeEnd?: (size: PanelSize) => void;
}

interface UsePanelResizeReturn {
  size: PanelSize;
  startResize: (event: ReactMouseEvent) => void;
  isResizing: boolean;
}

export function usePanelResize({
  width,
  height,
  minWidth = 400,
  minHeight = 300,
  onResize,
  onResizeEnd,
}: UsePanelResizeOptions): UsePanelResizeReturn {
  const [size, setSize] = useState<PanelSize>({ width, height });
  const [isResizing, setIsResizing] = useState(false);
  const latestSizeRef = useRef<PanelSize>(size);
  const optionsRef = useRef({
    minWidth,
    minHeight,
    onResize,
    onResizeEnd,
  });
  const { zoom } = useCanvasTransform();

  useEffect(() => {
    optionsRef.current = { minWidth, minHeight, onResize, onResizeEnd };
  }, [minWidth, minHeight, onResize, onResizeEnd]);

  useEffect(() => {
    if (isResizing) {
      return;
    }
    const nextSize = { width, height };
    latestSizeRef.current = nextSize;
    setSize(nextSize);
  }, [width, height, isResizing]);

  const startResize = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = latestSizeRef.current.width;
      const startHeight = latestSizeRef.current.height;
      const currentZoom = zoom;

      setIsResizing(true);

      const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
        const { minWidth: minW, minHeight: minH, onResize: resizeCb } = optionsRef.current;
        const deltaX = (moveEvent.clientX - startX) / currentZoom;
        const deltaY = (moveEvent.clientY - startY) / currentZoom;

        const nextSize = {
          width: Math.max(minW ?? 0, startWidth + deltaX),
          height: Math.max(minH ?? 0, startHeight + deltaY),
        };

        latestSizeRef.current = nextSize;
        setSize(nextSize);
        resizeCb?.(nextSize);
      };

      const handleMouseUp = () => {
        const { onResizeEnd: resizeEndCb } = optionsRef.current;
        setIsResizing(false);
        resizeEndCb?.(latestSizeRef.current);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [zoom]
  );

  return {
    size,
    startResize,
    isResizing,
  };
}
