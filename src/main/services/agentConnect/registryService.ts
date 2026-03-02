import { logger } from '../../logger';
import { createAgentConnectClient } from './client';
import {
  createProviderRegistry,
  type ProviderRegistry,
  type ProviderRegistrySnapshot,
} from './providerRegistry';
import { loadSettings, saveSettings } from '../storage';

const log = logger.scope('agentconnect:registry');

let registry: ProviderRegistry | null = null;
const updateHandlers = new Set<(snapshot: ProviderRegistrySnapshot) => void>();
export const PROVIDER_REGISTRY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const ensureRegistry = (): ProviderRegistry => {
  if (!registry) {
    const settings = loadSettings();
    registry = createProviderRegistry(createAgentConnectClient(), {
      initialSnapshot: settings.providerRegistryCache,
      cacheTtlMs: PROVIDER_REGISTRY_CACHE_TTL_MS,
      refreshIntervalMs: PROVIDER_REGISTRY_CACHE_TTL_MS,
      refreshSpreadMs: 1500,
      onUpdate: (snapshot) => {
        updateHandlers.forEach((handler) => handler(snapshot));
        if (snapshot.providers.length > 0 && snapshot.updatedAt) {
          const current = loadSettings();
          if (current.providerRegistryCache?.updatedAt !== snapshot.updatedAt) {
            saveSettings({ providerRegistryCache: snapshot });
          }
        }
      },
    });
  }
  return registry;
};

export function getProviderRegistry(): ProviderRegistry {
  return ensureRegistry();
}

export function initializeProviderRegistry(options?: {
  onUpdate?: (snapshot: ProviderRegistrySnapshot) => void;
}): ProviderRegistry {
  if (options?.onUpdate) updateHandlers.add(options.onUpdate);

  const registry = ensureRegistry();

  void registry.initialize().catch((error) => {
    log.error('Failed to initialize provider registry', error);
  });

  return registry;
}
