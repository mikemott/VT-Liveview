import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const query = vi.fn<(strings: TemplateStringsArray) => Promise<unknown>>();
  const end = vi.fn<() => Promise<void>>();
  const sql = Object.assign(query, { end });
  return {
    sql,
    query,
    end,
    postgres: vi.fn((_url: string, _options: Record<string, unknown>) => sql),
    drizzle: vi.fn((_client: unknown, _config: unknown) => ({ kind: 'fake-drizzle' })),
  };
});

vi.mock('postgres', () => ({ default: mocks.postgres }));
vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: mocks.drizzle }));

type DbModule = typeof import('../index.js');

async function loadDb(databaseUrl?: string): Promise<DbModule> {
  if (databaseUrl) vi.stubEnv('DATABASE_URL', databaseUrl);
  else vi.stubEnv('DATABASE_URL', undefined);
  vi.resetModules();
  return import('../index.js');
}

const URL = 'postgres://user:pw@db.example.com:5432/vt';

beforeEach(() => {
  mocks.postgres.mockClear();
  mocks.drizzle.mockClear();
  mocks.query.mockReset().mockResolvedValue([{ '?column?': 1 }]);
  mocks.end.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('without DATABASE_URL', () => {
  it('reports the database as disabled and never connects', async () => {
    const db = await loadDb();

    expect(db.isDatabaseEnabled()).toBe(false);
    expect(db.getDb()).toBeNull();
    await expect(db.checkDatabaseHealth()).resolves.toEqual({ connected: false, latencyMs: null });
    await db.closeDatabase();

    expect(mocks.postgres).not.toHaveBeenCalled();
    expect(mocks.end).not.toHaveBeenCalled();
  });
});

describe('with DATABASE_URL', () => {
  it('creates one pooled connection lazily and reuses it', async () => {
    const db = await loadDb(URL);
    expect(db.isDatabaseEnabled()).toBe(true);
    expect(mocks.postgres).not.toHaveBeenCalled();

    const first = db.getDb();
    const second = db.getDb();

    expect(first).toBe(second);
    expect(first).toEqual({ kind: 'fake-drizzle' });
    expect(mocks.postgres).toHaveBeenCalledTimes(1);
    expect(mocks.postgres).toHaveBeenCalledWith(URL, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
    expect(mocks.drizzle).toHaveBeenCalledWith(mocks.sql, {
      schema: expect.objectContaining({ weatherAlerts: expect.anything() as unknown }) as unknown,
    });
  });

  it('reports a healthy ping with latency', async () => {
    const db = await loadDb(URL);

    const health = await db.checkDatabaseHealth();

    expect(health.connected).toBe(true);
    expect(health.latencyMs).toEqual(expect.any(Number));
    expect(health.error).toBeUndefined();
    expect(mocks.query.mock.calls[0]?.[0].join('')).toBe('SELECT 1');
  });

  it('reports the driver error when the ping fails', async () => {
    const db = await loadDb(URL);
    mocks.query.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(db.checkDatabaseHealth()).resolves.toEqual({
      connected: false,
      latencyMs: null,
      error: 'ECONNREFUSED',
    });
  });

  it('reports "Unknown error" for non-Error rejections', async () => {
    const db = await loadDb(URL);
    mocks.query.mockRejectedValue('weird');

    await expect(db.checkDatabaseHealth()).resolves.toMatchObject({ error: 'Unknown error' });
  });

  it('gives up on a hung ping after HEALTH_CHECK_TIMEOUT_MS (FINDINGS H4)', async () => {
    const db = await loadDb(URL);
    vi.useFakeTimers();
    mocks.query.mockReturnValue(new Promise(() => undefined));

    const pending = db.checkDatabaseHealth();
    await vi.advanceTimersByTimeAsync(db.HEALTH_CHECK_TIMEOUT_MS);

    await expect(pending).resolves.toEqual({
      connected: false,
      latencyMs: null,
      error: `Database ping timed out after ${db.HEALTH_CHECK_TIMEOUT_MS}ms`,
    });
    expect(db.HEALTH_CHECK_TIMEOUT_MS).toBeLessThan(5000); // Fly check timeout
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the timeout timer after a fast ping', async () => {
    const db = await loadDb(URL);
    vi.useFakeTimers();

    await db.checkDatabaseHealth();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('closes the pool on shutdown', async () => {
    const db = await loadDb(URL);
    db.getDb();

    await db.closeDatabase();
    expect(mocks.end).toHaveBeenCalledTimes(1);

    await db.closeDatabase();
    expect(mocks.end).toHaveBeenCalledTimes(1);
  });

  it.todo(
    'does not silently reconnect in getDb() after closeDatabase() (FINDINGS Medium, shutdown)',
  );
});
