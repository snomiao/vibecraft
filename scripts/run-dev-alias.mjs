import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const mode = (process.argv[2] ?? '').trim().toLowerCase();

const env = { ...process.env };

const enableTutorialReset = () => {
  env.VIBECRAFT_TUTORIAL_RESET = '1';
};

const enableLicenseCheck = () => {
  env.VIBECRAFT_LICENSE_CHECK = '1';
};

const disableLicenseCheck = () => {
  env.VIBECRAFT_LICENSE_CHECK = '0';
};

if (mode === 'tutorial') {
  enableTutorialReset();
  disableLicenseCheck();
} else if (mode === 'onboarding') {
  enableTutorialReset();
  enableLicenseCheck();
} else {
  console.error('Usage: bun ./scripts/run-dev-alias.mjs <tutorial|onboarding>');
  process.exit(2);
}

// Ensure these flags win over values in .env/.env.local if present.
const overrideKeys = new Set(
  (env.VIBECRAFT_ENV_OVERRIDE_KEYS ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean)
);
overrideKeys.add('VIBECRAFT_TUTORIAL_RESET');
overrideKeys.add('VIBECRAFT_LICENSE_CHECK');
env.VIBECRAFT_ENV_OVERRIDE_KEYS = Array.from(overrideKeys).join(',');

const runDevPath = resolve(process.cwd(), 'scripts', 'run-dev.mjs');
const child = spawn('bun', [runDevPath], { stdio: 'inherit', env });
child.on('close', (code) => {
  process.exit(code ?? 1);
});
