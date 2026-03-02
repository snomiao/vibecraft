import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let tempDir = '';

vi.mock('electron', () => ({
  app: {
    getPath: () => tempDir,
  },
}));

import {
  addRecentWorkspace,
  importCustomSoundFromPath,
  getRecentWorkspaces,
  loadAgents,
  loadBrowserPanels,
  loadFolders,
  loadHero,
  loadSettings,
  loadTerminals,
  removeRecentWorkspace,
  saveAgents,
  saveBrowserPanels,
  saveFolders,
  saveHero,
  saveSettings,
  saveTerminals,
  getAgentTerminalState,
  setAgentTerminalState,
  clearAgentTerminalState,
  getTerminalHistory,
  setTerminalHistory,
  clearTerminalHistory,
  getWorkspaceStoragePath,
} from '../../../src/main/services/storage';
import {
  type Agent,
  type BrowserPanel,
  type Folder,
  type Hero,
  type TerminalPanel,
  VIBECRAFT_CORE_MCP_SKILL_ID,
  VIBECRAFT_DOCS_MCP_SKILL_ID,
} from '../../../src/shared/types';

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibecraft-storage-'));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test('addRecentWorkspace normalizes paths and de-duplicates by path', () => {
  const basePath = path.join(tempDir, 'Workspace');
  addRecentWorkspace({ id: 'a', name: 'ignored', path: `${basePath}${path.sep}`, lastAccessed: 0 });
  addRecentWorkspace({ id: 'b', name: 'ignored-too', path: basePath, lastAccessed: 0 });

  const recent = getRecentWorkspaces();
  expect(recent).toHaveLength(1);
  expect(recent[0].id).toBe('a');
  expect(recent[0].path).toBe(basePath);
  expect(recent[0].name).toBe('Workspace');
});

test('removeRecentWorkspace drops the entry', () => {
  addRecentWorkspace({ id: 'a', name: 'Workspace', path: '/tmp/workspace', lastAccessed: 0 });
  removeRecentWorkspace('a');
  expect(getRecentWorkspaces()).toHaveLength(0);
});

test('saveAgents and loadAgents persist agent positions', () => {
  const workspacePath = path.join(tempDir, 'test-workspace');
  fs.mkdirSync(path.join(workspacePath, '.vibecraft'), { recursive: true });

  const agents: Agent[] = [
    {
      id: 'agent-1',
      provider: 'claude',
      model: 'claude-3.5',
      color: '#ff0000',
      name: 'Agent One',
      displayName: 'Agent One',
      workspacePath,
      x: 100,
      y: 200,
      status: 'online',
    },
    {
      id: 'agent-2',
      provider: 'claude',
      model: 'claude-3.5',
      color: '#00ff00',
      name: 'Agent Two',
      displayName: 'Agent Two',
      workspacePath,
      x: 300,
      y: 400,
      status: 'offline',
      attachedFolderId: 'folder-1',
    },
  ];

  expect(saveAgents(workspacePath, agents)).toBe(true);

  const loaded = loadAgents(workspacePath);
  expect(loaded).toHaveLength(2);
  expect(loaded[0].x).toBe(100);
  expect(loaded[0].y).toBe(200);
  expect(loaded[1].x).toBe(300);
  expect(loaded[1].y).toBe(400);
  expect(loaded[1].attachedFolderId).toBe('folder-1');
  expect(loaded[0].mcpSkillIds).toEqual([]);
});

test('loadAgents sanitizes duplicate and invalid mcp skills', () => {
  const workspacePath = path.join(tempDir, 'agent-mcp-sanitize');
  const storagePath = getWorkspaceStoragePath(workspacePath);
  fs.mkdirSync(storagePath, { recursive: true });
  fs.writeFileSync(
    path.join(storagePath, 'agents.json'),
    JSON.stringify([
      {
        id: 'agent-1',
        provider: 'claude',
        model: 'claude-3.5',
        color: '#ff0000',
        name: 'Agent One',
        displayName: 'Agent One',
        workspacePath,
        x: 100,
        y: 200,
        status: 'online',
        mcpSkillIds: [VIBECRAFT_CORE_MCP_SKILL_ID, 'unknown-skill', VIBECRAFT_CORE_MCP_SKILL_ID, 7],
      },
    ]),
    'utf8'
  );

  const loaded = loadAgents(workspacePath);
  expect(loaded).toHaveLength(1);
  expect(loaded[0].mcpSkillIds).toEqual([VIBECRAFT_CORE_MCP_SKILL_ID]);
});

test('saveFolders and loadFolders persist folder positions', () => {
  const workspacePath = path.join(tempDir, 'test-workspace');
  fs.mkdirSync(path.join(workspacePath, '.vibecraft'), { recursive: true });

  const folders: Folder[] = [
    {
      kind: 'folder',
      id: 'folder-1',
      name: 'Folder One',
      relativePath: 'src',
      x: 150,
      y: 250,
      createdAt: Date.now(),
    },
    {
      kind: 'folder',
      id: 'folder-2',
      name: 'Folder Two',
      relativePath: 'tests',
      x: 350,
      y: 450,
      createdAt: Date.now(),
    },
  ];

  expect(saveFolders(workspacePath, folders)).toBe(true);

  const loaded = loadFolders(workspacePath);
  expect(loaded).toHaveLength(2);
  expect(loaded[0].x).toBe(150);
  expect(loaded[0].y).toBe(250);
  expect(loaded[1].x).toBe(350);
  expect(loaded[1].y).toBe(450);
});

test('saveBrowserPanels and loadBrowserPanels persist browser positions and sizes', () => {
  const workspacePath = path.join(tempDir, 'test-workspace');
  fs.mkdirSync(path.join(workspacePath, '.vibecraft'), { recursive: true });

  const browsers: BrowserPanel[] = [
    {
      id: 'browser-1',
      url: 'https://example.com',
      x: 100,
      y: 100,
      width: 800,
      height: 600,
      createdAt: Date.now(),
    },
    {
      id: 'browser-2',
      url: 'https://test.com',
      x: 200,
      y: 200,
      width: 1024,
      height: 768,
      createdAt: Date.now(),
    },
  ];

  expect(saveBrowserPanels(workspacePath, browsers)).toBe(true);

  const loaded = loadBrowserPanels(workspacePath);
  expect(loaded).toHaveLength(2);
  expect(loaded[0].x).toBe(100);
  expect(loaded[0].y).toBe(100);
  expect(loaded[0].width).toBe(800);
  expect(loaded[0].height).toBe(600);
  expect(loaded[1].x).toBe(200);
  expect(loaded[1].y).toBe(200);
  expect(loaded[1].width).toBe(1024);
  expect(loaded[1].height).toBe(768);
});

test('saveHero and loadHero persist hero position', () => {
  const workspacePath = path.join(tempDir, 'test-workspace');
  fs.mkdirSync(path.join(workspacePath, '.vibecraft'), { recursive: true });

  const hero: Hero = {
    id: 'hero',
    name: 'Test Hero',
    x: 500,
    y: 600,
    provider: 'claude',
    model: 'claude-3.5',
  };

  expect(saveHero(workspacePath, hero)).toBe(true);

  const loaded = loadHero(workspacePath);
  expect(loaded.x).toBe(500);
  expect(loaded.y).toBe(600);
  expect(loaded.mcpSkillIds).toContain(VIBECRAFT_CORE_MCP_SKILL_ID);
  expect(loaded.mcpSkillIds).toContain(VIBECRAFT_DOCS_MCP_SKILL_ID);
});

test('loadHero always includes vibecraft core mcp skill', () => {
  const workspacePath = path.join(tempDir, 'hero-mcp-core');
  const storagePath = getWorkspaceStoragePath(workspacePath);
  fs.mkdirSync(storagePath, { recursive: true });
  fs.writeFileSync(
    path.join(storagePath, 'hero.json'),
    JSON.stringify({
      id: 'hero',
      name: 'Hero',
      provider: 'claude',
      model: 'claude-3.5',
      x: 0,
      y: 0,
      mcpSkillIds: [],
    }),
    'utf8'
  );

  const loaded = loadHero(workspacePath);
  expect(loaded.mcpSkillIds).toEqual([VIBECRAFT_CORE_MCP_SKILL_ID, VIBECRAFT_DOCS_MCP_SKILL_ID]);
});

test('loadAgents returns empty array for non-existent workspace', () => {
  const workspacePath = path.join(tempDir, 'non-existent');
  const loaded = loadAgents(workspacePath);
  expect(loaded).toEqual([]);
});

test('loadFolders returns empty array for non-existent workspace', () => {
  const workspacePath = path.join(tempDir, 'non-existent');
  const loaded = loadFolders(workspacePath);
  expect(loaded).toEqual([]);
});

test('loadBrowserPanels returns empty array for non-existent workspace', () => {
  const workspacePath = path.join(tempDir, 'non-existent');
  const loaded = loadBrowserPanels(workspacePath);
  expect(loaded).toEqual([]);
});

test('loadHero returns default hero for non-existent workspace', () => {
  const workspacePath = path.join(tempDir, 'non-existent');
  const loaded = loadHero(workspacePath);
  expect(loaded).toHaveProperty('x');
  expect(loaded).toHaveProperty('y');
});

describe('Invalid JSON handling', () => {
  test('loadAgents returns empty array for invalid JSON', () => {
    const workspacePath = path.join(tempDir, 'invalid-json');
    const storagePath = getWorkspaceStoragePath(workspacePath);
    fs.mkdirSync(storagePath, { recursive: true });
    fs.writeFileSync(path.join(storagePath, 'agents.json'), 'not valid json {{{');

    const loaded = loadAgents(workspacePath);
    expect(loaded).toEqual([]);
  });

  test('loadFolders returns empty array for invalid JSON', () => {
    const workspacePath = path.join(tempDir, 'invalid-json-folders');
    const storagePath = getWorkspaceStoragePath(workspacePath);
    fs.mkdirSync(storagePath, { recursive: true });
    fs.writeFileSync(path.join(storagePath, 'folders.json'), '{ broken');

    const loaded = loadFolders(workspacePath);
    expect(loaded).toEqual([]);
  });

  test('loadBrowserPanels returns empty array for invalid JSON', () => {
    const workspacePath = path.join(tempDir, 'invalid-json-browsers');
    const storagePath = getWorkspaceStoragePath(workspacePath);
    fs.mkdirSync(storagePath, { recursive: true });
    fs.writeFileSync(path.join(storagePath, 'browsers.json'), '[{ incomplete');

    const loaded = loadBrowserPanels(workspacePath);
    expect(loaded).toEqual([]);
  });

  test('loadHero returns default hero for invalid JSON', () => {
    const workspacePath = path.join(tempDir, 'invalid-json-hero');
    const storagePath = getWorkspaceStoragePath(workspacePath);
    fs.mkdirSync(storagePath, { recursive: true });
    fs.writeFileSync(path.join(storagePath, 'hero.json'), 'garbage');

    const loaded = loadHero(workspacePath);
    expect(loaded).toHaveProperty('x');
    expect(loaded).toHaveProperty('y');
  });

  test('loadSettings returns empty object for invalid JSON', () => {
    fs.writeFileSync(path.join(tempDir, 'settings.json'), 'not json');
    const loaded = loadSettings();
    expect(loaded).toMatchObject({
      tutorial: {
        status: 'not_started',
        stepId: 'world-select',
        version: 1,
      },
    });
  });
});

describe('Settings operations', () => {
  test('saveSettings and loadSettings round-trip', () => {
    const settings = { disableGit: true, edgePanEnabled: false };
    expect(saveSettings(settings)).toBe(true);

    const loaded = loadSettings();
    expect(loaded.disableGit).toBe(true);
    expect(loaded.edgePanEnabled).toBe(false);
  });

  test('loadSettings returns empty object for non-existent file', () => {
    const loaded = loadSettings();
    expect(loaded).toMatchObject({
      audio: {
        muted: false,
        masterVolume: 1,
      },
      tutorial: {
        status: 'not_started',
        stepId: 'world-select',
        version: 1,
      },
    });
  });

  test('loadSettings normalizes legacy audio keys', () => {
    fs.writeFileSync(
      path.join(tempDir, 'settings.json'),
      JSON.stringify({
        muteSfx: true,
        audio: {
          masterVolume: 2,
          soundPackOverrideId: 'not-real',
          soundEventOverrides: {
            'command.create-folder': 'agent.error',
            '': 'agent.error',
            'agent.error': 9,
          },
        },
      })
    );

    const loaded = loadSettings();
    expect(loaded.audio).toEqual({
      muted: true,
      masterVolume: 1,
      soundEventOverrides: {
        'command.create-folder': 'agent.error',
      },
    });
  });

  test('saveSettings merges nested audio patch', () => {
    saveSettings({
      audio: {
        muted: false,
        masterVolume: 0.4,
        soundPackOverrideId: 'arcade',
        soundEventOverrides: {
          'command.create-folder': 'agent.error',
        },
      },
    });

    saveSettings({
      audio: {
        muted: true,
      },
    });

    const loaded = loadSettings();
    expect(loaded.audio).toEqual({
      muted: true,
      masterVolume: 0.4,
      soundPackOverrideId: 'arcade',
      soundEventOverrides: {
        'command.create-folder': 'agent.error',
      },
    });
  });

  test('saveSettings can clear sound event overrides', () => {
    saveSettings({
      audio: {
        soundEventOverrides: {
          'command.create-folder': 'agent.error',
        },
      },
    });

    saveSettings({
      audio: {
        soundEventOverrides: undefined,
      },
    });

    const loaded = loadSettings();
    expect(loaded.audio).toEqual({
      muted: false,
      masterVolume: 1,
    });
  });

  test('imports custom sound files into app data', () => {
    const sourcePath = path.join(tempDir, 'my-tone.wav');
    fs.writeFileSync(sourcePath, 'fake-audio-data', 'utf8');

    const imported = importCustomSoundFromPath(sourcePath);
    expect(imported.displayName).toBe('my-tone');
    expect(imported.sourceUrl.startsWith('file://')).toBe(true);

    const importedPath = new URL(imported.sourceUrl);
    const importedData = fs.readFileSync(importedPath, 'utf8');
    expect(importedData).toBe('fake-audio-data');
  });

  test('rejects unsupported custom sound file types', () => {
    const sourcePath = path.join(tempDir, 'my-tone.txt');
    fs.writeFileSync(sourcePath, 'fake-audio-data', 'utf8');
    expect(() => importCustomSoundFromPath(sourcePath)).toThrow('Unsupported sound file type');
  });
});

describe('Terminal operations', () => {
  test('saveTerminals and loadTerminals round-trip with defaults', () => {
    const workspacePath = path.join(tempDir, 'terminal-test');
    fs.mkdirSync(getWorkspaceStoragePath(workspacePath), { recursive: true });

    const terminals: TerminalPanel[] = [
      {
        id: 'term-1',
        x: 100,
        y: 200,
        width: 800,
        height: 400,
        createdAt: Date.now(),
      },
    ];

    expect(saveTerminals(workspacePath, terminals)).toBe(true);

    const loaded = loadTerminals(workspacePath);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('term-1');
    expect(loaded[0].x).toBe(100);
    expect(loaded[0].y).toBe(200);
  });

  test('loadTerminals applies defaults for missing dimensions', () => {
    const workspacePath = path.join(tempDir, 'terminal-defaults');
    const storagePath = getWorkspaceStoragePath(workspacePath);
    fs.mkdirSync(storagePath, { recursive: true });

    fs.writeFileSync(path.join(storagePath, 'terminals.json'), JSON.stringify([{ id: 'term-partial' }]));

    const loaded = loadTerminals(workspacePath);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].x).toBe(0);
    expect(loaded[0].y).toBe(0);
    expect(loaded[0].width).toBeGreaterThan(0);
    expect(loaded[0].height).toBeGreaterThan(0);
  });

  test('loadTerminals returns empty array for non-existent workspace', () => {
    const workspacePath = path.join(tempDir, 'no-terminals');
    const loaded = loadTerminals(workspacePath);
    expect(loaded).toEqual([]);
  });
});

describe('Agent terminal state', () => {
  test('setAgentTerminalState and getAgentTerminalState round-trip', () => {
    const workspacePath = path.join(tempDir, 'agent-history-test');
    fs.mkdirSync(getWorkspaceStoragePath(workspacePath), { recursive: true });

    expect(
      setAgentTerminalState(workspacePath, 'agent-1', [
        { id: 'entry-1', type: 'message', role: 'user', content: 'command history' },
      ])
    ).toBe(true);

    const history = getAgentTerminalState(workspacePath, 'agent-1');
    expect(history?.entries).toEqual([
      { id: 'entry-1', type: 'message', role: 'user', content: 'command history' },
    ]);
  });

  test('getAgentTerminalState returns null for non-existent agent', () => {
    const workspacePath = path.join(tempDir, 'no-history');
    const history = getAgentTerminalState(workspacePath, 'non-existent');
    expect(history).toBeNull();
  });

  test('clearAgentTerminalState removes state file', () => {
    const workspacePath = path.join(tempDir, 'clear-agent-history');
    fs.mkdirSync(getWorkspaceStoragePath(workspacePath), { recursive: true });

    setAgentTerminalState(workspacePath, 'agent-1', [
      { id: 'entry-1', type: 'message', role: 'assistant', content: 'some history' },
    ]);
    expect(getAgentTerminalState(workspacePath, 'agent-1')?.entries).toEqual([
      { id: 'entry-1', type: 'message', role: 'assistant', content: 'some history' },
    ]);

    expect(clearAgentTerminalState(workspacePath, 'agent-1')).toBe(true);
    expect(getAgentTerminalState(workspacePath, 'agent-1')).toBeNull();
  });

  test('clearAgentTerminalState succeeds for non-existent history', () => {
    const workspacePath = path.join(tempDir, 'no-agent-to-clear');
    expect(clearAgentTerminalState(workspacePath, 'non-existent')).toBe(true);
  });
});

describe('Terminal history', () => {
  test('setTerminalHistory and getTerminalHistory round-trip', () => {
    const workspacePath = path.join(tempDir, 'term-history-test');
    fs.mkdirSync(getWorkspaceStoragePath(workspacePath), { recursive: true });

    expect(setTerminalHistory(workspacePath, 'term-1', 'terminal output')).toBe(true);

    const history = getTerminalHistory(workspacePath, 'term-1');
    expect(history).toBe('terminal output');
  });

  test('getTerminalHistory returns empty string for non-existent terminal', () => {
    const workspacePath = path.join(tempDir, 'no-term-history');
    const history = getTerminalHistory(workspacePath, 'non-existent');
    expect(history).toBe('');
  });

  test('clearTerminalHistory removes history file', () => {
    const workspacePath = path.join(tempDir, 'clear-term-history');
    fs.mkdirSync(getWorkspaceStoragePath(workspacePath), { recursive: true });

    setTerminalHistory(workspacePath, 'term-1', 'some output');
    expect(getTerminalHistory(workspacePath, 'term-1')).toBe('some output');

    expect(clearTerminalHistory(workspacePath, 'term-1')).toBe(true);
    expect(getTerminalHistory(workspacePath, 'term-1')).toBe('');
  });

  test('clearTerminalHistory succeeds for non-existent history', () => {
    const workspacePath = path.join(tempDir, 'no-term-to-clear');
    expect(clearTerminalHistory(workspacePath, 'non-existent')).toBe(true);
  });
});

describe('Folder kind migration', () => {
  test('loadFolders adds kind to legacy folders without it', () => {
    const workspacePath = path.join(tempDir, 'legacy-folders');
    const storagePath = getWorkspaceStoragePath(workspacePath);
    fs.mkdirSync(storagePath, { recursive: true });

    const legacyFolders = [
      { id: 'f1', name: 'Folder', relativePath: 'folder', x: 0, y: 0, createdAt: Date.now() },
      {
        id: 'f2',
        name: 'Worktree',
        relativePath: 'worktree',
        x: 100,
        y: 100,
        createdAt: Date.now(),
        isWorktree: true,
      },
    ];

    fs.writeFileSync(path.join(storagePath, 'folders.json'), JSON.stringify(legacyFolders));

    const loaded = loadFolders(workspacePath);
    expect(loaded).toHaveLength(2);
    expect(loaded[0].kind).toBe('folder');
    expect(loaded[1].kind).toBe('worktree');
  });
});
