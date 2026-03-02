import { render, act, waitFor } from '@testing-library/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { BrowserPanel, SelectedEntityRef } from '../../../src/shared/types';
import { useBrowserManager } from '../../../src/renderer/screens/workspace/useBrowserManager';
import { useZIndexManager } from '../../../src/renderer/screens/workspace/useZIndexManager';
import { INITIAL_Z_INDEX } from '../../../src/renderer/screens/workspace/constants';

type Controls = {
  bringBrowserToFront: (id: string) => void;
  browserZIndices: Record<string, number>;
};

const createBrowser = (id: string, x: number): BrowserPanel => ({
  id,
  url: 'https://example.com',
  x,
  y: 0,
  width: 640,
  height: 480,
  createdAt: 0,
});

function Harness({
  browsers: initialBrowsers,
  onReady,
}: {
  browsers: BrowserPanel[];
  onReady: (controls: Controls) => void;
}) {
  const [browsers, setBrowsers] = useState(initialBrowsers);
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntityRef | null>(null);
  const nextZIndexRef = useRef(INITIAL_Z_INDEX);
  const zIndex = useZIndexManager({ nextZIndexRef });
  const browserZIndexDomain = useMemo(
    () => ({
      browserZIndices: zIndex.browserZIndices,
      bringBrowserToFront: zIndex.bringBrowserToFront,
      syncBrowserIds: zIndex.syncBrowserIds,
    }),
    [zIndex.browserZIndices, zIndex.bringBrowserToFront, zIndex.syncBrowserIds]
  );
  const { browserZIndices, bringBrowserToFront } = useBrowserManager({
    workspacePath: '/workspace',
    browsers,
    setBrowsers,
    setMessageDialog: () => null,
    selectedEntityId: selectedEntity?.id ?? null,
    setSelectedEntity,
    zIndex: browserZIndexDomain,
  });

  useEffect(() => {
    onReady({ bringBrowserToFront, browserZIndices });
  }, [onReady, bringBrowserToFront, browserZIndices]);

  return null;
}

describe('browser z ordering', () => {
  it('brings a browser to the front even when z-indices are not initialized', async () => {
    let controls: Controls | null = null;
    const handleReady = (next: Controls) => {
      controls = next;
    };

    render(
      <Harness
        browsers={[createBrowser('browser-a', 100), createBrowser('browser-b', 200)]}
        onReady={handleReady}
      />
    );

    expect(controls).not.toBeNull();

    act(() => {
      controls!.bringBrowserToFront('browser-a');
    });

    await waitFor(() => {
      expect(controls!.browserZIndices['browser-a']).toBeGreaterThan(2000);
    });

    act(() => {
      controls!.bringBrowserToFront('browser-b');
    });

    await waitFor(() => {
      expect(controls!.browserZIndices['browser-b']).toBeGreaterThan(controls!.browserZIndices['browser-a']);
    });
  });
});
