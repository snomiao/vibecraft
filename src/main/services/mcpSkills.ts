import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AgentProvider,
  McpServerConfig,
  McpSkillDescriptor,
  McpSkillId,
  UnitType,
} from '../../shared/types';
import { VIBECRAFT_CORE_MCP_SKILL_ID, VIBECRAFT_DOCS_MCP_SKILL_ID } from '../../shared/types';
import type { StorageNamespace } from './storageNamespace';

type ResolveUnitMcpServerInput = {
  unitType: UnitType;
  skillIds: McpSkillId[];
  workspacePath: string;
  attachedFolderPath?: string;
  storageNamespace: StorageNamespace;
  provider?: AgentProvider;
};

type ValidateUnitMcpSkillsInput = {
  unitType: UnitType;
  skillIds: unknown;
  provider?: AgentProvider;
};

type ValidateUnitMcpSkillsResult = {
  skillIds: McpSkillId[];
  invalidSkillIds: McpSkillId[];
};

type SkillDefinition = {
  descriptor: McpSkillDescriptor;
  resolve: (input: ResolveUnitMcpServerInput) => McpServerConfig;
};

const binaryName = process.platform === 'win32' ? 'vibecraft-mcp.exe' : 'vibecraft-mcp';
const DOCS_DIR_NAME = 'docs';

const resolveDevScriptPath = (): string => {
  const appPath = typeof app?.getAppPath === 'function' ? app.getAppPath() : process.cwd();
  const candidates = [
    path.join(appPath, 'scripts', 'vibecraft-mcp.mjs'),
    path.resolve(appPath, '..', 'scripts', 'vibecraft-mcp.mjs'),
    path.resolve(process.cwd(), 'scripts', 'vibecraft-mcp.mjs'),
    path.resolve(process.cwd(), 'vibecraft', 'scripts', 'vibecraft-mcp.mjs'),
  ];
  const match = candidates.find((candidate) => fs.existsSync(candidate));
  return match ?? candidates[0];
};

const resolveVibecraftCoreServer = (
  input: ResolveUnitMcpServerInput,
  options?: { docsRoot?: string }
): McpServerConfig => {
  const packagedBinaryPath =
    typeof process.resourcesPath === 'string' && process.resourcesPath.length > 0
      ? path.join(process.resourcesPath, 'mcp', binaryName)
      : null;
  const hasPackagedBinary = Boolean(packagedBinaryPath && fs.existsSync(packagedBinaryPath));

  const commonArgs = ['--workspace', input.workspacePath, '--storage', input.storageNamespace];
  if (options?.docsRoot) {
    commonArgs.push('--docs-root', options.docsRoot);
  }
  const env: Record<string, string> = {
    VIBECRAFT_WORKSPACE: input.workspacePath,
    VIBECRAFT_STORAGE_NAMESPACE: input.storageNamespace,
  };
  if (options?.docsRoot) {
    env.VIBECRAFT_DOCS_ROOT = options.docsRoot;
  }
  if (input.attachedFolderPath) {
    env.VIBECRAFT_ATTACHED_FOLDER = input.attachedFolderPath;
  }

  if (hasPackagedBinary && packagedBinaryPath) {
    return {
      command: packagedBinaryPath,
      args: commonArgs,
      env,
      cwd: input.workspacePath,
      enabled: true,
    };
  }

  const scriptPath = resolveDevScriptPath();
  const nodeCommand = process.env.VIBECRAFT_MCP_NODE_BIN?.trim() || 'node';

  return {
    command: nodeCommand,
    args: [scriptPath, ...commonArgs],
    env,
    cwd: input.workspacePath,
    enabled: true,
  };
};

const SKILL_DEFINITIONS: SkillDefinition[] = [
  {
    descriptor: {
      id: VIBECRAFT_CORE_MCP_SKILL_ID,
      name: 'VibeCraft Core MCP',
      description: 'Core workspace MCP tools for VibeCraft command and layout operations.',
      unitTypes: ['hero', 'agent'],
      requiredForHero: true,
    },
    resolve: resolveVibecraftCoreServer,
  },
  {
    descriptor: {
      id: VIBECRAFT_DOCS_MCP_SKILL_ID,
      name: 'VibeCraft Docs MCP',
      description: 'Documentation resources for user-facing docs in the workspace docs directory.',
      unitTypes: ['hero', 'agent'],
      requiredForHero: true,
    },
    resolve: resolveVibecraftCoreServer,
  },
];

const skillDefinitionMap = new Map<McpSkillId, SkillDefinition>(
  SKILL_DEFINITIONS.map((entry) => [entry.descriptor.id, entry])
);

const normalizeSkillId = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const hasSkill = (skillIds: McpSkillId[], skillId: McpSkillId): boolean =>
  skillIds.some((id) => id === skillId);

const REQUIRED_HERO_SKILLS: McpSkillId[] = SKILL_DEFINITIONS.filter(
  (definition) => definition.descriptor.requiredForHero === true
).map((definition) => definition.descriptor.id);

const isSkillAllowedForProvider = (skill: McpSkillDescriptor, provider?: AgentProvider): boolean => {
  if (!skill.providerAllowList || skill.providerAllowList.length === 0) return true;
  if (!provider) return false;
  return skill.providerAllowList.includes(provider);
};

export const ensureHeroCoreSkill = (skillIds: McpSkillId[]): McpSkillId[] => {
  const required = [...REQUIRED_HERO_SKILLS];
  const extras = skillIds.filter((skillId) => !REQUIRED_HERO_SKILLS.includes(skillId));
  return [...required, ...extras];
};

export const listMcpSkills = (): McpSkillDescriptor[] =>
  SKILL_DEFINITIONS.map((entry) => ({ ...entry.descriptor }));

export const validateUnitMcpSkills = (input: ValidateUnitMcpSkillsInput): ValidateUnitMcpSkillsResult => {
  const values = Array.isArray(input.skillIds) ? input.skillIds : [];
  const deduped: McpSkillId[] = [];
  const invalidSkillIds: McpSkillId[] = [];
  const seen = new Set<McpSkillId>();

  for (const raw of values) {
    const skillId = normalizeSkillId(raw);
    if (!skillId || seen.has(skillId)) continue;
    seen.add(skillId);

    const definition = skillDefinitionMap.get(skillId);
    if (!definition) {
      invalidSkillIds.push(skillId);
      continue;
    }
    if (!definition.descriptor.unitTypes.includes(input.unitType)) {
      invalidSkillIds.push(skillId);
      continue;
    }
    if (!isSkillAllowedForProvider(definition.descriptor, input.provider)) {
      invalidSkillIds.push(skillId);
      continue;
    }
    deduped.push(skillId);
  }

  const skillIds = input.unitType === 'hero' ? ensureHeroCoreSkill(deduped) : deduped;
  return { skillIds, invalidSkillIds };
};

export const resolveUnitMcpServers = (input: ResolveUnitMcpServerInput): Record<string, McpServerConfig> => {
  const { skillIds, invalidSkillIds } = validateUnitMcpSkills({
    unitType: input.unitType,
    skillIds: input.skillIds,
    provider: input.provider,
  });
  if (invalidSkillIds.length > 0) {
    throw new Error(`Unknown or unsupported MCP skill IDs: ${invalidSkillIds.join(', ')}`);
  }

  const servers: Record<string, McpServerConfig> = {};
  const includeCoreServer =
    hasSkill(skillIds, VIBECRAFT_CORE_MCP_SKILL_ID) || hasSkill(skillIds, VIBECRAFT_DOCS_MCP_SKILL_ID);
  if (includeCoreServer) {
    const docsRoot = hasSkill(skillIds, VIBECRAFT_DOCS_MCP_SKILL_ID)
      ? path.join(input.workspacePath, DOCS_DIR_NAME)
      : undefined;
    servers[VIBECRAFT_CORE_MCP_SKILL_ID] = resolveVibecraftCoreServer(input, { docsRoot });
  }
  for (const skillId of skillIds) {
    if (skillId === VIBECRAFT_CORE_MCP_SKILL_ID || skillId === VIBECRAFT_DOCS_MCP_SKILL_ID) {
      continue;
    }
    const definition = skillDefinitionMap.get(skillId);
    if (!definition) continue;
    servers[skillId] = definition.resolve(input);
  }
  return servers;
};

export const isMcpSkillsForwardingEnabled = (): boolean => {
  const value = (process.env.VIBECRAFT_MCP_SKILLS_ENABLED ?? '').trim().toLowerCase();
  if (!value) return true;
  if (value === '0' || value === 'false' || value === 'no' || value === 'off') return false;
  return true;
};
