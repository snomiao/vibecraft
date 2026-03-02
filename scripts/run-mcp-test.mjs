import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

const run = (command, args, env) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });

const tempRoot = await fs.mkdtemp(path.join(process.cwd(), '.mcp-dist-'));
const distRoot = path.join(tempRoot, 'dist');
const env = { ...process.env, VIBECRAFT_DIST_DIR: distRoot };

try {
  await run('bun', ['run', 'build'], env);
  await run('bunx', ['playwright', 'test', '--config', 'tests/mcp/playwright.config.ts'], env);
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
