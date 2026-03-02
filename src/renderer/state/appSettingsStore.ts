import { useSyncExternalStore } from 'react';
import type { AppSettings, AgentProvider, TutorialState } from '../../shared/types';
import { normalizeAudioSettings } from '../../shared/audio';
import { isSupportedAgentProvider } from '../../shared/providers';
import { DEFAULT_TUTORIAL_STATE, TUTORIAL_STATUSES, TUTORIAL_STEPS } from '../../shared/tutorial';
import { workspaceClient } from '../services/workspaceClient';

type AppSettingsStatus = 'idle' | 'loading' | 'loaded' | 'error';

type AppSettingsSnapshot = {
  status: AppSettingsStatus;
  settings: AppSettings;
  error?: string;
};

type Listener = () => void;

const listeners = new Set<Listener>();

let snapshot: AppSettingsSnapshot = {
  status: 'idle',
  settings: {},
};

const normalizeTutorialState = (value?: TutorialState): TutorialState => {
  if (!value) return { ...DEFAULT_TUTORIAL_STATE };
  const status = TUTORIAL_STATUSES.includes(value.status) ? value.status : DEFAULT_TUTORIAL_STATE.status;
  const stepId = TUTORIAL_STEPS.includes(value.stepId) ? value.stepId : DEFAULT_TUTORIAL_STATE.stepId;
  return {
    ...value,
    status,
    stepId,
    version: 1,
  };
};

const applySettingsDefaults = (settings: AppSettings): AppSettings => ({
  ...settings,
  audio: normalizeAudioSettings(settings.audio),
  tutorial: normalizeTutorialState(settings.tutorial),
});

const mergeTutorialState = (settings: AppSettings, fallback?: TutorialState): AppSettings => {
  const nextTutorial = normalizeTutorialState(settings.tutorial);
  if (!fallback) {
    return { ...settings, tutorial: nextTutorial, audio: normalizeAudioSettings(settings.audio) };
  }
  const fallbackTutorial = normalizeTutorialState(fallback);
  const nextUpdatedAt = nextTutorial.updatedAt ?? 0;
  const fallbackUpdatedAt = fallbackTutorial.updatedAt ?? 0;
  if (fallbackUpdatedAt > nextUpdatedAt) {
    return { ...settings, tutorial: fallbackTutorial, audio: normalizeAudioSettings(settings.audio) };
  }
  return { ...settings, tutorial: nextTutorial, audio: normalizeAudioSettings(settings.audio) };
};

const notify = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

type DevHeroOverride = { kind: 'unset' } | { kind: 'set'; provider: AgentProvider } | { kind: 'none' };

const parseDevHeroOverride = (value: string | undefined): DevHeroOverride => {
  if (!value) return { kind: 'none' };
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed === 'unset' || trimmed === 'none') {
    return { kind: 'unset' };
  }
  if (isSupportedAgentProvider(trimmed)) {
    return { kind: 'set', provider: trimmed as AgentProvider };
  }
  return { kind: 'none' };
};

const applyDevOverrides = (settings: AppSettings): AppSettings => {
  if (!import.meta.env.DEV) return applySettingsDefaults(settings);
  const normalized = applySettingsDefaults(settings);
  const override = parseDevHeroOverride(import.meta.env.VITE_DEV_HERO_PROVIDER);
  if (override.kind === 'unset') {
    if (normalized.tutorial?.status === 'not_started') {
      const next = { ...normalized };
      delete next.heroProvider;
      delete next.heroModel;
      return next;
    }
    return normalized;
  }
  if (override.kind === 'set') {
    return applySettingsDefaults({ ...normalized, heroProvider: override.provider });
  }
  return normalized;
};

const setSnapshot = (next: AppSettingsSnapshot): void => {
  snapshot = next;
  notify();
};

export const getAppSettingsSnapshot = (): AppSettingsSnapshot => snapshot;

export const subscribeAppSettings = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const loadAppSettings = async (): Promise<void> => {
  if (snapshot.status === 'loading' || snapshot.status === 'loaded') return;
  setSnapshot({ ...snapshot, status: 'loading' });
  try {
    const settings = await workspaceClient.loadSettings();
    setSnapshot({ status: 'loaded', settings: applyDevOverrides(settings) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load settings';
    setSnapshot({ status: 'error', settings: {}, error: message });
  }
};

export const refreshAppSettings = async (options?: { applyDevOverrides?: boolean }): Promise<void> => {
  const previousTutorial = snapshot.settings.tutorial;
  const previousHeroProvider = snapshot.settings.heroProvider;
  const previousHeroModel = snapshot.settings.heroModel;
  setSnapshot({ ...snapshot, status: 'loading' });
  try {
    const settings = await workspaceClient.loadSettings();
    const applyOverrides = options?.applyDevOverrides ?? true;
    const normalized = applyOverrides ? applyDevOverrides(settings) : applySettingsDefaults(settings);
    let merged = mergeTutorialState(normalized, previousTutorial);
    if (!merged.heroProvider && previousHeroProvider && merged.tutorial?.status !== 'not_started') {
      merged = {
        ...merged,
        heroProvider: previousHeroProvider,
        ...(merged.heroModel ? {} : previousHeroModel ? { heroModel: previousHeroModel } : {}),
      };
    }
    setSnapshot({
      status: 'loaded',
      settings: merged,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load settings';
    setSnapshot({ status: 'error', settings: snapshot.settings, error: message });
  }
};

export const useAppSettings = (): AppSettingsSnapshot =>
  useSyncExternalStore(subscribeAppSettings, getAppSettingsSnapshot, getAppSettingsSnapshot);

const mergeSettingsPatch = (base: AppSettings, patch: Partial<AppSettings>): AppSettings => {
  const next: AppSettings = {
    ...base,
    ...patch,
  };
  if (patch.audio) {
    next.audio = {
      ...(base.audio ?? {}),
      ...patch.audio,
    };
  }
  if (patch.uiState) {
    next.uiState = {
      ...(base.uiState ?? {}),
      ...patch.uiState,
    };
  }
  if (patch.defaultReasoningEffortByProvider) {
    next.defaultReasoningEffortByProvider = {
      ...(base.defaultReasoningEffortByProvider ?? {}),
      ...patch.defaultReasoningEffortByProvider,
    };
  }
  return next;
};

export const saveSettings = (patch: Partial<AppSettings>): void => {
  const nextSettings = mergeSettingsPatch(snapshot.settings, patch);
  setSnapshot({ ...snapshot, settings: applySettingsDefaults(nextSettings) });

  void (async () => {
    try {
      await workspaceClient.saveSettings(patch);
    } catch {
      return;
    }
  })();
};

export const getAbilityVariantSelections = (): Record<string, string> =>
  snapshot.settings.uiState?.abilityVariantSelections ?? {};

export const setAbilityVariantSelection = (abilityId: string, variantId: string): void => {
  const currentSelections = snapshot.settings.uiState?.abilityVariantSelections ?? {};
  if (currentSelections[abilityId] === variantId) {
    return;
  }
  const nextSelections = { ...currentSelections, [abilityId]: variantId };
  saveSettings({
    uiState: {
      abilityVariantSelections: nextSelections,
    },
  });
};

export const getTutorialState = (): TutorialState => normalizeTutorialState(snapshot.settings.tutorial);

export const setTutorialState = (next: TutorialState): void => {
  const normalized = normalizeTutorialState(next);
  saveSettings({ tutorial: normalized });
};

export const updateTutorialState = (updater: (current: TutorialState) => TutorialState): void => {
  setTutorialState(updater(getTutorialState()));
};
