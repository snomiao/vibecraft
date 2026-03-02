import { spawn } from 'node:child_process';

const isCiEnabled = () => {
  const value = process.env.CI;
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== '0' && normalized !== 'false' && normalized !== 'no';
};

const runCommand = (command, args, env = process.env) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });

const main = async () => {
  await runCommand('bun', ['run', 'test:unit']);
  await runCommand('bun', ['run', 'test:e2e']);

  if (isCiEnabled()) {
    console.log('[test-suite] CI detected. Skipping performance benchmarks.');
    return;
  }

  console.log('[test-suite] Local run detected. Running performance benchmarks.');
  await runCommand('bun', ['run', 'test:perf']);
  await runCommand('bun', ['run', 'test:perf:runtime']);
};

main().catch((error) => {
  console.error('[test-suite] failed', error);
  process.exitCode = 1;
});
