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
      // Measure all source files, not just the ones tests happen to import
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/__tests__/**',
        'src/__fixtures__/**',
        'src/test/**',
        'src/scripts/**', // one-off data build scripts
        'src/db/migrate.ts', // CLI entrypoint
      ],
      // VTL-45 targets. Raise these as coverage grows; never lower them to pass CI.
      thresholds: {
        'src/services/**': { lines: 80 },
        'src/resolvers/**': { lines: 80 },
      },
    },
  },
});
