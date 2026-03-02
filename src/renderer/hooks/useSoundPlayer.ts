import { useCallback, useEffect, useMemo, useState } from 'react';
import { normalizeAudioSettings } from '../../shared/audio';
import { SUPPORTED_AGENT_PROVIDERS } from '../../shared/providers';
import type { AgentProvider, VoicePackId } from '../../shared/types';
import { useAppSettings } from '../state/appSettingsStore';
import { useTheme } from '../theme/themeContext';
import {
  canPlaySoundEvent,
  ensurePeonPingVoicePackLoaded,
  getVoicePackList,
  getSoundPackList,
  getSoundEventLabel,
  loadPeonPingVoicePackCatalog,
  normalizeSoundEventOverrides,
  playSoundEvent,
  resolveSoundPackId,
  resolveVoicePackId,
  SOUND_EVENT_OPTIONS,
  type SoundEventId,
} from '../services/sfx';

export const useSoundPlayer = () => {
  const { settings } = useAppSettings();
  const { activeTheme } = useTheme();
  const [soundPackEntries] = useState(() => getSoundPackList());
  const [voicePackEntries, setVoicePackEntries] = useState(() => getVoicePackList());
  const [, setVoicePackLoadTick] = useState(0);

  const audio = useMemo(() => normalizeAudioSettings(settings.audio), [settings.audio]);
  const voiceMuted = audio.voiceMuted === true;
  const soundEventOverrides = useMemo(
    () => normalizeSoundEventOverrides(audio.soundEventOverrides),
    [audio.soundEventOverrides]
  );
  const themeDefaultSoundPackId = activeTheme.modules?.audio?.defaultSoundPackId;
  const soundPackId = useMemo(
    () =>
      resolveSoundPackId({
        overrideSoundPackId: audio.soundPackOverrideId,
        themeDefaultSoundPackId,
      }),
    [audio.soundPackOverrideId, themeDefaultSoundPackId]
  );
  const voicePackId = useMemo(
    () => resolveVoicePackId(audio.voicePackOverrideId),
    [audio.voicePackOverrideId]
  );
  const voicePackIdByProvider = useMemo(() => {
    const next: Partial<Record<AgentProvider, VoicePackId>> = {};
    const overrides = audio.voicePackOverrideIdByProvider ?? {};
    for (const provider of SUPPORTED_AGENT_PROVIDERS) {
      const voicePackOverrideId = overrides[provider];
      const resolvedVoicePackId = resolveVoicePackId(voicePackOverrideId);
      if (!resolvedVoicePackId) continue;
      next[provider] = resolvedVoicePackId;
    }
    return next;
  }, [audio.voicePackOverrideIdByProvider]);
  const selectedVoicePackIds = useMemo(() => {
    const ids = new Set<VoicePackId>();
    if (voicePackId) ids.add(voicePackId);
    for (const resolvedVoicePackId of Object.values(voicePackIdByProvider)) {
      if (!resolvedVoicePackId) continue;
      ids.add(resolvedVoicePackId);
    }
    return [...ids];
  }, [voicePackId, voicePackIdByProvider]);

  useEffect(() => {
    if (window.electronAPI.isTestMode) return;
    let cancelled = false;
    void loadPeonPingVoicePackCatalog().then(() => {
      if (cancelled) return;
      setVoicePackEntries(getVoicePackList());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (window.electronAPI.isTestMode) return;
    if (selectedVoicePackIds.length === 0) return;
    let cancelled = false;
    void Promise.allSettled(selectedVoicePackIds.map((id) => ensurePeonPingVoicePackLoaded(id))).finally(
      () => {
        if (cancelled) return;
        setVoicePackLoadTick((tick) => tick + 1);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [selectedVoicePackIds]);

  const resolveVoicePackIdForProvider = useCallback(
    (provider?: AgentProvider): VoicePackId | undefined => {
      if (!provider) return voicePackId;
      return voicePackIdByProvider[provider] ?? voicePackId;
    },
    [voicePackId, voicePackIdByProvider]
  );

  const playSound = useCallback(
    (eventId: SoundEventId, options?: { volumeScale?: number; provider?: AgentProvider }) => {
      const resolvedVoicePackId = resolveVoicePackIdForProvider(options?.provider);
      playSoundEvent(eventId, {
        muted: audio.muted,
        voiceMuted,
        masterVolume: audio.masterVolume,
        soundPackId,
        voicePackId: resolvedVoicePackId,
        volumeScale: options?.volumeScale,
        eventOverrides: soundEventOverrides,
      });
    },
    [
      audio.masterVolume,
      audio.muted,
      resolveVoicePackIdForProvider,
      soundEventOverrides,
      soundPackId,
      voiceMuted,
    ]
  );

  const canPlaySound = useCallback(
    (eventId: SoundEventId, options?: { provider?: AgentProvider }) =>
      canPlaySoundEvent(eventId, {
        soundPackId,
        voicePackId: resolveVoicePackIdForProvider(options?.provider),
        eventOverrides: soundEventOverrides,
      }),
    [resolveVoicePackIdForProvider, soundEventOverrides, soundPackId]
  );

  return {
    playSound,
    canPlaySoundEvent: canPlaySound,
    muted: audio.muted,
    voiceMuted,
    masterVolume: audio.masterVolume,
    soundPackId,
    voicePackId,
    voicePackIdByProvider,
    themeDefaultSoundPackId,
    usingThemeDefaultSoundPack: !audio.soundPackOverrideId,
    soundPacks: soundPackEntries,
    voicePacks: voicePackEntries,
    soundEventOverrides,
    soundEventOptions: SOUND_EVENT_OPTIONS,
    getSoundEventLabel,
  };
};
