import { useEffect, type RefObject } from 'react';
import type { Terminal } from 'xterm';

type MouseCoordsEvent = { clientX: number; clientY: number };
type MouseReportCoords = { col: number; row: number; x: number; y: number };
type MouseService = {
  getCoords: (
    event: MouseCoordsEvent,
    element: HTMLElement,
    colCount: number,
    rowCount: number,
    isSelection?: boolean
  ) => [number, number] | undefined;
  getMouseReportCoords?: (event: MouseCoordsEvent, element: HTMLElement) => MouseReportCoords | undefined;
};

type XtermWithCore = Terminal & {
  _core?: {
    _mouseService?: MouseService;
  };
};

const patchedMouseServices = new WeakSet<MouseService>();

function adjustEventForScale(event: MouseCoordsEvent, element: HTMLElement): MouseCoordsEvent {
  const rect = element.getBoundingClientRect();
  const layoutWidth = element.offsetWidth;
  const layoutHeight = element.offsetHeight;
  const scaleX = layoutWidth ? rect.width / layoutWidth : 1;
  const scaleY = layoutHeight ? rect.height / layoutHeight : 1;

  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) {
    return event;
  }

  if (Math.abs(scaleX - 1) < 0.001 && Math.abs(scaleY - 1) < 0.001) {
    return event;
  }

  return {
    clientX: rect.left + (event.clientX - rect.left) / scaleX,
    clientY: rect.top + (event.clientY - rect.top) / scaleY,
  };
}

export function useXtermMouseScaleFix(termRef: RefObject<Terminal | null>, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const term = termRef.current as XtermWithCore | null;
    const mouseService = term?._core?._mouseService;
    if (!mouseService || patchedMouseServices.has(mouseService)) return;

    const originalGetCoords = mouseService.getCoords.bind(mouseService);
    const originalGetMouseReportCoords = mouseService.getMouseReportCoords?.bind(mouseService);
    patchedMouseServices.add(mouseService);
    /* eslint-disable react-hooks/immutability */
    mouseService.getCoords = (
      event: MouseCoordsEvent,
      element: HTMLElement,
      colCount: number,
      rowCount: number,
      isSelection?: boolean
    ) => {
      if (!event || !element) {
        return originalGetCoords(event, element, colCount, rowCount, isSelection);
      }

      return originalGetCoords(adjustEventForScale(event, element), element, colCount, rowCount, isSelection);
    };
    if (originalGetMouseReportCoords) {
      mouseService.getMouseReportCoords = (event: MouseCoordsEvent, element: HTMLElement) => {
        if (!event || !element) {
          return originalGetMouseReportCoords(event, element);
        }
        return originalGetMouseReportCoords(adjustEventForScale(event, element), element);
      };
    }

    return () => {
      mouseService.getCoords = originalGetCoords;
      if (originalGetMouseReportCoords) {
        mouseService.getMouseReportCoords = originalGetMouseReportCoords;
      }
      patchedMouseServices.delete(mouseService);
    };
    /* eslint-enable react-hooks/immutability */
  }, [termRef, enabled]);
}
