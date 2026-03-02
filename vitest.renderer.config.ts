import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'renderer',
    environment: 'jsdom',
    include: ['tests/unit/renderer/**/*.test.ts', 'tests/unit/renderer/**/*.test.tsx'],
    setupFiles: ['tests/unit/setup-renderer.ts'],
  },
});
