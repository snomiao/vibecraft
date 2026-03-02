import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const parseEnvFile = (filePath) => {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf8');
  const parsed = {};

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const sanitized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const delimiterIndex = sanitized.indexOf('=');
    if (delimiterIndex === -1) continue;
    const key = sanitized.slice(0, delimiterIndex).trim();
    let value = sanitized.slice(delimiterIndex + 1).trim();
    if (!key) continue;
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }

  return parsed;
};

const envRoot = resolve(process.cwd());
const baseEnv = parseEnvFile(resolve(envRoot, '.env'));
const localEnv = parseEnvFile(resolve(envRoot, '.env.local'));
const env = { ...baseEnv, ...process.env, ...localEnv };
const overrideKeysRaw = process.env.VIBECRAFT_ENV_OVERRIDE_KEYS ?? '';
const overrideKeys = overrideKeysRaw
  .split(',')
  .map((key) => key.trim())
  .filter(Boolean);
const overrideAll = (process.env.VIBECRAFT_ENV_OVERRIDE ?? '').toLowerCase() === '1';
if (overrideAll) {
  Object.assign(env, process.env);
} else if (overrideKeys.length) {
  for (const key of overrideKeys) {
    if (Object.prototype.hasOwnProperty.call(process.env, key)) {
      env[key] = process.env[key];
    }
  }
}
if (!env.VIBECRAFT_STORAGE_NAMESPACE) {
  env.VIBECRAFT_STORAGE_NAMESPACE = 'dev';
}

const child = spawn('bun', ['x', 'vite'], { stdio: 'inherit', env });
child.on('close', (code) => {
  process.exit(code ?? 1);
});
