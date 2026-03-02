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

const tempRoot = await fs.mkdtemp(path.join(process.cwd(), '.e2e-dist-'));
const distRoot = path.join(tempRoot, 'dist');
const rawArgs = process.argv.slice(2);
const showIndex = rawArgs.indexOf('--show');
const integrationIndex = rawArgs.indexOf('--integration');
const showWindow = showIndex !== -1;
const integrationMode = integrationIndex !== -1;
const passthroughArgs = rawArgs.filter((arg) => arg !== '--show' && arg !== '--integration');
const env = {
  ...process.env,
  VIBECRAFT_DIST_DIR: distRoot,
  VIBECRAFT_TUTORIAL_FIXTURES_DIR: path.join(process.cwd(), 'assets', 'tutorial', 'fixtures'),
  ...(integrationMode ? { VIBECRAFT_E2E_INTEGRATION: '1' } : {}),
  ...(showWindow ? { VIBECRAFT_E2E_SHOW: '1' } : {}),
};

try {
  await run('bun', ['run', 'build'], env);
  await run(
    'bunx',
    ['playwright', 'test', '--config', 'tests/e2e/playwright.config.ts', ...passthroughArgs],
    env
  );
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
