import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const binName = process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder';
const builderPath = resolve(rootDir, 'node_modules', '.bin', binName);

const args = process.argv.slice(2);

const updateUrl = process.env.VIBECRAFT_UPDATE_URL?.trim();
const updateChannel = process.env.VIBECRAFT_UPDATE_CHANNEL?.trim();

const hasPublishConfig = args.some((arg) => arg.startsWith('--config.publish'));

if (updateUrl && !hasPublishConfig) {
  args.push('--config.publish.provider=generic', `--config.publish.url=${updateUrl}`);
  if (updateChannel) {
    args.push(`--config.publish.channel=${updateChannel}`);
  }
}

const child = spawn(builderPath, args, { stdio: 'inherit', env: process.env });

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
