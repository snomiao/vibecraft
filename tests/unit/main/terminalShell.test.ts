import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveShellCommand, sanitizeShellEnv } from '../../../src/main/services/terminalShell';

const makeShellPath = (dir: string, name: string): string => {
  const shellPath = path.join(dir, name);
  fs.writeFileSync(shellPath, '');
  return shellPath;
};

describe('resolveShellCommand', () => {
  let tempDir = '';
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv } as NodeJS.ProcessEnv;
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibecraft-shell-'));
  });

  afterEach(() => {
    process.env = originalEnv;
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  test('ignores args from SHELL env', () => {
    const shellPath = makeShellPath(tempDir, 'env-shell');
    process.env.SHELL = `${shellPath} --login --noprofile --`;

    const result = resolveShellCommand();

    expect(result.shell).toBe(shellPath);
    expect(result.args).toEqual([]);
  });

  test('preserves args from explicit hint', () => {
    const shellPath = makeShellPath(tempDir, 'explicit-shell');

    const result = resolveShellCommand(`${shellPath} --login --noprofile`);

    expect(result.shell).toBe(shellPath);
    expect(result.args).toEqual(['--login', '--noprofile']);
  });

  test('falls back to SHELL env when hint is invalid', () => {
    const shellPath = makeShellPath(tempDir, 'fallback-shell');
    process.env.SHELL = shellPath;

    const result = resolveShellCommand(path.join(tempDir, 'missing-shell'));

    expect(result.shell).toBe(shellPath);
    expect(result.args).toEqual([]);
  });

  test('sanitizes SHELL env value for child shells', () => {
    const env = { SHELL: '/bin/bash --', PATH: '/bin' };
    const next = sanitizeShellEnv(env, '/bin/bash');

    expect(next.SHELL).toBe('/bin/bash');
    expect(next.PATH).toBe('/bin');
    expect(env.SHELL).toBe('/bin/bash --');
  });
});
