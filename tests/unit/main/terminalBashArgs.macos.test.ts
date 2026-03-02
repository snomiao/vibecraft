import { expect, test } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { buildBashHookArgs } from '../../../src/main/services/terminalHooks';

const isDarwin = process.platform === 'darwin';
const maybeTest = isDarwin ? test : test.skip;

maybeTest('bash rcfile args order works on macOS', () => {
  if (!fs.existsSync('/bin/bash')) return;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibecraft-bash-'));
  const rcPath = path.join(tempDir, 'bashrc');
  fs.writeFileSync(rcPath, '');

  const args = [...buildBashHookArgs(rcPath), '-c', 'exit 0'];
  const result = spawnSync('/bin/bash', args, { encoding: 'utf8' });

  fs.rmSync(tempDir, { recursive: true, force: true });

  expect(result.status).toBe(0);
  expect(result.stderr).not.toContain('invalid option');
});
