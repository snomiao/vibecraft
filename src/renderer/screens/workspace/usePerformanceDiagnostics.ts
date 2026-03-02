import { useCallback, useEffect, useRef, useState, type ProfilerOnRenderCallback } from 'react';

export type FrameDiagnosticsSnapshot = {
  fps: number;
  avgFrameMs: number;
  p95FrameMs: number;
  longFramePct: number;
  stutterFrameCount: number;
  sampleCount: number;
};

export type RenderDiagnosticsSnapshot = {
  commitCount: number;
  commitsPerSec: number;
  avgCommitMs: number;
  maxCommitMs: number;
  sampleCount: number;
};

export type PerformanceTier = 'normal' | 'reduced';

const TARGET_FRAME_MS = 1000 / 60;
const STUTTER_FRAME_MS = 1000 / 30;

const EMPTY_FRAME_DIAGNOSTICS: FrameDiagnosticsSnapshot = {
  fps: 0,
  avgFrameMs: 0,
  p95FrameMs: 0,
  longFramePct: 0,
  stutterFrameCount: 0,
  sampleCount: 0,
};

const EMPTY_RENDER_DIAGNOSTICS: RenderDiagnosticsSnapshot = {
  commitCount: 0,
  commitsPerSec: 0,
  avgCommitMs: 0,
  maxCommitMs: 0,
  sampleCount: 0,
};

const toP95 = (samples: number[]): number => {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[index];
};

export function useFrameDiagnostics(options: {
  enabled: boolean;
  sampleSize?: number;
  publishIntervalMs?: number;
}): FrameDiagnosticsSnapshot {
  const { enabled, sampleSize = 180, publishIntervalMs = 500 } = options;
  const [snapshot, setSnapshot] = useState<FrameDiagnosticsSnapshot>(EMPTY_FRAME_DIAGNOSTICS);
  const frameDurationsRef = useRef<number[]>([]);
  const lastFrameAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      frameDurationsRef.current = [];
      lastFrameAtRef.current = null;
      setSnapshot(EMPTY_FRAME_DIAGNOSTICS);
      return;
    }

    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      return;
    }

    let rafId: number | null = null;
    const tick = (timestamp: number) => {
      if (lastFrameAtRef.current !== null) {
        const dt = timestamp - lastFrameAtRef.current;
        const samples = frameDurationsRef.current;
        samples.push(dt);
        if (samples.length > sampleSize) {
          samples.shift();
        }
      }
      lastFrameAtRef.current = timestamp;
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    const intervalId = window.setInterval(() => {
      const samples = frameDurationsRef.current;
      if (samples.length === 0) {
        setSnapshot(EMPTY_FRAME_DIAGNOSTICS);
        return;
      }

      const sampleCount = samples.length;
      const total = samples.reduce((sum, value) => sum + value, 0);
      const avgFrameMs = total / sampleCount;
      const p95FrameMs = toP95(samples);
      const longFrameCount = samples.filter((value) => value > TARGET_FRAME_MS).length;
      const stutterFrameCount = samples.filter((value) => value > STUTTER_FRAME_MS).length;

      setSnapshot({
        fps: avgFrameMs > 0 ? 1000 / avgFrameMs : 0,
        avgFrameMs,
        p95FrameMs,
        longFramePct: (longFrameCount / sampleCount) * 100,
        stutterFrameCount,
        sampleCount,
      });
    }, publishIntervalMs);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.clearInterval(intervalId);
      frameDurationsRef.current = [];
      lastFrameAtRef.current = null;
    };
  }, [enabled, publishIntervalMs, sampleSize]);

  return snapshot;
}

export function useRenderDiagnostics(options: { enabled: boolean; publishIntervalMs?: number }): {
  snapshot: RenderDiagnosticsSnapshot;
  onRender: ProfilerOnRenderCallback;
} {
  const { enabled, publishIntervalMs = 500 } = options;
  const [snapshot, setSnapshot] = useState<RenderDiagnosticsSnapshot>(EMPTY_RENDER_DIAGNOSTICS);
  const commitCountRef = useRef(0);
  const renderSamplesRef = useRef<number[]>([]);

  const onRender = useCallback<ProfilerOnRenderCallback>(
    (_id, _phase, actualDuration) => {
      if (!enabled) return;
      commitCountRef.current += 1;
      const samples = renderSamplesRef.current;
      samples.push(actualDuration);
      if (samples.length > 600) {
        samples.shift();
      }
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) {
      commitCountRef.current = 0;
      renderSamplesRef.current = [];
      setSnapshot(EMPTY_RENDER_DIAGNOSTICS);
      return;
    }

    let previousCommitCount = commitCountRef.current;
    const intervalId = window.setInterval(() => {
      const samples = renderSamplesRef.current;
      const commits = commitCountRef.current;
      const commitsInWindow = commits - previousCommitCount;
      previousCommitCount = commits;

      if (samples.length === 0 && commits === 0) {
        setSnapshot(EMPTY_RENDER_DIAGNOSTICS);
        return;
      }

      const total = samples.reduce((sum, value) => sum + value, 0);
      const avgCommitMs = samples.length > 0 ? total / samples.length : 0;
      const maxCommitMs = samples.length > 0 ? Math.max(...samples) : 0;
      const commitsPerSec = commitsInWindow * (1000 / publishIntervalMs);

      setSnapshot({
        commitCount: commits,
        commitsPerSec,
        avgCommitMs,
        maxCommitMs,
        sampleCount: samples.length,
      });
    }, publishIntervalMs);

    return () => {
      window.clearInterval(intervalId);
      commitCountRef.current = 0;
      renderSamplesRef.current = [];
    };
  }, [enabled, publishIntervalMs]);

  return { snapshot, onRender };
}

export function useAdaptivePerformanceTier(options: {
  enabled: boolean;
  frame: FrameDiagnosticsSnapshot;
}): PerformanceTier {
  const { enabled, frame } = options;
  const [tier, setTier] = useState<PerformanceTier>('normal');
  const lowFrameStreakRef = useRef(0);
  const healthyFrameStreakRef = useRef(0);

  useEffect(() => {
    if (!enabled || frame.sampleCount === 0) {
      lowFrameStreakRef.current = 0;
      healthyFrameStreakRef.current = 0;
      setTier('normal');
      return;
    }

    const isLowFps = frame.fps < 50 || frame.p95FrameMs > 24;
    const isHealthy = frame.fps > 57 && frame.p95FrameMs < 18;

    if (isLowFps) {
      lowFrameStreakRef.current += 1;
      healthyFrameStreakRef.current = 0;
      if (lowFrameStreakRef.current >= 3) {
        setTier('reduced');
      }
      return;
    }

    if (isHealthy) {
      healthyFrameStreakRef.current += 1;
      lowFrameStreakRef.current = 0;
      if (healthyFrameStreakRef.current >= 4) {
        setTier('normal');
      }
      return;
    }

    lowFrameStreakRef.current = 0;
    healthyFrameStreakRef.current = 0;
  }, [enabled, frame.fps, frame.p95FrameMs, frame.sampleCount]);

  return tier;
}
