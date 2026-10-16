/**
 * Tests for runtime environment validation.
 * getEnv() caches its result at module scope, so each test re-imports the module.
 * Note: VITE_PROTOMAPS_API_KEY, VITE_BACKEND_URL, DEV, PROD and MODE are fixed by
 * vitest.config.ts `define`, so the production throw path cannot be exercised here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

async function loadEnv(): Promise<typeof import('../env')> {
  vi.resetModules();
  return import('../env');
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('envSchema', () => {
  it('requires a non-empty Protomaps key', async () => {
    const { envSchema } = await loadEnv();
    expect(envSchema.safeParse({}).success).toBe(false);
    expect(envSchema.safeParse({ VITE_PROTOMAPS_API_KEY: '' }).success).toBe(false);
  });

  it('applies defaults', async () => {
    const { envSchema } = await loadEnv();
    expect(envSchema.parse({ VITE_PROTOMAPS_API_KEY: 'k' })).toEqual({
      VITE_PROTOMAPS_API_KEY: 'k',
      VITE_BACKEND_URL: 'http://localhost:4000',
      DEV: false,
      PROD: false,
      MODE: 'development',
    });
  });

  it('rejects non-URL endpoints and unknown modes', async () => {
    const { envSchema } = await loadEnv();
    expect(
      envSchema.safeParse({ VITE_PROTOMAPS_API_KEY: 'k', VITE_BACKEND_URL: 'nope' }).success,
    ).toBe(false);
    expect(envSchema.safeParse({ VITE_PROTOMAPS_API_KEY: 'k', MODE: 'staging' }).success).toBe(
      false,
    );
  });
});

describe('getEnv', () => {
  it('returns the validated test environment', async () => {
    const { getEnv } = await loadEnv();
    expect(getEnv()).toMatchObject({
      VITE_PROTOMAPS_API_KEY: 'test-api-key',
      VITE_BACKEND_URL: 'http://localhost:4000',
      DEV: true,
      PROD: false,
      MODE: 'test',
    });
  });

  it('caches the result', async () => {
    const { getEnv } = await loadEnv();
    expect(getEnv()).toBe(getEnv());
  });

  it('in development, logs and falls back to schema defaults when validation fails', async () => {
    vi.stubEnv('VITE_GRAPHQL_ENDPOINT', 'not a url');
    const { getEnv } = await loadEnv();
    const env = getEnv();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Environment validation failed'),
    );
    expect(env.VITE_PROTOMAPS_API_KEY).toBe('test-api-key');
    expect(env.VITE_BACKEND_URL).toBe('http://localhost:4000');
    expect(env.VITE_GRAPHQL_ENDPOINT).toBeUndefined();
  });

  it('isDev / isProd read from the validated env', async () => {
    const { isDev, isProd } = await loadEnv();
    expect(isDev()).toBe(true);
    expect(isProd()).toBe(false);
  });
});
