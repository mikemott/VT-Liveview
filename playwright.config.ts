import { defineConfig, devices } from '@playwright/test';

/**
 * E2E suite (VTL-45 Phase 3). Runs the production build under `vite preview`
 * against the real backend with every upstream mocked:
 *   - backend/src/test/e2e-server.ts answers NOAA/VT 511/USGS/etc. from fixtures
 *   - e2e/fixtures.ts intercepts the browser's direct third-party requests
 * See docs/decisions/0002-e2e-playwright.md.
 */

const FRONTEND_PORT = 4173;
const BACKEND_PORT = 4100;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  ...(process.env.CI ? { workers: 2 } : {}),
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'list',
  expect: {
    // WebGL output differs slightly between GPUs/drivers; allow tiny noise only.
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    timezoneId: 'America/New_York',
    locale: 'en-US',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'npm --prefix backend run e2e:server',
      url: `${BACKEND_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        PORT: String(BACKEND_PORT),
        HOST: 'localhost',
        NODE_ENV: 'production',
        ALLOWED_ORIGINS: FRONTEND_URL,
        CONTACT_EMAIL: 'e2e@example.com',
        ENABLE_COLLECTOR: 'false',
      },
    },
    {
      command: `npm run build && npm run preview -- --port ${FRONTEND_PORT} --strictPort`,
      url: FRONTEND_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        VITE_BACKEND_URL: BACKEND_URL,
        VITE_GRAPHQL_ENDPOINT: `${BACKEND_URL}/graphql`,
        VITE_PROTOMAPS_API_KEY: 'e2e-key',
      },
    },
  ],
});
