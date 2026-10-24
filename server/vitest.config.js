import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    poolOptions: { threads: { singleThread: true } },
    setupFiles: ['./tests/setup.js'],
  },
});
