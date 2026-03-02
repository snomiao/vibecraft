import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

let userDataDir = '';

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir || os.tmpdir(),
  },
  shell: {
    trashItem: async (target: string) => {
      await fs.promises.rm(target, { recursive: true, force: true });
    },
  },
}));

import { storage } from '../../../src/main/services/storage';
import {
  createFolder,
  createGitWorktree,
  importExistingFolder,
  listAvailableFolders,
  probeFolderGit,
  refreshFolderConflictState,
  renameFolder,
  worktreeMergeToSource,
  worktreeSyncFromSource,
  worktreeUndoMerge,
  worktreeRetryRestore,
} from '../../../src/main/services/workspace';
import * as testMode from '../../../src/testing/testMode';

let workspaceRoot = '';

beforeEach(() => {
  workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vibecraft-workspace-'));
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibecraft-user-data-'));
});

afterEach(() => {
  fs.rmSync(workspaceRoot, { recursive: true, force: true });
  if (userDataDir) {
    fs.rmSync(userDataDir, { recursive: true, force: true });
    userDataDir = '';
  }
});

const initGitRepo = (repoPath: string) => {
  execSync('git init', { cwd: repoPath, stdio: 'ignore' });
  execSync('git config user.email "tests@vibecraft.local"', { cwd: repoPath, stdio: 'ignore' });
  execSync('git config user.name "Vibecraft Tests"', { cwd: repoPath, stdio: 'ignore' });
  fs.writeFileSync(path.join(repoPath, 'README.md'), 'base\n');
  execSync('git add -A', { cwd: repoPath, stdio: 'ignore' });
  execSync('git commit -m "init"', { cwd: repoPath, stdio: 'ignore' });
};

const commitChange = (repoPath: string, content: string, message: string) => {
  fs.writeFileSync(path.join(repoPath, 'README.md'), content);
  execSync('git add -A', { cwd: repoPath, stdio: 'ignore' });
  execSync(`git commit -m ${JSON.stringify(message)}`, { cwd: repoPath, stdio: 'ignore' });
};

const stashChange = (repoPath: string, content: string) => {
  fs.writeFileSync(path.join(repoPath, 'README.md'), content);
  execSync('git stash push -m "test stash"', { cwd: repoPath, stdio: 'ignore' });
  const ref = execSync('git stash list --format=%H -n 1', {
    cwd: repoPath,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .toString()
    .trim();
  return ref;
};

const stashRefs = (repoPath: string) =>
  execSync('git stash list --format=%H', {
    cwd: repoPath,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .toString()
    .trim()
    .split('\n')
    .filter(Boolean);

const branchExists = (repoPath: string, branchName: string) => {
  try {
    execSync(
      `git -C ${JSON.stringify(repoPath)} show-ref --verify --quiet ${JSON.stringify(`refs/heads/${branchName}`)}`,
      {
        stdio: 'ignore',
      }
    );
    return true;
  } catch {
    return false;
  }
};

const commitFile = (repoPath: string, fileName: string, content: string, message: string): string => {
  fs.writeFileSync(path.join(repoPath, fileName), content);
  execSync('git add -A', { cwd: repoPath, stdio: 'ignore' });
  execSync(`git commit -m ${JSON.stringify(message)}`, { cwd: repoPath, stdio: 'ignore' });
  return execSync('git rev-parse HEAD', { cwd: repoPath, stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();
};

const isAncestor = (repoPath: string, commit: string): boolean => {
  try {
    execSync(`git merge-base --is-ancestor ${commit} HEAD`, {
      cwd: repoPath,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
};

const gitStatus = (repoPath: string) =>
  execSync('git status --porcelain', { cwd: repoPath, stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .trim();

const normalizeWorktreePath = (targetPath: string) => {
  const parent = path.dirname(targetPath);
  const base = path.basename(targetPath);
  try {
    return path.join(fs.realpathSync(parent), base);
  } catch {
    return path.resolve(targetPath);
  }
};

const worktreePaths = (repoPath: string) =>
  execSync('git worktree list --porcelain', { cwd: repoPath, stdio: ['ignore', 'pipe', 'ignore'] })
    .toString()
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => normalizeWorktreePath(line.replace('worktree ', '').trim()));

test('createFolder sanitizes paths and creates the directory', () => {
  const folder = createFolder(workspaceRoot, 'Client/Apps', 120, 80);
  expect(folder.name).toBe('Client-Apps');
  expect(fs.existsSync(path.join(workspaceRoot, 'Client-Apps'))).toBe(true);
});

test('listAvailableFolders skips hidden folders and node_modules', () => {
  fs.mkdirSync(path.join(workspaceRoot, 'alpha'));
  fs.mkdirSync(path.join(workspaceRoot, '.hidden'));
  fs.mkdirSync(path.join(workspaceRoot, 'node_modules'));

  const available = listAvailableFolders(workspaceRoot);
  const names = available.map((entry) => entry.name);
  expect(names).toEqual(['alpha']);
});

test('refreshFolderConflictState keeps merge conflicts until merge is cleared', () => {
  const folder = createFolder(workspaceRoot, 'merge-case', 120, 80);
  const sourcePath = path.join(workspaceRoot, folder.relativePath);
  initGitRepo(sourcePath);

  const worktreeResult = createGitWorktree(workspaceRoot, folder.id, 200, 220);
  expect(worktreeResult.success).toBe(true);
  if (!worktreeResult.folder) {
    throw new Error('Worktree not created');
  }
  const worktreePath = path.join(workspaceRoot, worktreeResult.folder.relativePath);

  commitChange(worktreePath, 'worktree change\n', 'worktree change');
  commitChange(sourcePath, 'source change\n', 'source change');

  const mergeResult = worktreeMergeToSource(workspaceRoot, worktreeResult.folder.id);
  expect(mergeResult.success).toBe(false);

  const withConflict = storage.loadFolders(workspaceRoot).find((entry) => entry.id === folder.id);
  expect(withConflict?.conflictState?.kind).toBe('merge');

  const stillConflicted = refreshFolderConflictState(workspaceRoot, folder.id);
  expect(stillConflicted?.conflictState?.kind).toBe('merge');

  execSync('git merge --abort', { cwd: sourcePath, stdio: 'ignore' });
  const cleared = refreshFolderConflictState(workspaceRoot, folder.id);
  expect(cleared?.conflictState).toBeUndefined();
});

test('refreshFolderConflictState clears restore conflicts when stash is missing', () => {
  const folder = createFolder(workspaceRoot, 'restore-missing', 120, 80);
  const sourcePath = path.join(workspaceRoot, folder.relativePath);
  initGitRepo(sourcePath);

  const folders = storage.loadFolders(workspaceRoot);
  const source = folders.find((entry) => entry.id === folder.id);
  if (!source) {
    throw new Error('Source folder missing');
  }
  source.conflictState = { kind: 'restore', worktreeId: 'worktree-test', stashRef: 'missing' };
  storage.saveFolders(workspaceRoot, folders);

  const refreshed = refreshFolderConflictState(workspaceRoot, folder.id);
  expect(refreshed?.conflictState).toBeUndefined();
});

test('refreshFolderConflictState applies stash but keeps conflict when tree is dirty', () => {
  const folder = createFolder(workspaceRoot, 'restore-stash', 120, 80);
  const sourcePath = path.join(workspaceRoot, folder.relativePath);
  initGitRepo(sourcePath);

  const stashRef = stashChange(sourcePath, 'stashed change\n');
  expect(stashRef).not.toBe('');

  const folders = storage.loadFolders(workspaceRoot);
  const source = folders.find((entry) => entry.id === folder.id);
  if (!source) {
    throw new Error('Source folder missing');
  }
  source.conflictState = { kind: 'restore', worktreeId: 'worktree-test', stashRef };
  storage.saveFolders(workspaceRoot, folders);

  const refreshed = refreshFolderConflictState(workspaceRoot, folder.id);
  expect(refreshed?.conflictState?.kind).toBe('restore');
  expect(stashRefs(sourcePath)).not.toContain(stashRef);
  expect(fs.readFileSync(path.join(sourcePath, 'README.md'), 'utf8')).toBe('stashed change\n');
});

describe('worktreeSyncFromSource behavior', () => {
  test('stashes and restores uncommitted worktree changes', () => {
    const folder = createFolder(workspaceRoot, 'sync-source', 120, 80);
    const sourcePath = path.join(workspaceRoot, folder.relativePath);
    initGitRepo(sourcePath);

    const worktreeResult = createGitWorktree(workspaceRoot, folder.id, 200, 220);
    expect(worktreeResult.success).toBe(true);
    if (!worktreeResult.folder) {
      throw new Error('Worktree not created');
    }
    const worktreePath = path.join(workspaceRoot, worktreeResult.folder.relativePath);

    const sourceCommit = commitFile(sourcePath, 'source.txt', 'source update\n', 'source update');
    const beforeStashRefs = stashRefs(worktreePath);

    fs.writeFileSync(path.join(worktreePath, 'local.txt'), 'local change\n');

    const result = worktreeSyncFromSource(workspaceRoot, worktreeResult.folder.id);
    expect(result.success).toBe(true);
    expect(fs.readFileSync(path.join(worktreePath, 'source.txt'), 'utf8')).toBe('source update\n');
    expect(fs.readFileSync(path.join(worktreePath, 'local.txt'), 'utf8')).toBe('local change\n');
    expect(stashRefs(worktreePath)).toEqual(beforeStashRefs);
    expect(isAncestor(worktreePath, sourceCommit)).toBe(true);
  });

  test('keeps the stash when merge conflicts occur', () => {
    const folder = createFolder(workspaceRoot, 'sync-conflict', 120, 80);
    const sourcePath = path.join(workspaceRoot, folder.relativePath);
    initGitRepo(sourcePath);

    const worktreeResult = createGitWorktree(workspaceRoot, folder.id, 200, 220);
    expect(worktreeResult.success).toBe(true);
    if (!worktreeResult.folder) {
      throw new Error('Worktree not created');
    }
    const worktreePath = path.join(workspaceRoot, worktreeResult.folder.relativePath);

    commitChange(worktreePath, 'worktree change\n', 'worktree change');
    commitChange(sourcePath, 'source change\n', 'source change');

    const beforeStashRefs = stashRefs(worktreePath);
    fs.writeFileSync(path.join(worktreePath, 'local.txt'), 'local change\n');

    const result = worktreeSyncFromSource(workspaceRoot, worktreeResult.folder.id);
    expect(result.success).toBe(false);
    expect(stashRefs(worktreePath).length).toBeGreaterThan(beforeStashRefs.length);
    expect(fs.existsSync(path.join(worktreePath, 'local.txt'))).toBe(false);
    expect(gitStatus(worktreePath)).toContain('UU');
  });
});

describe('Git disabled error paths', () => {
  beforeEach(() => {
    vi.spyOn(testMode, 'getTestModeConfig').mockReturnValue({
      enabled: true,
      disableGit: true,
      workspacePath: workspaceRoot,
      userDataPath: null,
      showWindow: false,
      integration: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('createGitWorktree returns error when git is disabled', () => {
    const folder = createFolder(workspaceRoot, 'no-git-folder', 100, 100);
    const result = createGitWorktree(workspaceRoot, folder.id, 200, 200);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Git features are disabled.');
  });

  test('worktreeSyncFromSource returns error when git is disabled', () => {
    const result = worktreeSyncFromSource(workspaceRoot, 'fake-folder-id');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Git features are disabled.');
  });

  test('worktreeMergeToSource returns error when git is disabled', () => {
    const result = worktreeMergeToSource(workspaceRoot, 'fake-folder-id');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Git features are disabled.');
  });

  test('worktreeUndoMerge returns error when git is disabled', () => {
    const result = worktreeUndoMerge(workspaceRoot, 'fake-folder-id');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Git features are disabled.');
  });

  test('worktreeRetryRestore returns error when git is disabled', () => {
    const result = worktreeRetryRestore(workspaceRoot, 'fake-folder-id');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Git features are disabled.');
  });

  test('probeFolderGit returns non-repo when git is disabled', () => {
    fs.mkdirSync(path.join(workspaceRoot, 'test-probe'));
    const result = probeFolderGit(workspaceRoot, 'test-probe');
    expect(result.success).toBe(true);
    expect(result.isRepo).toBe(false);
    expect(result.isWorktree).toBe(false);
  });
});

describe('createGitWorktree error paths', () => {
  test('returns error when folder is not found', () => {
    const result = createGitWorktree(workspaceRoot, 'nonexistent-folder-id', 200, 200);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Folder not found');
  });

  test('returns error when source folder is a worktree', () => {
    const folder = createFolder(workspaceRoot, 'source-folder', 100, 100);
    const sourcePath = path.join(workspaceRoot, folder.relativePath);
    initGitRepo(sourcePath);

    const worktreeResult = createGitWorktree(workspaceRoot, folder.id, 200, 200);
    expect(worktreeResult.success).toBe(true);

    const secondWorktreeResult = createGitWorktree(workspaceRoot, worktreeResult.folder!.id, 300, 300);
    expect(secondWorktreeResult.success).toBe(false);
    expect(secondWorktreeResult.error).toBe('Cannot create worktree from a worktree');
  });

  test('returns error when folder is not a git repository', () => {
    const relativePath = 'non-git-folder';
    fs.mkdirSync(path.join(workspaceRoot, relativePath));

    const folder = {
      kind: 'folder' as const,
      id: 'folder-non-git',
      name: relativePath,
      relativePath,
      x: 100,
      y: 100,
      createdAt: Date.now(),
      isWorktree: false as const,
    };
    storage.saveFolders(workspaceRoot, [folder]);

    const result = createGitWorktree(workspaceRoot, folder.id, 200, 200);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Folder is not a Git repository');
  });

  test('returns error when repository has no commits', () => {
    const folder = createFolder(workspaceRoot, 'empty-repo', 100, 100);
    const repoPath = path.join(workspaceRoot, folder.relativePath);
    execSync('git init', { cwd: repoPath, stdio: 'ignore' });

    const result = createGitWorktree(workspaceRoot, folder.id, 200, 200);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Repository has no commits');
  });
});

describe('worktreeSyncFromSource error paths', () => {
  test('returns error when folder is not a worktree', () => {
    const folder = createFolder(workspaceRoot, 'regular-folder', 100, 100);
    const result = worktreeSyncFromSource(workspaceRoot, folder.id);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not a recognized worktree');
  });

  test('returns error for nonexistent folder id', () => {
    const result = worktreeSyncFromSource(workspaceRoot, 'nonexistent-id');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not a recognized worktree');
  });
});

describe('worktreeMergeToSource error paths', () => {
  test('returns error when folder is not a worktree', () => {
    const folder = createFolder(workspaceRoot, 'merge-regular', 100, 100);
    const result = worktreeMergeToSource(workspaceRoot, folder.id);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not a recognized worktree');
  });

  test('returns error for nonexistent folder id', () => {
    const result = worktreeMergeToSource(workspaceRoot, 'nonexistent-id');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Not a recognized worktree');
  });
});

describe('worktreeUndoMerge error paths', () => {
  test('returns error when folder has no conflict', () => {
    const folder = createFolder(workspaceRoot, 'no-conflict', 100, 100);
    initGitRepo(path.join(workspaceRoot, folder.relativePath));

    const result = worktreeUndoMerge(workspaceRoot, folder.id);
    expect(result.success).toBe(false);
    expect(result.error).toBe('No conflict to undo');
  });

  test('returns error for nonexistent folder id', () => {
    const result = worktreeUndoMerge(workspaceRoot, 'nonexistent-id');
    expect(result.success).toBe(false);
    expect(result.error).toBe('No conflict to undo');
  });
});

describe('worktreeRetryRestore error paths', () => {
  test('returns error when folder has no restore conflict', () => {
    const folder = createFolder(workspaceRoot, 'no-restore', 100, 100);
    initGitRepo(path.join(workspaceRoot, folder.relativePath));

    const result = worktreeRetryRestore(workspaceRoot, folder.id);
    expect(result.success).toBe(false);
    expect(result.error).toBe('No restore conflict to retry');
  });

  test('clears conflict when stash no longer exists', () => {
    const folder = createFolder(workspaceRoot, 'missing-stash', 100, 100);
    const folderPath = path.join(workspaceRoot, folder.relativePath);
    initGitRepo(folderPath);

    const folders = storage.loadFolders(workspaceRoot);
    const source = folders.find((f) => f.id === folder.id);
    if (!source) throw new Error('Source folder missing');
    source.conflictState = { kind: 'restore', worktreeId: 'wt-1', stashRef: 'nonexistent-ref' };
    storage.saveFolders(workspaceRoot, folders);

    const result = worktreeRetryRestore(workspaceRoot, folder.id);
    expect(result.success).toBe(true);
    expect(result.message).toContain('cleared conflict flag');
  });
});

describe('importExistingFolder error paths', () => {
  test('returns error for invalid path traversal', () => {
    const result = importExistingFolder(workspaceRoot, '../outside', 100, 100);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid folder path');
  });

  test('returns error when target folder does not exist', () => {
    const result = importExistingFolder(workspaceRoot, 'nonexistent-folder', 100, 100);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Target folder does not exist');
  });

  test('returns alreadyImported when folder is already imported', () => {
    fs.mkdirSync(path.join(workspaceRoot, 'existing-folder'));
    const first = importExistingFolder(workspaceRoot, 'existing-folder', 100, 100);
    expect(first.success).toBe(true);

    const second = importExistingFolder(workspaceRoot, 'existing-folder', 200, 200);
    expect(second.success).toBe(true);
    expect(second.alreadyImported).toBe(true);
  });

  test('imports worktree folders as worktrees', () => {
    const sourcePath = path.join(workspaceRoot, 'wt-source');
    fs.mkdirSync(sourcePath);
    initGitRepo(sourcePath);

    const worktreePath = path.join(workspaceRoot, 'wt-branch');
    execSync(
      `git -C ${JSON.stringify(sourcePath)} worktree add ${JSON.stringify(worktreePath)} -b ${JSON.stringify('wt-branch')}`,
      { stdio: 'ignore' }
    );

    const result = importExistingFolder(workspaceRoot, 'wt-branch', 160, 160);
    expect(result.success).toBe(true);
    expect(result.folder?.kind).toBe('worktree');
    expect(result.folder?.isWorktree).toBe(true);
    if (result.folder?.kind === 'worktree') {
      expect(result.folder.sourceRelativePath).toBe('wt-source');
    }
    expect(result.folder?.worktreeBranch).toBe('wt-branch');
  });
});

describe('renameFolder error paths', () => {
  test('returns null for nonexistent folder', () => {
    const result = renameFolder(workspaceRoot, 'nonexistent-id', 'new-name');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Folder not found');
  });

  test('returns null for empty name', () => {
    const folder = createFolder(workspaceRoot, 'rename-empty', 100, 100);
    const result = renameFolder(workspaceRoot, folder.id, '');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Folder name cannot be empty');
  });

  test('returns null when name conflicts with existing folder', () => {
    createFolder(workspaceRoot, 'existing-name', 100, 100);
    const folder = createFolder(workspaceRoot, 'to-rename', 200, 200);

    const result = renameFolder(workspaceRoot, folder.id, 'existing-name');
    expect(result.success).toBe(false);
    expect(result.error).toBe('A folder with that name already exists');
  });

  test('successfully renames folder', () => {
    const folder = createFolder(workspaceRoot, 'old-name', 100, 100);
    const result = renameFolder(workspaceRoot, folder.id, 'new-name');

    expect(result.success).toBe(true);
    expect(result.folder?.name).toBe('new-name');
    expect(result.folder?.relativePath).toBe('new-name');
  });

  test('removes empty folder when relinking to an existing folder', () => {
    const existingPath = path.join(workspaceRoot, 'existing-folder');
    fs.mkdirSync(existingPath);

    const folder = createFolder(workspaceRoot, 'temp-folder', 120, 120);
    const oldPath = path.join(workspaceRoot, folder.relativePath);
    expect(fs.existsSync(oldPath)).toBe(true);

    const result = renameFolder(workspaceRoot, folder.id, 'existing-folder');
    expect(result.success).toBe(true);
    expect(result.folder?.relativePath).toBe('existing-folder');
    expect(fs.existsSync(oldPath)).toBe(false);
    expect(fs.existsSync(existingPath)).toBe(true);
  });

  test('renames worktree branch when renaming worktree folder', () => {
    const folder = createFolder(workspaceRoot, 'worktree-source', 120, 80);
    const sourcePath = path.join(workspaceRoot, folder.relativePath);
    initGitRepo(sourcePath);

    const worktreeResult = createGitWorktree(workspaceRoot, folder.id, 200, 200);
    expect(worktreeResult.success).toBe(true);
    if (!worktreeResult.folder) {
      throw new Error('Worktree not created');
    }

    const worktree = worktreeResult.folder;
    const oldBranch = worktree.worktreeBranch || '';
    const newName = `${worktree.relativePath}-renamed`;
    const expectedBranch = newName.replace(/[^A-Za-z0-9._/-]+/g, '-');

    expect(branchExists(sourcePath, oldBranch)).toBe(true);
    const result = renameFolder(workspaceRoot, worktree.id, newName);

    expect(result.success).toBe(true);
    expect(result.folder?.relativePath).toBe(newName);
    expect(result.folder?.worktreeBranch).toBe(expectedBranch);
    expect(branchExists(sourcePath, oldBranch)).toBe(false);
    expect(branchExists(sourcePath, expectedBranch)).toBe(true);
  });

  test('renames worktree folder while keeping git worktree metadata healthy', () => {
    const folder = createFolder(workspaceRoot, 'worktree-move', 120, 80);
    const sourcePath = path.join(workspaceRoot, folder.relativePath);
    initGitRepo(sourcePath);

    const worktreeResult = createGitWorktree(workspaceRoot, folder.id, 200, 200);
    expect(worktreeResult.success).toBe(true);
    if (!worktreeResult.folder) {
      throw new Error('Worktree not created');
    }

    const worktree = worktreeResult.folder;
    const oldBranch = worktree.worktreeBranch || '';
    const oldPath = path.join(workspaceRoot, worktree.relativePath);
    const newName = `${worktree.relativePath}-renamed`;
    const newPath = path.join(workspaceRoot, newName);
    const normalizedNewPath = normalizeWorktreePath(newPath);
    const normalizedOldPath = normalizeWorktreePath(oldPath);
    const expectedBranch = newName.replace(/[^A-Za-z0-9._/-]+/g, '-');

    const result = renameFolder(workspaceRoot, worktree.id, newName);

    expect(result.success).toBe(true);
    expect(result.folder?.relativePath).toBe(newName);
    expect(result.folder?.worktreeBranch).toBe(expectedBranch);
    expect(fs.existsSync(newPath)).toBe(true);
    expect(fs.existsSync(oldPath)).toBe(false);
    expect(branchExists(sourcePath, oldBranch)).toBe(false);
    expect(branchExists(sourcePath, expectedBranch)).toBe(true);
    expect(gitStatus(newPath)).toBe('');
    expect(worktreePaths(sourcePath)).toContain(normalizedNewPath);
    expect(worktreePaths(sourcePath)).not.toContain(normalizedOldPath);
  });

  test('renames detached worktree folder without branch rename', () => {
    const folder = createFolder(workspaceRoot, 'detached-source', 120, 80);
    const sourcePath = path.join(workspaceRoot, folder.relativePath);
    initGitRepo(sourcePath);

    const worktreeResult = createGitWorktree(workspaceRoot, folder.id, 200, 200);
    expect(worktreeResult.success).toBe(true);
    const worktree = worktreeResult.folder!;
    const worktreePath = path.join(workspaceRoot, worktree.relativePath);

    execSync('git checkout --detach', { cwd: worktreePath, stdio: 'ignore' });
    worktree.worktreeBranch = undefined;
    const folders = storage.loadFolders(workspaceRoot);
    const idx = folders.findIndex((entry) => entry.id === worktree.id);
    if (idx >= 0) {
      folders[idx] = { ...worktree };
      storage.saveFolders(workspaceRoot, folders);
    }

    const newName = `${worktree.relativePath}-renamed`;
    const result = renameFolder(workspaceRoot, worktree.id, newName);

    expect(result.success).toBe(true);
    expect(result.folder?.relativePath).toBe(newName);
    expect(branchExists(sourcePath, 'HEAD')).toBe(false);
  });

  test('updates terminal paths when renaming folder', () => {
    const folder = createFolder(workspaceRoot, 'old-name', 100, 100);
    const createdAt = Date.now();
    storage.saveTerminals(workspaceRoot, [
      {
        id: 'terminal-1',
        originFolderId: folder.id,
        originFolderName: folder.name,
        originRelativePath: folder.relativePath,
        lastKnownCwd: `${folder.relativePath}/src`,
        x: 0,
        y: 0,
        width: 80,
        height: 24,
        createdAt,
      },
    ]);

    const result = renameFolder(workspaceRoot, folder.id, 'new-name');
    expect(result.success).toBe(true);

    const terminals = storage.loadTerminals(workspaceRoot);
    expect(terminals).toHaveLength(1);
    expect(terminals[0]?.originFolderName).toBe('new-name');
    expect(terminals[0]?.originRelativePath).toBe('new-name');
    expect(terminals[0]?.lastKnownCwd).toBe('new-name/src');
  });
});

describe('probeFolderGit edge cases', () => {
  test('returns false for invalid path', () => {
    const result = probeFolderGit(workspaceRoot, '../outside');
    expect(result.success).toBe(false);
    expect(result.isRepo).toBe(false);
  });

  test('returns false for nonexistent folder', () => {
    const result = probeFolderGit(workspaceRoot, 'does-not-exist');
    expect(result.success).toBe(false);
    expect(result.isRepo).toBe(false);
  });

  test('detects worktree folder via .git file', () => {
    const folder = createFolder(workspaceRoot, 'wt-source', 100, 100);
    const sourcePath = path.join(workspaceRoot, folder.relativePath);
    initGitRepo(sourcePath);

    const wtResult = createGitWorktree(workspaceRoot, folder.id, 200, 200);
    expect(wtResult.success).toBe(true);

    const probe = probeFolderGit(workspaceRoot, wtResult.folder!.relativePath);
    expect(probe.success).toBe(true);
    expect(probe.isRepo).toBe(true);
    expect(probe.isWorktree).toBe(true);
  });
});

describe('createFolder error paths', () => {
  test('throws for empty name', () => {
    expect(() => createFolder(workspaceRoot, '', 100, 100)).toThrow('Folder name cannot be empty');
  });

  test('throws for duplicate folder', () => {
    createFolder(workspaceRoot, 'duplicate', 100, 100);
    expect(() => createFolder(workspaceRoot, 'duplicate', 200, 200)).toThrow('Folder already exists');
  });

  test('sanitizes special characters in folder name', () => {
    const folder = createFolder(workspaceRoot, 'foo/bar<>:"|?*', 100, 100);
    expect(folder.relativePath).toBe('foo-bar');
  });
});
