import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function codesign(target) {
  const result = spawnSync('codesign', ['--force', '--sign', '-', target], { stdio: 'ignore' });
  if (result.error) return result.error;
  if (result.status !== 0) return new Error(`codesign exited with status ${result.status}`);
  return null;
}

function run() {
  if (process.platform !== 'darwin') return;

  const targets = [
    path.join(rootDir, 'node_modules', 'esbuild', 'bin', 'esbuild'),
    path.join(rootDir, 'node_modules', '@esbuild', 'darwin-arm64', 'bin', 'esbuild'),
    path.join(rootDir, 'node_modules', '@esbuild', 'darwin-x64', 'bin', 'esbuild'),
  ].filter((target) => fs.existsSync(target));

  if (targets.length === 0) return;

  const failures = [];
  for (const target of targets) {
    const error = codesign(target);
    if (error) failures.push({ target, error });
  }

  if (failures.length > 0) {
    console.warn(
      `[codesign] Unable to ad-hoc sign ${failures.length} binaries. Builds may fail until they are signed.`
    );
  }
}

run();
