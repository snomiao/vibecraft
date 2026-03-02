import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'main',
    environment: 'node',
    include: ['tests/unit/main/**/*.test.ts'],
    setupFiles: ['tests/unit/setup-main.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
