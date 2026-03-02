import type { AgentProvider, AudioSettings } from './types';
import { isSupportedAgentProvider } from './providers';
import { isSoundPackId, isVoicePackId } from './types';

export interface NormalizedAudioSettings {
  muted: boolean;
  voiceMuted?: boolean;
  masterVolume: number;
  soundPackOverrideId?: AudioSettings['soundPackOverrideId'];
  voicePackOverrideId?: AudioSettings['voicePackOverrideId'];
  voicePackOverrideIdByProvider?: Partial<Record<AgentProvider, AudioSettings['voicePackOverrideId']>>;
  soundEventOverrides?: Record<string, string>;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const normalizeMuted = (value: unknown, legacy?: { muteAudio?: unknown; muteSfx?: unknown }): boolean => {
  if (typeof value === 'boolean') return value;
  return legacy?.muteAudio === true || legacy?.muteSfx === true;
};

const normalizeVoiceMuted = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  return false;
};

const normalizeSoundEventOverrides = (value: unknown): Record<string, string> | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return undefined;
  const normalized: Record<string, string> = {};
  for (const [key, rawValue] of entries) {
    const eventId = key.trim();
    if (!eventId) continue;
    if (typeof rawValue !== 'string') continue;
    const override = rawValue.trim();
    if (!override) continue;
    normalized[eventId] = override;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const normalizeSoundPackOverrideId = (value: unknown): AudioSettings['soundPackOverrideId'] | undefined => {
  if (!isSoundPackId(value)) return undefined;
  return value;
};

const normalizeVoicePackOverrideId = (value: unknown): string | undefined => {
  if (!isVoicePackId(value)) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeVoicePackOverrideIdByProvider = (
  value: unknown
): Partial<Record<AgentProvider, string>> | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const normalized: Partial<Record<AgentProvider, string>> = {};
  for (const [provider, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (!isSupportedAgentProvider(provider)) continue;
    const voicePackId = normalizeVoicePackOverrideId(rawValue);
    if (!voicePackId) continue;
    normalized[provider] = voicePackId;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

export const normalizeAudioSettings = (
  value: unknown,
  legacy?: { muteAudio?: unknown; muteSfx?: unknown }
): NormalizedAudioSettings => {
  const audio = value && typeof value === 'object' ? (value as AudioSettings) : {};
  const muted = normalizeMuted(audio.muted, legacy);
  const voiceMuted = normalizeVoiceMuted(audio.voiceMuted);
  const masterVolume = typeof audio.masterVolume === 'number' ? clamp01(audio.masterVolume) : 1;
  const soundPackOverrideId = normalizeSoundPackOverrideId(audio.soundPackOverrideId);
  const voicePackOverrideId = normalizeVoicePackOverrideId(audio.voicePackOverrideId);
  const voicePackOverrideIdByProvider = normalizeVoicePackOverrideIdByProvider(
    audio.voicePackOverrideIdByProvider
  );
  const soundEventOverrides = normalizeSoundEventOverrides(audio.soundEventOverrides);
  return {
    muted,
    ...(voiceMuted ? { voiceMuted: true } : {}),
    masterVolume,
    ...(soundPackOverrideId ? { soundPackOverrideId } : {}),
    ...(voicePackOverrideId ? { voicePackOverrideId } : {}),
    ...(voicePackOverrideIdByProvider ? { voicePackOverrideIdByProvider } : {}),
    ...(soundEventOverrides ? { soundEventOverrides } : {}),
  };
};
