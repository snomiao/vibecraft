import * as os from 'os';
import * as path from 'path';
import { defineConfig } from '@playwright/test';

const outputDir = path.join(os.tmpdir(), 'vibecraft-playwright', `mcp-${process.pid}`);
process.env.VIBECRAFT_PLAYWRIGHT_OUTPUT_DIR = outputDir;

export default defineConfig({
  testDir: __dirname,
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: 'list',
  outputDir,
});
