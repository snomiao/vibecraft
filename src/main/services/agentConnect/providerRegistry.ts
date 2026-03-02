import { logger } from '../../logger';
import type {
  AgentModelInfo,
  ProviderDescriptor,
  ProviderRegistrySnapshot,
  ProviderStatus,
} from '../../../shared/types';

const log = logger.scope('agentconnect:providers');
const profileEnabled = process.env.VIBECRAFT_PROFILE === '1';

const logProfile = (message: string, data?: Record<string, unknown>): void => {
  if (!profileEnabled) return;
  if (data) {
    log.info(`[profile] ${message}`, data);
  } else {
    log.info(`[profile] ${message}`);
  }
};

export type { ProviderDescriptor, ProviderRegistrySnapshot, ProviderStatus };

export type ProviderStatusOptions = {
  fast?: boolean;
  force?: boolean;
};

export type ProviderRegistryRefreshOptions = ProviderStatusOptions & {
  skipCache?: boolean;
  skipModels?: boolean;
};

export type ProviderRegistryClient = {
  providers: {
    list: () => Promise<ProviderDescriptor[]>;
    status: (providerId: string, options?: ProviderStatusOptions) => Promise<ProviderStatus>;
  };
  models: {
    recent: (providerId: string) => Promise<AgentModelInfo[]>;
  };
};

export type ProviderRegistry = {
  initialize: () => Promise<void>;
  getSnapshot: () => ProviderRegistrySnapshot;
  refreshAll: (options?: ProviderRegistryRefreshOptions) => Promise<ProviderRegistrySnapshot>;
  refreshProviderStatus: (
    providerId: string,
    options?: ProviderStatusOptions
  ) => Promise<ProviderStatus | null>;
  refreshRecentModels: (providerId: string) => Promise<string[]>;
};

type ProviderRegistryOptions = {
  onUpdate?: (snapshot: ProviderRegistrySnapshot) => void;
  initialSnapshot?: ProviderRegistrySnapshot;
  cacheTtlMs?: number;
  refreshIntervalMs?: number;
  refreshSpreadMs?: number;
  now?: () => number;
};

const cloneSnapshot = (snapshot: ProviderRegistrySnapshot): ProviderRegistrySnapshot => ({
  providers: snapshot.providers.map((provider) => ({ ...provider })),
  providerStatus: { ...snapshot.providerStatus },
  recentModels: Object.fromEntries(
    Object.entries(snapshot.recentModels).map(([providerId, models]) => [providerId, [...models]])
  ),
  recentModelInfo: Object.fromEntries(
    Object.entries(snapshot.recentModelInfo ?? {}).map(([providerId, models]) => [
      providerId,
      models.map((model) => ({
        ...model,
        reasoningEfforts: model.reasoningEfforts ? [...model.reasoningEfforts] : undefined,
      })),
    ])
  ),
  loading: snapshot.loading,
  updatedAt: snapshot.updatedAt,
});

export function createProviderRegistry(
  client: ProviderRegistryClient,
  options: ProviderRegistryOptions = {}
): ProviderRegistry {
  const now = options.now ?? (() => Date.now());
  const state: ProviderRegistrySnapshot = {
    providers: [],
    providerStatus: {},
    recentModels: {},
    recentModelInfo: {},
    loading: false,
    updatedAt: null,
  };
  let initializePromise: Promise<void> | null = null;
  let refreshTimer: NodeJS.Timeout | null = null;
  let refreshInFlight = false;

  const emitUpdate = (): void => {
    state.updatedAt = now();
    options.onUpdate?.(cloneSnapshot(state));
  };

  const setLoading = (loading: boolean): void => {
    if (state.loading === loading) return;
    state.loading = loading;
    emitUpdate();
  };

  const safeCall = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      log.error('Provider registry request failed', error);
      return fallback;
    }
  };

  const refreshProviderStatus = async (
    providerId: string,
    optionsOverride?: ProviderStatusOptions
  ): Promise<ProviderStatus | null> => {
    const status = await safeCall(() => client.providers.status(providerId, optionsOverride), null);
    if (!status) return null;
    state.providerStatus[providerId] = status;
    emitUpdate();
    return status;
  };

  const refreshRecentModels = async (providerId: string): Promise<string[]> => {
    const models = await safeCall(() => client.models.recent(providerId), []);
    const ids = models.map((model) => model.id);
    state.recentModels[providerId] = ids;
    state.recentModelInfo[providerId] = models;
    emitUpdate();
    return ids;
  };

  const hydrateFromSnapshot = (snapshot: ProviderRegistrySnapshot): void => {
    state.providers = Array.isArray(snapshot.providers) ? snapshot.providers : [];
    state.providerStatus = snapshot.providerStatus ? { ...snapshot.providerStatus } : {};
    state.recentModels = snapshot.recentModels ? { ...snapshot.recentModels } : {};
    state.recentModelInfo = snapshot.recentModelInfo ? { ...snapshot.recentModelInfo } : {};
    state.updatedAt = typeof snapshot.updatedAt === 'number' ? snapshot.updatedAt : null;
    state.loading = false;
  };

  if (options.initialSnapshot?.providers?.length) {
    hydrateFromSnapshot(options.initialSnapshot);
  }

  const shouldRefresh = (): boolean => {
    if (!state.providers.length) return true;
    if (!state.updatedAt) return true;
    const ttl = options.cacheTtlMs ?? 0;
    if (ttl <= 0) return false;
    return now() - state.updatedAt > ttl;
  };

  const needsModelPrefetch = (): boolean =>
    state.providers.some((provider) => (state.recentModelInfo[provider.id]?.length ?? 0) === 0);

  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });

  const refreshProviders = async (optionsOverride?: ProviderRegistryRefreshOptions): Promise<void> => {
    if (refreshInFlight) return;
    refreshInFlight = true;
    const refreshStartedAt = now();
    try {
      const listedProviders = await safeCall(() => client.providers.list(), state.providers);
      const providers = listedProviders.length > 0 ? listedProviders : state.providers;
      if (providers.length > 0 && providers !== state.providers) {
        state.providers = [...providers];
        emitUpdate();
      }
      logProfile('providerRegistry.refresh.start', { providerCount: providers.length });
      const spreadMs = Math.max(0, options.refreshSpreadMs ?? 0);
      const hasCachedStatus = Object.keys(state.providerStatus).length > 0;
      const shouldStagger =
        spreadMs > 0 && (hasCachedStatus || optionsOverride?.skipCache || optionsOverride?.force);
      const statusOptions = optionsOverride?.force
        ? { force: true }
        : optionsOverride?.fast === false
          ? undefined
          : { fast: true };

      await Promise.all(
        providers.map(async (provider, index) => {
          if (shouldStagger) {
            await sleep(spreadMs * index);
          }
          const providerStartedAt = now();
          const status = await refreshProviderStatus(provider.id, statusOptions);
          if (
            !optionsOverride?.skipModels &&
            status &&
            status.installed !== false &&
            status.state !== 'missing'
          ) {
            await refreshRecentModels(provider.id);
          }
          logProfile('providerRegistry.provider.status', {
            providerId: provider.id,
            elapsedMs: Math.round(now() - providerStartedAt),
          });
        })
      );
      emitUpdate();
    } finally {
      logProfile('providerRegistry.refresh.done', {
        elapsedMs: Math.round(now() - refreshStartedAt),
      });
      refreshInFlight = false;
    }
  };

  const refreshAll = async (
    optionsOverride?: ProviderRegistryRefreshOptions
  ): Promise<ProviderRegistrySnapshot> => {
    if (!optionsOverride?.force && !optionsOverride?.skipCache && !shouldRefresh() && !needsModelPrefetch()) {
      return cloneSnapshot(state);
    }
    await refreshProviders(optionsOverride);
    return cloneSnapshot(state);
  };

  const initialize = async (): Promise<void> => {
    if (!initializePromise) {
      initializePromise = (async () => {
        try {
          if (shouldRefresh() || needsModelPrefetch()) {
            const showLoading = state.providers.length === 0;
            if (showLoading) setLoading(true);
            await refreshProviders();
            if (showLoading) setLoading(false);
          }
        } catch (error) {
          initializePromise = null;
          throw error;
        } finally {
          setLoading(false);
        }
      })();
    }
    await initializePromise;
    const interval = options.refreshIntervalMs ?? 0;
    if (interval > 0 && !refreshTimer) {
      refreshTimer = setInterval(() => {
        if (state.loading) return;
        void refreshProviders();
      }, interval);
    }
  };

  const getSnapshot = (): ProviderRegistrySnapshot => cloneSnapshot(state);

  return {
    initialize,
    getSnapshot,
    refreshAll,
    refreshProviderStatus,
    refreshRecentModels,
  };
}
