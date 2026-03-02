import { describe, expect, test } from 'vitest';
import type { SoundPackId } from '../../../src/shared/types';
import { COMMAND_IDS } from '../../../src/shared/commands';
import { normalizeAudioSettings } from '../../../src/shared/audio';
import { commandDefinitions } from '../../../src/renderer/commands/registry';
import {
  canPlaySoundEvent,
  COMMAND_SOUND_EVENT_IDS,
  CUSTOM_SOUND_SOURCE_PREFIX,
  getCustomSoundLabel,
  PEONPING_AGENT_EVENT_MAPPINGS,
  normalizeSoundEventOverrides,
  parseCustomSoundSource,
  toCustomSoundSource,
  SOUND_EVENT_OVERRIDE_SILENT,
  SOUND_EVENT_OPTIONS,
  resolveSoundPackId,
  resolveVoicePackId,
  SOUND_EVENT_IDS,
  SOUND_PACKS,
  toCommandSoundEventId,
} from '../../../src/renderer/services/sfx';

describe('sound pack resolver', () => {
  test('prefers explicit override over theme default', () => {
    const result = resolveSoundPackId({
      overrideSoundPackId: 'arcade',
      themeDefaultSoundPackId: 'default',
    });
    expect(result).toBe('arcade');
  });

  test('uses theme default when override is not set', () => {
    const result = resolveSoundPackId({
      themeDefaultSoundPackId: 'arcade',
    });
    expect(result).toBe('arcade');
  });

  test('falls back to hard default for unknown IDs', () => {
    const unknown = 'unknown-pack' as SoundPackId;
    const result = resolveSoundPackId({
      overrideSoundPackId: unknown,
      themeDefaultSoundPackId: unknown,
    });
    expect(result).toBe('default');
  });

  test('rejects non-built-in sound pack IDs', () => {
    const result = resolveSoundPackId({
      overrideSoundPackId: 'peonping:peon' as unknown as SoundPackId,
      themeDefaultSoundPackId: 'default',
    });
    expect(result).toBe('default');
  });

  test('accepts peonping-prefixed voice pack IDs', () => {
    expect(resolveVoicePackId('peonping:peon')).toBe('peonping:peon');
    expect(resolveVoicePackId('default')).toBeUndefined();
  });
});

describe('sound event availability', () => {
  test('returns false for silent defaults and true for playable defaults', () => {
    expect(canPlaySoundEvent('agent.create')).toBe(true);
    expect(canPlaySoundEvent('command.destroy-agent')).toBe(false);
  });

  test('returns false for mapped events when selected voice pack has no loaded sounds', () => {
    expect(
      canPlaySoundEvent('command.agent-send-prompt', {
        voicePackId: 'peonping:unknown-pack',
      })
    ).toBe(false);
  });

  test('keeps agent SFX available when voice lines are muted', () => {
    expect(
      canPlaySoundEvent('agent.completion', {
        voicePackId: 'peonping:unknown-pack',
        voiceMuted: true,
      })
    ).toBe(true);
  });
});

describe('peonping agent mapping', () => {
  test('maps only agent lifecycle events', () => {
    const mapping = new Map(
      PEONPING_AGENT_EVENT_MAPPINGS.map((entry) => [entry.targetEventId, entry.category])
    );
    expect(mapping.get('agent.create')).toBe('session.start');
    expect(mapping.get('command.create-agent-claude')).toBe('session.start');
    expect(mapping.get('command.create-agent-codex')).toBe('session.start');
    expect(mapping.get('command.agent-send-prompt')).toBe('task.acknowledge');
    expect(mapping.get('agent.completion')).toBe('task.complete');
    expect(mapping.get('agent.error')).toBe('task.error');
    expect(mapping.get('command.destroy-agent')).toBe('session.end');
    expect(mapping.has('command.create-folder')).toBe(false);
    expect(mapping.has('command.create-browser')).toBe(false);
    expect(mapping.has('world.ability')).toBe(false);
  });
});

describe('sound pack registry', () => {
  test('defines each required event in every pack', () => {
    for (const pack of Object.values(SOUND_PACKS)) {
      for (const eventId of SOUND_EVENT_IDS) {
        expect(pack.events[eventId]).toBeDefined();
      }
    }
  });

  test('includes command sound slots for every command registry entry', () => {
    const registryCommandIds = commandDefinitions.map((definition) => definition.id);
    expect(new Set(COMMAND_IDS)).toEqual(new Set(registryCommandIds));

    for (const commandId of registryCommandIds) {
      const eventId = toCommandSoundEventId(commandId);
      expect(COMMAND_SOUND_EVENT_IDS).toContain(eventId);
      for (const pack of Object.values(SOUND_PACKS)) {
        expect(pack.events[eventId]).toBeDefined();
      }
    }
  });

  test('keeps current create command sounds active by default', () => {
    const pack = SOUND_PACKS.default;
    expect(pack.events[toCommandSoundEventId('create-agent-claude')].kind).toBe('file');
    expect(pack.events[toCommandSoundEventId('create-agent-codex')].kind).toBe('file');
    expect(pack.events[toCommandSoundEventId('create-folder')].kind).toBe('file');
    expect(pack.events[toCommandSoundEventId('create-terminal')].kind).toBe('file');
    expect(pack.events[toCommandSoundEventId('create-browser')].kind).toBe('file');
    expect(pack.events[toCommandSoundEventId('create-worktree')].kind).toBe('file');
  });
});

describe('sound event overrides', () => {
  test('normalizes only valid sound event override entries', () => {
    const custom = toCustomSoundSource('file:///tmp/custom-alert.wav');
    if (!custom) throw new Error('Expected custom sound source');
    const normalized = normalizeSoundEventOverrides({
      'agent.completion': 'agent.error',
      'command.create-folder': SOUND_EVENT_OVERRIDE_SILENT,
      'agent.error': custom,
      'subscription.success': 'agent.error',
      'not-real-event': 'agent.error',
      'agent.create': 'not-real-source',
    });
    expect(normalized).toEqual({
      'agent.completion': 'agent.error',
      'command.create-folder': SOUND_EVENT_OVERRIDE_SILENT,
      'agent.error': custom,
    });
  });

  test('supports encoding and decoding custom sound sources', () => {
    const source = toCustomSoundSource('file:///tmp/sounds/whoosh.mp3');
    expect(source).toMatch(new RegExp(`^${CUSTOM_SOUND_SOURCE_PREFIX}`));
    if (!source) throw new Error('Expected custom source to be created');
    expect(parseCustomSoundSource(source)).toBe('file:///tmp/sounds/whoosh.mp3');
  });

  test('derives readable labels for uploaded custom sound files', () => {
    const source = toCustomSoundSource(
      'file:///tmp/sounds/3f4f2bf0-1234-1234-1234-123456789abc-battle-horn.wav'
    );
    if (!source) throw new Error('Expected custom source to be created');
    expect(getCustomSoundLabel(source)).toBe('battle-horn');
  });

  test('sound options include every sound event', () => {
    const optionIds = new Set(SOUND_EVENT_OPTIONS.map((option) => option.id));
    for (const eventId of SOUND_EVENT_IDS) {
      expect(optionIds.has(eventId)).toBe(true);
    }
  });
});

describe('audio settings normalization', () => {
  test('normalizes legacy mute flags and clamps volume', () => {
    const normalized = normalizeAudioSettings(
      {
        masterVolume: 5,
      },
      { muteAudio: true }
    );
    expect(normalized.muted).toBe(true);
    expect(normalized.masterVolume).toBe(1);
  });

  test('drops invalid sound-pack override IDs', () => {
    const normalized = normalizeAudioSettings({
      muted: false,
      masterVolume: 0.4,
      soundPackOverrideId: 'peonping:peon',
      voicePackOverrideId: 'peonping:peon',
      voicePackOverrideIdByProvider: {
        claude: 'peonping:peon',
        codex: '',
        notRealProvider: 'peonping:murloc',
      },
    });
    expect(normalized.muted).toBe(false);
    expect(normalized.masterVolume).toBe(0.4);
    expect(normalized.soundPackOverrideId).toBeUndefined();
    expect(normalized.voicePackOverrideId).toBe('peonping:peon');
    expect(normalized.voicePackOverrideIdByProvider).toEqual({
      claude: 'peonping:peon',
    });
  });

  test('normalizes sound-event overrides from audio settings', () => {
    const normalized = normalizeAudioSettings({
      muted: false,
      masterVolume: 0.4,
      soundEventOverrides: {
        'command.create-folder': 'agent.error',
        '': 'agent.error',
        'agent.create': 123,
      },
    });
    expect(normalized.soundEventOverrides).toEqual({
      'command.create-folder': 'agent.error',
    });
  });
});
