import { COMMAND_IDS, type CommandId } from '../../shared/commands';
import { DEFAULT_SOUND_PACK_ID } from '../../shared/types';
import type { SoundPackId, VoicePackId } from '../../shared/types';

const BASE_SOUND_EVENT_IDS = [
  'agent.error',
  'agent.completion',
  'agent.create',
  'folder.create',
  'folder.import',
  'world.ability',
  'subscription.success',
] as const;

type BaseSoundEventId = (typeof BASE_SOUND_EVENT_IDS)[number];
export type CommandSoundEventId = `command.${CommandId}`;
export type SoundEventId = BaseSoundEventId | CommandSoundEventId;

export const SOUND_EVENT_OVERRIDE_SILENT = '__silent__' as const;
export const CUSTOM_SOUND_SOURCE_PREFIX = '__custom_sound__:' as const;
export type CustomSoundSource = `${typeof CUSTOM_SOUND_SOURCE_PREFIX}${string}`;
export type SoundEventOverrideValue = SoundEventId | typeof SOUND_EVENT_OVERRIDE_SILENT | CustomSoundSource;
export type SoundEventOverrideMap = Partial<Record<SoundEventId, SoundEventOverrideValue>>;

export const toCommandSoundEventId = (commandId: CommandId): CommandSoundEventId =>
  `command.${commandId}` as CommandSoundEventId;

export const COMMAND_SOUND_EVENT_IDS: ReadonlyArray<CommandSoundEventId> = COMMAND_IDS.map((commandId) =>
  toCommandSoundEventId(commandId)
);

export const SOUND_EVENT_IDS: ReadonlyArray<SoundEventId> = [
  ...BASE_SOUND_EVENT_IDS,
  ...COMMAND_SOUND_EVENT_IDS,
];

const SOUND_EVENT_ID_SET = new Set<string>(SOUND_EVENT_IDS);

export const isSoundEventId = (value: unknown): value is SoundEventId =>
  typeof value === 'string' && SOUND_EVENT_ID_SET.has(value);

export const toCustomSoundSource = (sourceUrl: string): CustomSoundSource | null => {
  const normalized = sourceUrl.trim();
  if (!normalized) return null;
  return `${CUSTOM_SOUND_SOURCE_PREFIX}${encodeURIComponent(normalized)}` as CustomSoundSource;
};

export const parseCustomSoundSource = (value: string): string | null => {
  if (!value.startsWith(CUSTOM_SOUND_SOURCE_PREFIX)) return null;
  const encoded = value.slice(CUSTOM_SOUND_SOURCE_PREFIX.length).trim();
  if (!encoded) return null;
  try {
    const decoded = decodeURIComponent(encoded).trim();
    return decoded || null;
  } catch {
    return encoded;
  }
};

export const isCustomSoundSource = (value: unknown): value is CustomSoundSource =>
  typeof value === 'string' && parseCustomSoundSource(value) !== null;

const stripUploadedSoundPrefix = (name: string): string =>
  name.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, '');

export const getCustomSoundLabel = (value: string): string => {
  const sourceUrl = parseCustomSoundSource(value);
  if (!sourceUrl) return 'Uploaded sound';
  try {
    const url = new URL(sourceUrl);
    const fileName = decodeURIComponent(url.pathname.split('/').pop() ?? '');
    const withoutExt = fileName.replace(/\.[^.]+$/, '');
    const cleaned = stripUploadedSoundPrefix(withoutExt).trim();
    return cleaned || 'Uploaded sound';
  } catch {
    const rawName = sourceUrl.split(/[\\/]/).pop() ?? sourceUrl;
    const withoutExt = rawName.replace(/\.[^.]+$/, '');
    const cleaned = stripUploadedSoundPrefix(withoutExt).trim();
    return cleaned || 'Uploaded sound';
  }
};

export const isSoundEventOverrideValue = (value: unknown): value is SoundEventOverrideValue =>
  value === SOUND_EVENT_OVERRIDE_SILENT || isSoundEventId(value) || isCustomSoundSource(value);

export const normalizeSoundEventOverrides = (value: unknown): SoundEventOverrideMap => {
  if (!value || typeof value !== 'object') return {};
  const entries = Object.entries(value as Record<string, unknown>);
  const normalized: SoundEventOverrideMap = {};
  for (const [targetEvent, sourceEvent] of entries) {
    if (!isSoundEventId(targetEvent)) continue;
    if (targetEvent === 'subscription.success') continue;
    if (!isSoundEventOverrideValue(sourceEvent)) continue;
    normalized[targetEvent] = sourceEvent;
  }
  return normalized;
};

const formatCommandLabel = (commandId: CommandId): string => {
  const words = commandId.split('-').map((segment) => {
    if (segment === 'mcp') return 'MCP';
    if (segment === 'ui') return 'UI';
    if (segment === 'codex') return 'Codex';
    if (segment === 'claude') return 'Claude';
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  });
  return words.join(' ');
};

export type SoundEventOption = {
  id: SoundEventId;
  label: string;
  group: 'Core' | 'Command';
};

const BASE_SOUND_EVENT_OPTIONS: ReadonlyArray<SoundEventOption> = [
  { id: 'agent.error', label: 'Agent Error', group: 'Core' },
  { id: 'agent.completion', label: 'Agent Completion', group: 'Core' },
  { id: 'agent.create', label: 'Agent Created', group: 'Core' },
  { id: 'folder.create', label: 'Folder Created', group: 'Core' },
  { id: 'folder.import', label: 'Folder Imported', group: 'Core' },
  { id: 'world.ability', label: 'World Ability', group: 'Core' },
  { id: 'subscription.success', label: 'Subscription Success', group: 'Core' },
];

const COMMAND_SOUND_EVENT_OPTIONS: ReadonlyArray<SoundEventOption> = COMMAND_IDS.map((commandId) => ({
  id: toCommandSoundEventId(commandId),
  label: `Command: ${formatCommandLabel(commandId)}`,
  group: 'Command',
}));

export const SOUND_EVENT_OPTIONS: ReadonlyArray<SoundEventOption> = [
  ...BASE_SOUND_EVENT_OPTIONS,
  ...COMMAND_SOUND_EVENT_OPTIONS,
];

const SOUND_EVENT_OPTION_MAP = new Map<SoundEventId, SoundEventOption>(
  SOUND_EVENT_OPTIONS.map((option) => [option.id, option])
);

export const getSoundEventLabel = (eventId: SoundEventId): string =>
  SOUND_EVENT_OPTION_MAP.get(eventId)?.label ?? eventId;

type FileSoundDefinition = {
  kind: 'file';
  src: string;
  volume?: number;
};

type PlaylistSoundDefinition = {
  kind: 'playlist';
  srcs: ReadonlyArray<string>;
  volume?: number;
};

type SilentSoundDefinition = {
  kind: 'silent';
};

type ChimeTone = {
  frequency: number;
  start: number;
  duration: number;
  gain: number;
  wave?: OscillatorType;
};

type ChimeSoundDefinition = {
  kind: 'chime';
  notes: ReadonlyArray<ChimeTone>;
  volume?: number;
};

type SoundEventDefinition =
  | FileSoundDefinition
  | PlaylistSoundDefinition
  | ChimeSoundDefinition
  | SilentSoundDefinition;
type SoundEventMap = Record<SoundEventId, SoundEventDefinition>;
type BaseSoundEventMap = Record<BaseSoundEventId, SoundEventDefinition>;
type CommandSoundEventMap = Record<CommandSoundEventId, SoundEventDefinition>;

export interface SoundPackDefinition {
  id: SoundPackId;
  label: string;
  events: SoundEventMap;
}

export interface VoicePackDefinition {
  id: VoicePackId;
  label: string;
  events: Partial<Record<SoundEventId, SoundEventDefinition>>;
}

type PlaySoundEventOptions = {
  muted?: boolean;
  voiceMuted?: boolean;
  masterVolume?: number;
  volumeScale?: number;
  soundPackId?: SoundPackId;
  voicePackId?: VoicePackId;
  eventOverrides?: SoundEventOverrideMap;
};

type SoundPackListEntry = {
  id: SoundPackId;
  label: string;
};

type VoicePackListEntry = {
  id: VoicePackId;
  label: string;
};

type PeonPingRegistryPackEntry = {
  name: string;
  display_name: string;
  source_repo: string;
  source_ref: string;
  source_path?: string;
};

type PeonPingRegistryIndex = {
  packs?: PeonPingRegistryPackEntry[];
};

type PeonPingManifestCategory = {
  sounds?: ReadonlyArray<{ file?: string }>;
};

type PeonPingManifest = {
  categories?: Record<string, PeonPingManifestCategory>;
};

type CespCategory =
  | 'session.start'
  | 'session.end'
  | 'task.acknowledge'
  | 'task.complete'
  | 'task.error'
  | 'task.progress'
  | 'input.required'
  | 'resource.limit'
  | 'user.spam';

const PEONPING_SOUND_PACK_PREFIX = 'peonping:';
const PEONPING_REGISTRY_INDEX_URL = 'https://peonping.github.io/registry/index.json';

type PeonPingPackRecord = {
  id: VoicePackId;
  label: string;
  sourceRepo: string;
  sourceRef: string;
  sourcePath: string;
};

const fileSources = {
  agentError: new URL('../assets/sfx/agent-error.wav', import.meta.url).toString(),
  importFolder: new URL('../assets/sfx/suction-pop.mp3', import.meta.url).toString(),
  worldAbility: new URL('../assets/sfx/pneumata.wav', import.meta.url).toString(),
  subscriptionSuccess: new URL('../assets/sfx/victory-fanfare.mp3', import.meta.url).toString(),
};

const defaultCompletionNotes: ReadonlyArray<ChimeTone> = [
  { frequency: 880, start: 0, duration: 0.2, gain: 0.8, wave: 'sine' },
  { frequency: 1318.51, start: 0.06, duration: 0.25, gain: 0.7, wave: 'sine' },
];

const arcadeCompletionNotes: ReadonlyArray<ChimeTone> = [
  { frequency: 659.25, start: 0, duration: 0.14, gain: 0.7, wave: 'triangle' },
  { frequency: 987.77, start: 0.05, duration: 0.18, gain: 0.8, wave: 'triangle' },
  { frequency: 1318.51, start: 0.11, duration: 0.24, gain: 0.65, wave: 'triangle' },
];

const buildSilentCommandEvents = (): CommandSoundEventMap => {
  return Object.fromEntries(
    COMMAND_SOUND_EVENT_IDS.map((eventId) => [eventId, { kind: 'silent' } as const])
  ) as CommandSoundEventMap;
};

const buildSoundPackEvents = ({
  base,
  commandOverrides,
}: {
  base: BaseSoundEventMap;
  commandOverrides?: Partial<CommandSoundEventMap>;
}): SoundEventMap => {
  return {
    ...base,
    ...buildSilentCommandEvents(),
    ...(commandOverrides ?? {}),
  };
};

const defaultBaseEvents: BaseSoundEventMap = {
  'agent.error': { kind: 'file', src: fileSources.agentError, volume: 0.6 },
  'agent.completion': { kind: 'chime', notes: defaultCompletionNotes, volume: 0.25 },
  'agent.create': { kind: 'file', src: fileSources.worldAbility, volume: 0.22 },
  'folder.create': { kind: 'file', src: fileSources.importFolder, volume: 0.3 },
  'folder.import': { kind: 'file', src: fileSources.importFolder, volume: 0.35 },
  'world.ability': { kind: 'file', src: fileSources.worldAbility, volume: 0.25 },
  'subscription.success': { kind: 'file', src: fileSources.subscriptionSuccess, volume: 0.75 },
};

const arcadeBaseEvents: BaseSoundEventMap = {
  'agent.error': { kind: 'file', src: fileSources.agentError, volume: 0.45 },
  'agent.completion': { kind: 'chime', notes: arcadeCompletionNotes, volume: 0.2 },
  'agent.create': { kind: 'file', src: fileSources.worldAbility, volume: 0.18 },
  'folder.create': { kind: 'file', src: fileSources.importFolder, volume: 0.25 },
  'folder.import': { kind: 'file', src: fileSources.importFolder, volume: 0.28 },
  'world.ability': { kind: 'file', src: fileSources.worldAbility, volume: 0.2 },
  'subscription.success': { kind: 'file', src: fileSources.subscriptionSuccess, volume: 0.65 },
};

const defaultCommandOverrides: Partial<CommandSoundEventMap> = {
  [toCommandSoundEventId('create-agent-claude')]: defaultBaseEvents['agent.create'],
  [toCommandSoundEventId('create-agent-codex')]: defaultBaseEvents['agent.create'],
  [toCommandSoundEventId('create-folder')]: defaultBaseEvents['folder.create'],
  [toCommandSoundEventId('create-terminal')]: defaultBaseEvents['world.ability'],
  [toCommandSoundEventId('create-browser')]: defaultBaseEvents['world.ability'],
  [toCommandSoundEventId('create-worktree')]: defaultBaseEvents['world.ability'],
};

const arcadeCommandOverrides: Partial<CommandSoundEventMap> = {
  [toCommandSoundEventId('create-agent-claude')]: arcadeBaseEvents['agent.create'],
  [toCommandSoundEventId('create-agent-codex')]: arcadeBaseEvents['agent.create'],
  [toCommandSoundEventId('create-folder')]: arcadeBaseEvents['folder.create'],
  [toCommandSoundEventId('create-terminal')]: arcadeBaseEvents['world.ability'],
  [toCommandSoundEventId('create-browser')]: arcadeBaseEvents['world.ability'],
  [toCommandSoundEventId('create-worktree')]: arcadeBaseEvents['world.ability'],
};

const builtinSoundPackRegistry = {
  default: {
    id: 'default',
    label: 'Default',
    events: buildSoundPackEvents({
      base: defaultBaseEvents,
      commandOverrides: defaultCommandOverrides,
    }),
  },
  arcade: {
    id: 'arcade',
    label: 'Arcade',
    events: buildSoundPackEvents({
      base: arcadeBaseEvents,
      commandOverrides: arcadeCommandOverrides,
    }),
  },
} as const;

const toPeonPingVoicePackId = (name: string): VoicePackId => `${PEONPING_SOUND_PACK_PREFIX}${name}`;

const isPeonPingVoicePackId = (voicePackId: string): boolean =>
  voicePackId.startsWith(PEONPING_SOUND_PACK_PREFIX);

const isBuiltinSoundPackId = (soundPackId: string): soundPackId is keyof typeof builtinSoundPackRegistry =>
  soundPackId in builtinSoundPackRegistry;

const encodePathSegments = (value: string): string =>
  value
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

const normalizeSourcePath = (value: string | undefined): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed === '.') return '';
  return trimmed.replace(/^\/+|\/+$/g, '');
};

const buildRawGitHubUrl = ({
  sourceRepo,
  sourceRef,
  sourcePath,
  filePath,
}: {
  sourceRepo: string;
  sourceRef: string;
  sourcePath: string;
  filePath: string;
}): string => {
  const refPath = encodePathSegments(sourceRef);
  const sourcePathPrefix = sourcePath ? `${encodePathSegments(sourcePath)}/` : '';
  return `https://raw.githubusercontent.com/${sourceRepo}/${refPath}/${sourcePathPrefix}${encodePathSegments(filePath)}`;
};

export const PEONPING_AGENT_EVENT_MAPPINGS: ReadonlyArray<{
  targetEventId: SoundEventId;
  category: CespCategory;
  volume: number;
}> = [
  { targetEventId: 'agent.create', category: 'session.start', volume: 0.22 },
  { targetEventId: toCommandSoundEventId('create-agent-claude'), category: 'session.start', volume: 0.22 },
  { targetEventId: toCommandSoundEventId('create-agent-codex'), category: 'session.start', volume: 0.22 },
  { targetEventId: toCommandSoundEventId('agent-send-prompt'), category: 'task.acknowledge', volume: 0.22 },
  { targetEventId: 'agent.completion', category: 'task.complete', volume: 0.25 },
  { targetEventId: 'agent.error', category: 'task.error', volume: 0.5 },
  { targetEventId: toCommandSoundEventId('destroy-agent'), category: 'session.end', volume: 0.22 },
];

const PEONPING_MAPPED_EVENT_ID_SET = new Set<SoundEventId>(
  PEONPING_AGENT_EVENT_MAPPINGS.map((mapping) => mapping.targetEventId)
);

const createPeonPingPlaceholderEvents = (): Partial<Record<SoundEventId, SoundEventDefinition>> => {
  const events: Partial<Record<SoundEventId, SoundEventDefinition>> = {};
  for (const eventId of PEONPING_MAPPED_EVENT_ID_SET) {
    events[eventId] = { kind: 'silent' };
  }
  return events;
};

const getManifestCategoryFilePaths = (manifest: PeonPingManifest, category: CespCategory): string[] => {
  const categoryEntry = manifest.categories?.[category];
  if (!categoryEntry || !Array.isArray(categoryEntry.sounds)) return [];
  const filePaths: string[] = [];
  for (const sound of categoryEntry.sounds) {
    if (!sound || typeof sound !== 'object') continue;
    const file = typeof sound.file === 'string' ? sound.file.trim() : '';
    if (!file) continue;
    filePaths.push(file);
  }
  return filePaths;
};

const buildPeonPingVoicePack = (
  record: PeonPingPackRecord,
  manifest: PeonPingManifest
): VoicePackDefinition => {
  const events = createPeonPingPlaceholderEvents();
  for (const mapping of PEONPING_AGENT_EVENT_MAPPINGS) {
    const files = getManifestCategoryFilePaths(manifest, mapping.category);
    if (files.length === 0) {
      events[mapping.targetEventId] = { kind: 'silent' };
      continue;
    }
    const urls = files.map((filePath) =>
      buildRawGitHubUrl({
        sourceRepo: record.sourceRepo,
        sourceRef: record.sourceRef,
        sourcePath: record.sourcePath,
        filePath,
      })
    );
    events[mapping.targetEventId] =
      urls.length === 1
        ? { kind: 'file', src: urls[0], volume: mapping.volume }
        : { kind: 'playlist', srcs: urls, volume: mapping.volume };
  }
  return {
    id: record.id,
    label: record.label,
    events,
  };
};

const createPeonPingPlaceholderVoicePack = (
  voicePackId: VoicePackId,
  label: string
): VoicePackDefinition => ({
  id: voicePackId,
  label,
  events: createPeonPingPlaceholderEvents(),
});

const voicePackRegistry = new Map<VoicePackId, VoicePackDefinition>();
const peonPingVoicePackCatalog = new Map<VoicePackId, PeonPingPackRecord>();
const peonPingVoicePackLoadPromises = new Map<VoicePackId, Promise<void>>();
let peonPingVoiceCatalogEntries: ReadonlyArray<VoicePackListEntry> = [];
let peonPingVoiceCatalogLoadPromise: Promise<ReadonlyArray<VoicePackListEntry>> | null = null;

export const SOUND_PACKS = builtinSoundPackRegistry;

export const SOUND_PACK_LIST: ReadonlyArray<{ id: SoundPackId; label: string }> = Object.values(
  builtinSoundPackRegistry
).map((pack) => ({
  id: pack.id,
  label: pack.label,
}));

export const getSoundPackList = (): ReadonlyArray<SoundPackListEntry> => [...SOUND_PACK_LIST];

export const getVoicePackList = (): ReadonlyArray<VoicePackListEntry> => [...peonPingVoiceCatalogEntries];

const parsePeonPingRegistryIndex = (value: unknown): PeonPingPackRecord[] => {
  if (!value || typeof value !== 'object') return [];
  const index = value as PeonPingRegistryIndex;
  if (!Array.isArray(index.packs)) return [];
  const records: PeonPingPackRecord[] = [];
  for (const pack of index.packs) {
    if (!pack || typeof pack !== 'object') continue;
    const name = typeof pack.name === 'string' ? pack.name.trim() : '';
    const label = typeof pack.display_name === 'string' ? pack.display_name.trim() : '';
    const sourceRepo = typeof pack.source_repo === 'string' ? pack.source_repo.trim() : '';
    const sourceRef = typeof pack.source_ref === 'string' ? pack.source_ref.trim() : '';
    if (!name || !label || !sourceRepo || !sourceRef) continue;
    records.push({
      id: toPeonPingVoicePackId(name),
      label,
      sourceRepo,
      sourceRef,
      sourcePath: normalizeSourcePath(pack.source_path),
    });
  }
  return records.sort((a, b) => a.label.localeCompare(b.label));
};

export const loadPeonPingVoicePackCatalog = async (): Promise<ReadonlyArray<VoicePackListEntry>> => {
  if (peonPingVoiceCatalogLoadPromise) {
    return peonPingVoiceCatalogLoadPromise;
  }
  peonPingVoiceCatalogLoadPromise = (async () => {
    try {
      const response = await fetch(PEONPING_REGISTRY_INDEX_URL);
      if (!response.ok) {
        return peonPingVoiceCatalogEntries;
      }
      const parsed = parsePeonPingRegistryIndex(await response.json());
      peonPingVoiceCatalogEntries = parsed.map((record) => ({ id: record.id, label: record.label }));
      for (const record of parsed) {
        peonPingVoicePackCatalog.set(record.id, record);
        if (!voicePackRegistry.has(record.id)) {
          voicePackRegistry.set(record.id, createPeonPingPlaceholderVoicePack(record.id, record.label));
        }
      }
      return peonPingVoiceCatalogEntries;
    } catch {
      return peonPingVoiceCatalogEntries;
    }
  })();
  return peonPingVoiceCatalogLoadPromise;
};

export const ensurePeonPingVoicePackLoaded = async (voicePackId: VoicePackId): Promise<void> => {
  if (!isPeonPingVoicePackId(voicePackId)) return;
  if (!peonPingVoicePackCatalog.has(voicePackId)) {
    await loadPeonPingVoicePackCatalog();
  }
  const record = peonPingVoicePackCatalog.get(voicePackId);
  if (!record) return;
  const existingPromise = peonPingVoicePackLoadPromises.get(voicePackId);
  if (existingPromise) {
    await existingPromise;
    return;
  }
  const loadPromise = (async () => {
    try {
      const manifestUrl = buildRawGitHubUrl({
        sourceRepo: record.sourceRepo,
        sourceRef: record.sourceRef,
        sourcePath: record.sourcePath,
        filePath: 'openpeon.json',
      });
      const response = await fetch(manifestUrl);
      if (!response.ok) {
        voicePackRegistry.set(voicePackId, createPeonPingPlaceholderVoicePack(record.id, record.label));
        return;
      }
      const manifest = (await response.json()) as PeonPingManifest;
      voicePackRegistry.set(voicePackId, buildPeonPingVoicePack(record, manifest));
    } catch {
      voicePackRegistry.set(voicePackId, createPeonPingPlaceholderVoicePack(record.id, record.label));
    }
  })();
  peonPingVoicePackLoadPromises.set(voicePackId, loadPromise);
  await loadPromise;
};

export const resolveSoundPackId = ({
  overrideSoundPackId,
  themeDefaultSoundPackId,
}: {
  overrideSoundPackId?: SoundPackId;
  themeDefaultSoundPackId?: SoundPackId;
}): SoundPackId => {
  if (overrideSoundPackId && isBuiltinSoundPackId(overrideSoundPackId)) {
    return overrideSoundPackId;
  }
  if (themeDefaultSoundPackId && isBuiltinSoundPackId(themeDefaultSoundPackId)) {
    return themeDefaultSoundPackId;
  }
  return DEFAULT_SOUND_PACK_ID;
};

export const resolveVoicePackId = (overrideVoicePackId?: VoicePackId): VoicePackId | undefined => {
  if (!overrideVoicePackId) return undefined;
  return isPeonPingVoicePackId(overrideVoicePackId) ? overrideVoicePackId : undefined;
};

const getSoundPack = (soundPackId?: SoundPackId): SoundPackDefinition => {
  if (soundPackId && isBuiltinSoundPackId(soundPackId)) {
    return builtinSoundPackRegistry[soundPackId];
  }
  return builtinSoundPackRegistry[DEFAULT_SOUND_PACK_ID];
};

const getVoicePack = (voicePackId?: VoicePackId): VoicePackDefinition | null => {
  if (!voicePackId || !isPeonPingVoicePackId(voicePackId)) return null;
  const existingPack = voicePackRegistry.get(voicePackId);
  if (existingPack) return existingPack;
  const label = voicePackId.slice(PEONPING_SOUND_PACK_PREFIX.length) || voicePackId;
  const placeholder = createPeonPingPlaceholderVoicePack(voicePackId, label);
  voicePackRegistry.set(voicePackId, placeholder);
  return placeholder;
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const audioCache = new Map<string, HTMLAudioElement>();

const getAudio = (src: string): HTMLAudioElement => {
  const existing = audioCache.get(src);
  if (existing) return existing;
  const audio = new Audio(src);
  audio.preload = 'auto';
  audioCache.set(src, audio);
  return audio;
};

const playFileSound = (sound: FileSoundDefinition, volume: number): void => {
  const audio = getAudio(sound.src);
  audio.currentTime = 0;
  audio.volume = volume;
  const playback = audio.play();
  if (playback && typeof playback.catch === 'function') {
    void playback.catch(() => {});
  }
};

const playChimeSound = (sound: ChimeSoundDefinition, volume: number): void => {
  try {
    const AudioCtx =
      globalThis.AudioContext ||
      (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(volume, now);
    master.connect(ctx.destination);

    sound.notes.forEach((note) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = note.wave ?? 'sine';
      osc.frequency.setValueAtTime(note.frequency, now + note.start);
      gainNode.gain.setValueAtTime(0, now + note.start);
      gainNode.gain.linearRampToValueAtTime(note.gain, now + note.start + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.duration);
      osc.connect(gainNode).connect(master);
      osc.start(now + note.start);
      osc.stop(now + note.start + note.duration + 0.02);
    });
  } catch {
    // ignore audio errors
  }
};

const resolveEffectiveEventId = (
  eventId: SoundEventId,
  overrides?: SoundEventOverrideMap
): SoundEventId | CustomSoundSource | null => {
  const override = overrides?.[eventId];
  if (!override) return eventId;
  if (override === SOUND_EVENT_OVERRIDE_SILENT) return null;
  if (isCustomSoundSource(override)) return override;
  return isSoundEventId(override) ? override : eventId;
};

const resolveSoundEventDefinition = (
  eventId: SoundEventId,
  options?: Pick<PlaySoundEventOptions, 'eventOverrides' | 'soundPackId' | 'voicePackId' | 'voiceMuted'>
): SoundEventDefinition | null => {
  const effectiveEventIdOrSource = resolveEffectiveEventId(eventId, options?.eventOverrides);
  if (!effectiveEventIdOrSource) return null;

  let sound: SoundEventDefinition | undefined;
  if (isCustomSoundSource(effectiveEventIdOrSource)) {
    const sourceUrl = parseCustomSoundSource(effectiveEventIdOrSource);
    if (!sourceUrl) return null;
    sound = { kind: 'file', src: sourceUrl, volume: 0.6 };
  } else {
    if (PEONPING_MAPPED_EVENT_ID_SET.has(effectiveEventIdOrSource) && !options?.voiceMuted) {
      const voicePack = getVoicePack(options?.voicePackId);
      if (voicePack) {
        const voiceSound = voicePack.events[effectiveEventIdOrSource];
        if (!voiceSound || voiceSound.kind === 'silent') return null;
        sound = voiceSound;
      }
    }
    if (!sound) {
      const soundPack = getSoundPack(options?.soundPackId);
      sound =
        soundPack.events[effectiveEventIdOrSource] ??
        builtinSoundPackRegistry[DEFAULT_SOUND_PACK_ID].events[effectiveEventIdOrSource];
      if (!sound || sound.kind === 'silent') return null;
    }
  }

  return sound;
};

export const canPlaySoundEvent = (
  eventId: SoundEventId,
  options?: Pick<PlaySoundEventOptions, 'eventOverrides' | 'soundPackId' | 'voicePackId' | 'voiceMuted'>
): boolean => {
  const sound = resolveSoundEventDefinition(eventId, options);
  if (!sound || sound.kind === 'silent') return false;
  if (sound.kind !== 'playlist') return true;
  return sound.srcs.length > 0;
};

export const playSoundEvent = (eventId: SoundEventId, options?: PlaySoundEventOptions): void => {
  if (options?.muted) return;

  const sound = resolveSoundEventDefinition(eventId, options);
  if (!sound || sound.kind === 'silent') return;

  const baseVolume = sound.volume ?? 0.6;
  const masterVolume = options?.masterVolume ?? 1;
  const volumeScale = options?.volumeScale ?? 1;
  const volume = clamp01(baseVolume * masterVolume * volumeScale);

  if (volume <= 0) return;

  if (sound.kind === 'file') {
    playFileSound(sound, volume);
    return;
  }

  if (sound.kind === 'playlist') {
    if (sound.srcs.length === 0) return;
    const randomIndex = Math.floor(Math.random() * sound.srcs.length);
    const src = sound.srcs[randomIndex];
    if (!src) return;
    playFileSound({ kind: 'file', src }, volume);
    return;
  }

  if (sound.kind !== 'chime') return;
  playChimeSound(sound, volume);
};
