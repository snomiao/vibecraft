import { logger } from './logger';
import { initializeProviderRegistry } from './services/agentConnect/registryService';
import type { ProviderRegistrySnapshot } from './services/agentConnect/providerRegistry';
import { ensureTutorialWorldInRecents, loadSettings } from './services/storage';
import { getTestModeConfig } from '../testing/testMode';

const log = logger.scope('startup');
const STARTUP_MODEL_REFRESH_DELAY_MS = 2000;

type StartupTask = {
  id: string;
  delayMs?: number;
  run: () => void | Promise<void>;
};

type StartupTasksOptions = {
  onProviderRegistryUpdate: (snapshot: ProviderRegistrySnapshot) => void;
};

const scheduleTask = (task: StartupTask): void => {
  const runTask = async () => {
    try {
      await task.run();
    } catch (error) {
      log.warn('Startup task failed', { taskId: task.id, error });
    }
  };

  if (task.delayMs && task.delayMs > 0) {
    setTimeout(() => {
      void runTask();
    }, task.delayMs);
    return;
  }

  void runTask();
};

export const scheduleStartupBackgroundTasks = (options: StartupTasksOptions): void => {
  const registry = initializeProviderRegistry({ onUpdate: options.onProviderRegistryUpdate });
  const testMode = getTestModeConfig();

  const tasks: StartupTask[] = [
    {
      id: 'tutorial-recents',
      run: () => {
        const settings = loadSettings();
        if (settings.tutorial?.status !== 'completed') {
          ensureTutorialWorldInRecents();
        }
      },
    },
    {
      id: 'telemetry',
      run: async () => {
        const telemetry = await import('./services/telemetry');
        void telemetry.initTelemetry();
        telemetry.setupPowerMonitorListeners();
      },
    },
    {
      id: 'provider-status-refresh',
      run: async () => {
        await registry.refreshAll({ fast: true, skipCache: true, skipModels: true });
      },
    },
  ];

  if (!testMode.enabled) {
    tasks.push({
      id: 'provider-model-refresh',
      delayMs: STARTUP_MODEL_REFRESH_DELAY_MS,
      run: async () => {
        await registry.refreshAll({ fast: true, skipCache: true });
      },
    });
  }

  tasks.forEach(scheduleTask);
};
