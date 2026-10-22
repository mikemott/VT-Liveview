import { afterEach, describe, expect, it, vi } from 'vitest';

type EnvModule = typeof import('../types/env.js');

/** Fresh module so the getEnv() cache starts empty. */
async function loadEnv(vars: Record<string, string | undefined> = {}): Promise<EnvModule> {
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  vi.resetModules();
  return import('../types/env.js');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('validateEnv', () => {
  it('applies defaults', async () => {
    const { validateEnv } = await loadEnv({
      PORT: undefined,
      HOST: undefined,
      NODE_ENV: undefined,
      DATABASE_URL: undefined,
      DATABASE_MODE: undefined,
      ENABLE_COLLECTOR: undefined,
    });

    expect(validateEnv()).toMatchObject({
      PORT: 4000,
      HOST: '0.0.0.0',
      NODE_ENV: 'development',
      DATABASE_MODE: 'postgres',
      ENABLE_COLLECTOR: true,
    });
  });

  it('parses and transforms provided values', async () => {
    const { validateEnv } = await loadEnv({
      PORT: '8080',
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://a.example,https://b.example',
      CONTACT_EMAIL: 'ops@example.com',
      DATABASE_URL: 'postgres://u:p@localhost:5432/db',
      DATABASE_MODE: 'timescale',
      ENABLE_COLLECTOR: 'false',
      SENTRY_TRACES_SAMPLE_RATE: '0.25',
      SENTRY_PROFILES_SAMPLE_RATE: '1',
    });

    expect(validateEnv()).toMatchObject({
      PORT: 8080,
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://a.example,https://b.example',
      CONTACT_EMAIL: 'ops@example.com',
      DATABASE_URL: 'postgres://u:p@localhost:5432/db',
      DATABASE_MODE: 'timescale',
      ENABLE_COLLECTOR: false,
      SENTRY_TRACES_SAMPLE_RATE: 0.25,
      SENTRY_PROFILES_SAMPLE_RATE: 1,
    });
  });

  it.each([
    ['PORT', '0'],
    ['PORT', '65536'],
    ['PORT', 'not-a-port'],
    ['NODE_ENV', 'staging'],
    ['CONTACT_EMAIL', 'not-an-email'],
    ['DATABASE_URL', 'not a url'],
    ['DATABASE_MODE', 'mysql'],
    ['SENTRY_DSN', 'nope'],
    ['SENTRY_TRACES_SAMPLE_RATE', '1.5'],
    ['SENTRY_PROFILES_SAMPLE_RATE', '-0.1'],
  ])('rejects %s=%s with a readable message', async (key, value) => {
    const { validateEnv } = await loadEnv({ [key]: value });

    expect(() => validateEnv()).toThrow(
      expect.objectContaining({
        message: expect.stringMatching(
          new RegExp(`^Environment validation failed:\\n(.*\\n)*\\s+- ${key}: `),
        ) as unknown,
      }) as Error,
    );
  });

  it('lists every invalid variable', async () => {
    const { validateEnv } = await loadEnv({ PORT: 'x', CONTACT_EMAIL: 'y' });

    let message = '';
    try {
      validateEnv();
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('  - PORT: ');
    expect(message).toContain('  - CONTACT_EMAIL: ');
  });

  it.todo(
    'accepts ENABLE_COLLECTOR values other than the exact string "true", e.g. "1"/"TRUE" (FINDINGS Low)',
  );
});

describe('getEnv / isDev / isProd', () => {
  it('validates once and caches the result', async () => {
    const env = await loadEnv({ NODE_ENV: 'production', PORT: '5000' });

    expect(env.getEnv().PORT).toBe(5000);
    vi.stubEnv('PORT', '6000');
    expect(env.getEnv().PORT).toBe(5000);
    expect(env.validateEnv().PORT).toBe(6000);
  });

  it('throws from getEnv when the environment is invalid', async () => {
    const env = await loadEnv({ PORT: 'x' });
    expect(() => env.getEnv()).toThrow('Environment validation failed');
  });

  it.each([
    ['development', true, false],
    ['production', false, true],
    ['test', false, false],
  ] as const)('NODE_ENV=%s -> isDev %s, isProd %s', async (nodeEnv, dev, prod) => {
    const env = await loadEnv({ NODE_ENV: nodeEnv });
    expect(env.isDev()).toBe(dev);
    expect(env.isProd()).toBe(prod);
  });
});
