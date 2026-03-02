import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const trimValue = (value: string): string => value.trim();

const parseEnv = (content: string): Record<string, string> => {
  const parsed: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    let line = trimValue(rawLine);
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) {
      line = trimValue(line.slice(7));
    }

    const delimiterIndex = line.indexOf('=');
    if (delimiterIndex === -1) continue;

    const key = trimValue(line.slice(0, delimiterIndex));
    let value = trimValue(line.slice(delimiterIndex + 1));
    if (!key) continue;

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
};

const resolveCandidates = (): string[] => {
  const candidates: string[] = [];
  const explicit = process.env.VIBECRAFT_ENV_PATH?.trim();
  if (explicit) {
    candidates.push(explicit);
  }

  const resourcesPath = typeof process.resourcesPath === 'string' ? process.resourcesPath : '';
  if (resourcesPath) {
    candidates.push(join(resourcesPath, 'env', '.env.prod'));
  }

  return candidates;
};

export const loadRuntimeEnv = (): void => {
  if (process.env.VIBECRAFT_RUNTIME_ENV_LOADED === '1') return;

  const candidates = resolveCandidates();
  for (const candidate of candidates) {
    if (!candidate || !existsSync(candidate)) continue;
    const content = readFileSync(candidate, 'utf8');
    const parsed = parseEnv(content);
    for (const [key, value] of Object.entries(parsed)) {
      if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
        process.env[key] = value;
      }
    }
    process.env.VIBECRAFT_RUNTIME_ENV_LOADED = '1';
    break;
  }
};
