import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    env: { NODE_ENV: 'test' },
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov', 'html'],
      exclude: ['node_modules/', 'dist/'],
    },
  },
});
