import { defineConfig } from 'vitest/config';

const perfInclude = ['tests/perf/**/*.bench.ts', 'tests/perf/**/*.bench.tsx'];

export default defineConfig({
  test: {
    name: 'perf',
    environment: 'jsdom',
    include: perfInclude,
    setupFiles: ['tests/unit/setup-renderer.ts'],
    benchmark: {
      include: perfInclude,
    },
  },
});
