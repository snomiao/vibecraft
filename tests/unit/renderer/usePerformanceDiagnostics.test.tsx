import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import {
  useAdaptivePerformanceTier,
  type FrameDiagnosticsSnapshot,
} from '../../../src/renderer/screens/workspace/usePerformanceDiagnostics';

const buildFrame = (overrides: Partial<FrameDiagnosticsSnapshot>): FrameDiagnosticsSnapshot => ({
  fps: 60,
  avgFrameMs: 16.6,
  p95FrameMs: 17,
  longFramePct: 0,
  stutterFrameCount: 0,
  sampleCount: 180,
  ...overrides,
});

describe('useAdaptivePerformanceTier', () => {
  test('recovers to normal when fps and p95 are healthy even with high long-frame percentage', async () => {
    const lowFrame = buildFrame({ fps: 43, p95FrameMs: 29, longFramePct: 12 });
    const healthyButHighLongFrame = buildFrame({ fps: 59, p95FrameMs: 17, longFramePct: 62 });
    const { result, rerender } = renderHook(
      ({ frame }) => useAdaptivePerformanceTier({ enabled: true, frame }),
      { initialProps: { frame: lowFrame } }
    );

    for (let index = 0; index < 3; index += 1) {
      act(() => {
        rerender({ frame: { ...lowFrame, sampleCount: lowFrame.sampleCount + index + 1 } });
      });
    }

    await waitFor(() => {
      expect(result.current).toBe('reduced');
    });

    for (let index = 0; index < 4; index += 1) {
      act(() => {
        rerender({
          frame: {
            ...healthyButHighLongFrame,
            sampleCount: healthyButHighLongFrame.sampleCount + index + 1,
          },
        });
      });
    }

    await waitFor(() => {
      expect(result.current).toBe('normal');
    });
  });

  test('drops to reduced mode on sustained high p95 frame time', async () => {
    const poorP95Frame = buildFrame({ fps: 56, p95FrameMs: 26, longFramePct: 3 });
    const { result, rerender } = renderHook(
      ({ frame }) => useAdaptivePerformanceTier({ enabled: true, frame }),
      { initialProps: { frame: poorP95Frame } }
    );

    for (let index = 0; index < 3; index += 1) {
      act(() => {
        rerender({ frame: { ...poorP95Frame, sampleCount: poorP95Frame.sampleCount + index + 1 } });
      });
    }

    await waitFor(() => {
      expect(result.current).toBe('reduced');
    });
  });
});
