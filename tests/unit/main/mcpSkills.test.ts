import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { VIBECRAFT_CORE_MCP_SKILL_ID, VIBECRAFT_DOCS_MCP_SKILL_ID } from '../../../src/shared/types';

const electronMocks = vi.hoisted(() => ({
  getAppPath: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getAppPath: electronMocks.getAppPath,
  },
}));

const setResourcesPath = (value: string) => {
  Object.defineProperty(process, 'resourcesPath', {
    configurable: true,
    writable: true,
    value,
  });
};

describe('mcp skill service', () => {
  const originalResourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const originalMcpSkillsFlag = process.env.VIBECRAFT_MCP_SKILLS_ENABLED;
  let tempDir = '';

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibecraft-mcp-skills-'));
    electronMocks.getAppPath.mockReset();
    electronMocks.getAppPath.mockReturnValue(path.join(process.cwd(), 'vibecraft'));
    setResourcesPath(path.join(tempDir, 'resources-none'));
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (originalMcpSkillsFlag === undefined) {
      delete process.env.VIBECRAFT_MCP_SKILLS_ENABLED;
    } else {
      process.env.VIBECRAFT_MCP_SKILLS_ENABLED = originalMcpSkillsFlag;
    }
    if (originalResourcesPath === undefined) {
      Reflect.deleteProperty(process as unknown as Record<string, unknown>, 'resourcesPath');
    } else {
      setResourcesPath(originalResourcesPath);
    }
    vi.resetModules();
  });

  test('validateUnitMcpSkills enforces hero core skill and reports invalid ids', async () => {
    const { validateUnitMcpSkills } = await import('../../../src/main/services/mcpSkills');
    const result = validateUnitMcpSkills({
      unitType: 'hero',
      skillIds: [' ', VIBECRAFT_CORE_MCP_SKILL_ID, 'unknown-skill', VIBECRAFT_CORE_MCP_SKILL_ID],
      provider: 'claude',
    });

    expect(result.skillIds).toEqual([VIBECRAFT_CORE_MCP_SKILL_ID, VIBECRAFT_DOCS_MCP_SKILL_ID]);
    expect(result.invalidSkillIds).toEqual(['unknown-skill']);
  });

  test('resolveUnitMcpServers falls back to dev script when packaged binary is missing', async () => {
    const { resolveUnitMcpServers } = await import('../../../src/main/services/mcpSkills');
    const workspacePath = path.join(tempDir, 'workspace');
    const servers = resolveUnitMcpServers({
      unitType: 'hero',
      skillIds: [VIBECRAFT_CORE_MCP_SKILL_ID],
      workspacePath,
      storageNamespace: 'dev',
      provider: 'claude',
    });

    const core = servers[VIBECRAFT_CORE_MCP_SKILL_ID];
    expect(core.command).toBe('node');
    expect(core.args?.[0]).toContain('vibecraft-mcp.mjs');
    expect(core.args).toContain('--workspace');
    expect(core.args).toContain(workspacePath);
    expect(core.args).toContain('--storage');
    expect(core.args).toContain('dev');
    expect(core.args).toContain('--docs-root');
    expect(core.args).toContain(path.join(workspacePath, 'docs'));
    expect(core.env?.VIBECRAFT_DOCS_ROOT).toBe(path.join(workspacePath, 'docs'));
  });

  test('resolveUnitMcpServers prefers packaged binary when present', async () => {
    const mcpDir = path.join(tempDir, 'resources', 'mcp');
    fs.mkdirSync(mcpDir, { recursive: true });
    const binaryName = process.platform === 'win32' ? 'vibecraft-mcp.exe' : 'vibecraft-mcp';
    const binaryPath = path.join(mcpDir, binaryName);
    fs.writeFileSync(binaryPath, '', 'utf8');
    setResourcesPath(path.join(tempDir, 'resources'));

    const { resolveUnitMcpServers } = await import('../../../src/main/services/mcpSkills');
    const servers = resolveUnitMcpServers({
      unitType: 'hero',
      skillIds: [VIBECRAFT_CORE_MCP_SKILL_ID],
      workspacePath: '/tmp/workspace',
      storageNamespace: 'prod',
      provider: 'claude',
    });

    expect(servers[VIBECRAFT_CORE_MCP_SKILL_ID].command).toBe(binaryPath);
  });

  test('agent docs skill resolves to vibecraft core server with docs root', async () => {
    const { resolveUnitMcpServers } = await import('../../../src/main/services/mcpSkills');
    const workspacePath = path.join(tempDir, 'workspace-agent');
    const servers = resolveUnitMcpServers({
      unitType: 'agent',
      skillIds: [VIBECRAFT_DOCS_MCP_SKILL_ID],
      workspacePath,
      storageNamespace: 'prod',
      provider: 'claude',
    });

    expect(Object.keys(servers)).toEqual([VIBECRAFT_CORE_MCP_SKILL_ID]);
    expect(servers[VIBECRAFT_CORE_MCP_SKILL_ID].args).toContain('--docs-root');
    expect(servers[VIBECRAFT_CORE_MCP_SKILL_ID].args).toContain(path.join(workspacePath, 'docs'));
  });

  test('mcp forwarding defaults to enabled and can be disabled with env flag', async () => {
    const { isMcpSkillsForwardingEnabled } = await import('../../../src/main/services/mcpSkills');

    delete process.env.VIBECRAFT_MCP_SKILLS_ENABLED;
    expect(isMcpSkillsForwardingEnabled()).toBe(true);

    process.env.VIBECRAFT_MCP_SKILLS_ENABLED = 'false';
    expect(isMcpSkillsForwardingEnabled()).toBe(false);

    process.env.VIBECRAFT_MCP_SKILLS_ENABLED = '1';
    expect(isMcpSkillsForwardingEnabled()).toBe(true);
  });
});
