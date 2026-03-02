import { useCallback, useState } from 'react';

type ZIndexMap = Record<string, number>;

type UseZIndexManagerParams = {
  nextZIndexRef: React.MutableRefObject<number>;
};

type UseZIndexManagerReturn = {
  browserZIndices: ZIndexMap;
  terminalZIndices: ZIndexMap;
  syncBrowserIds: (ids: string[]) => void;
  syncTerminalIds: (ids: string[]) => void;
  bringBrowserToFront: (id: string) => void;
  bringTerminalToFront: (id: string) => void;
};

const assignNextZIndex = (nextZIndexRef: React.MutableRefObject<number>): number => {
  const next = nextZIndexRef.current;
  nextZIndexRef.current += 1;
  return next;
};

const syncZIndices = (
  ids: string[],
  prev: ZIndexMap,
  nextZIndexRef: React.MutableRefObject<number>
): ZIndexMap => {
  const idSet = new Set(ids);
  const next: ZIndexMap = {};

  ids.forEach((id) => {
    const existing = prev[id];
    next[id] = typeof existing === 'number' ? existing : assignNextZIndex(nextZIndexRef);
  });

  const prevKeys = Object.keys(prev);
  const hasSameIds = prevKeys.length === ids.length && prevKeys.every((id) => idSet.has(id));
  if (hasSameIds && prevKeys.every((id) => prev[id] === next[id])) {
    return prev;
  }

  return next;
};

export function useZIndexManager({ nextZIndexRef }: UseZIndexManagerParams): UseZIndexManagerReturn {
  const [browserZIndices, setBrowserZIndices] = useState<ZIndexMap>({});
  const [terminalZIndices, setTerminalZIndices] = useState<ZIndexMap>({});

  const syncBrowserIds = useCallback(
    (ids: string[]) => {
      setBrowserZIndices((prev) => syncZIndices(ids, prev, nextZIndexRef));
    },
    [nextZIndexRef]
  );

  const syncTerminalIds = useCallback(
    (ids: string[]) => {
      setTerminalZIndices((prev) => syncZIndices(ids, prev, nextZIndexRef));
    },
    [nextZIndexRef]
  );

  const bringToFront = useCallback(
    (id: string, setMap: React.Dispatch<React.SetStateAction<ZIndexMap>>) => {
      const nextZ = assignNextZIndex(nextZIndexRef);
      setMap((prev) => {
        if (prev[id] === nextZ) return prev;
        return { ...prev, [id]: nextZ };
      });
    },
    [nextZIndexRef]
  );

  const bringBrowserToFront = useCallback(
    (id: string) => bringToFront(id, setBrowserZIndices),
    [bringToFront]
  );

  const bringTerminalToFront = useCallback(
    (id: string) => bringToFront(id, setTerminalZIndices),
    [bringToFront]
  );

  return {
    browserZIndices,
    terminalZIndices,
    syncBrowserIds,
    syncTerminalIds,
    bringBrowserToFront,
    bringTerminalToFront,
  };
}

export default useZIndexManager;
