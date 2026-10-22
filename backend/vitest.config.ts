import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Absolute path: a relative './src/test/setup.ts' resolved to the frontend's
    // setup file (repo-root src/), so the backend MSW server never listened.
    setupFiles: [fileURLToPath(new URL('./src/test/setup.ts', import.meta.url))],
    env: { NODE_ENV: 'test' },
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov', 'html'],
      exclude: ['node_modules/', 'dist/'],
    },
  },
});
