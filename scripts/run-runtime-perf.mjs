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

const parseArgs = (argv) => {
  const options = {
    showWindow: false,
    disableBackgroundThrottling: true,
    outPath: null,
    panSteps: null,
    warmupMs: null,
    settleMs: null,
    agents: null,
    folders: null,
    browsers: null,
    terminals: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];

    if (arg === '--show-window') {
      options.showWindow = true;
      continue;
    }

    if (arg === '--disable-background-throttling') {
      options.disableBackgroundThrottling = true;
      continue;
    }

    if (arg === '--allow-background-throttling') {
      options.disableBackgroundThrottling = false;
      continue;
    }

    if ((arg === '--out' || arg === '-o') && value) {
      options.outPath = value;
      index += 1;
      continue;
    }

    if (arg === '--pan-steps' && value) {
      options.panSteps = value;
      index += 1;
      continue;
    }

    if (arg === '--warmup-ms' && value) {
      options.warmupMs = value;
      index += 1;
      continue;
    }

    if (arg === '--settle-ms' && value) {
      options.settleMs = value;
      index += 1;
      continue;
    }

    if (arg === '--agents' && value) {
      options.agents = value;
      index += 1;
      continue;
    }

    if (arg === '--folders' && value) {
      options.folders = value;
      index += 1;
      continue;
    }

    if (arg === '--browsers' && value) {
      options.browsers = value;
      index += 1;
      continue;
    }

    if (arg === '--terminals' && value) {
      options.terminals = value;
      index += 1;
    }
  }

  return options;
};

const options = parseArgs(process.argv.slice(2));
const tempRoot = await fs.mkdtemp(path.join(process.cwd(), '.perf-dist-'));
const distRoot = path.join(tempRoot, 'dist');
const env = {
  ...process.env,
  VIBECRAFT_DIST_DIR: distRoot,
  VIBECRAFT_TUTORIAL_FIXTURES_DIR:
    process.env.VIBECRAFT_TUTORIAL_FIXTURES_DIR || path.join(process.cwd(), 'assets', 'tutorial', 'fixtures'),
  VIBECRAFT_RUNTIME_PERF_DISABLE_BACKGROUND_THROTTLING: options.disableBackgroundThrottling ? '1' : '0',
  ...(options.showWindow ? { VIBECRAFT_RUNTIME_PERF_SHOW_WINDOW: '1' } : {}),
  ...(options.outPath ? { VIBECRAFT_RUNTIME_PERF_OUT: options.outPath } : {}),
  ...(options.panSteps ? { VIBECRAFT_RUNTIME_PERF_PAN_STEPS: options.panSteps } : {}),
  ...(options.warmupMs ? { VIBECRAFT_RUNTIME_PERF_WARMUP_MS: options.warmupMs } : {}),
  ...(options.settleMs ? { VIBECRAFT_RUNTIME_PERF_SETTLE_MS: options.settleMs } : {}),
  ...(options.agents ? { VIBECRAFT_RUNTIME_PERF_AGENTS: options.agents } : {}),
  ...(options.folders ? { VIBECRAFT_RUNTIME_PERF_FOLDERS: options.folders } : {}),
  ...(options.browsers ? { VIBECRAFT_RUNTIME_PERF_BROWSERS: options.browsers } : {}),
  ...(options.terminals ? { VIBECRAFT_RUNTIME_PERF_TERMINALS: options.terminals } : {}),
};

try {
  await run('bun', ['run', 'build'], env);
  await run('bunx', ['playwright', 'test', '--config', 'tests/perf/runtime/playwright.perf.config.ts'], env);
} finally {
  await fs.rm(tempRoot, { recursive: true, force: true });
}
