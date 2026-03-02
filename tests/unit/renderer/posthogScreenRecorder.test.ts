import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const posthog = {
  init: vi.fn(),
  identify: vi.fn(),
  startSessionRecording: vi.fn(),
  stopSessionRecording: vi.fn(),
};

vi.mock('posthog-js', () => ({
  default: posthog,
}));

vi.mock('posthog-js/dist/posthog-recorder', () => ({}));

const flushAsyncWork = async () => {
  await vi.runAllTimersAsync();
  await Promise.resolve();
  await Promise.resolve();
};

describe('posthogScreenRecorder', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.unstubAllEnvs();
    posthog.init.mockReset();
    posthog.identify.mockReset();
    posthog.startSessionRecording.mockReset();
    posthog.stopSessionRecording.mockReset();
    window.electronAPI.isTestMode = false;
    window.electronAPI.getPosthogConfig = vi.fn(async () => ({
      apiKey: 'phc_test',
      host: 'https://app.posthog.com',
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  test('does not use renderer fallback distinct id in production mode', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);
    window.electronAPI.getTelemetryContext = vi.fn(async () => null);

    const module = await import('../../../src/renderer/utils/posthogScreenRecorder');
    module.startPaywallSessionReplay();
    await flushAsyncWork();

    expect(window.electronAPI.getTelemetryContext).toHaveBeenCalledTimes(6);
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.identify).not.toHaveBeenCalled();
    expect(posthog.startSessionRecording).not.toHaveBeenCalled();
  });
});
