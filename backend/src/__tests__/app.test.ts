/**
 * Integration tests for the Fastify app (routes, CORS, rate limiting, admin auth)
 * via fastify.inject(). The database layer is mocked; upstream HTTP goes to MSW.
 */
import type { FastifyInstance } from 'fastify';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../test/msw.js';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  isDatabaseEnabled: vi.fn<() => boolean>(),
  checkDatabaseHealth:
    vi.fn<() => Promise<{ connected: boolean; latencyMs: number | null; error?: string }>>(),
  fetchSkiConditions: vi.fn<() => Promise<unknown[]>>(),
}));

vi.mock('../db/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../db/index.js')>()),
  getDb: mocks.getDb,
  isDatabaseEnabled: mocks.isDatabaseEnabled,
  checkDatabaseHealth: mocks.checkDatabaseHealth,
}));
vi.mock('../services/skiConditions.js', () => ({
  fetchSkiConditions: mocks.fetchSkiConditions,
}));

const VT511 = 'https://nec-por.ne-compass.com/NEC.XmlDataPortal/api/c2c';
const apps: FastifyInstance[] = [];

/** Build the app against a fresh module graph so the cached env reflects `env`. */
async function loadApp(env: Record<string, string | undefined> = {}): Promise<FastifyInstance> {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  vi.resetModules();
  const { buildServer } = await import('../app.js');
  const app = await buildServer({ logger: false });
  apps.push(app);
  return app;
}

beforeEach(() => {
  mocks.getDb.mockReset().mockReturnValue(null);
  mocks.isDatabaseEnabled.mockReset().mockReturnValue(false);
  mocks.checkDatabaseHealth.mockReset();
  mocks.fetchSkiConditions.mockReset();
});

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.unstubAllEnvs();
});

describe('GET /health', () => {
  it('is ok with no database configured and includes collector status', async () => {
    const app = await loadApp();

    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    const body = res.json<Record<string, unknown>>();
    expect(body).toMatchObject({
      status: 'ok',
      database: { enabled: false, connected: false, latencyMs: null },
      collector: { enabled: false },
    });
    expect(new Date(body.timestamp as string).toISOString()).toBe(body.timestamp);
    const collector = body.collector as { collectors: Record<string, unknown> };
    expect(Object.keys(collector.collectors).sort()).toEqual([
      'alerts',
      'gauges',
      'traffic',
      'weather',
    ]);
    expect(collector.collectors.weather).toEqual({
      lastRun: null,
      lastResult: null,
      lastError: null,
      nextRun: null,
    });
    expect(mocks.checkDatabaseHealth).not.toHaveBeenCalled();
  });

  it('reports a healthy database', async () => {
    mocks.isDatabaseEnabled.mockReturnValue(true);
    mocks.checkDatabaseHealth.mockResolvedValue({ connected: true, latencyMs: 3 });
    const app = await loadApp();

    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      status: 'ok',
      database: { enabled: true, connected: true, latencyMs: 3 },
      collector: { enabled: true },
    });
    expect(res.json<{ database: object }>().database).not.toHaveProperty('error');
  });

  it('returns 503 "degraded" when the database is down (FINDINGS H4)', async () => {
    mocks.isDatabaseEnabled.mockReturnValue(true);
    mocks.checkDatabaseHealth.mockResolvedValue({
      connected: false,
      latencyMs: null,
      error: 'connection refused',
    });
    const app = await loadApp();

    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({
      status: 'degraded',
      database: { enabled: true, connected: false, latencyMs: null, error: 'connection refused' },
    });
  });

  it.todo('reports "degraded" when a collector is stale or failing (FINDINGS H4)');
  it.todo('does not expose raw database error messages in /health (FINDINGS Medium)');
});

describe('CORS', () => {
  const prodEnv = {
    NODE_ENV: 'production',
    ALLOWED_ORIGINS: 'https://vtliveview.pages.dev, https://example.org',
  };

  it('production: allows a listed origin', async () => {
    const app = await loadApp(prodEnv);

    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://example.org' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://example.org');
  });

  it('production: answers preflight for a listed origin', async () => {
    const app = await loadApp(prodEnv);

    const res = await app.inject({
      method: 'OPTIONS',
      url: '/graphql',
      headers: {
        origin: 'https://vtliveview.pages.dev',
        'access-control-request-method': 'POST',
      },
    });

    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('https://vtliveview.pages.dev');
    expect(res.headers['access-control-allow-methods']).toBe('GET, POST, OPTIONS');
    expect(res.headers['access-control-max-age']).toBe('86400');
  });

  it('production: rejects an unlisted origin', async () => {
    const app = await loadApp(prodEnv);

    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.example' },
    });

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.body).not.toContain('"status":"ok"');
  });

  it('production: allows requests without an Origin header', async () => {
    const app = await loadApp(prodEnv);

    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('production: defaults the allowlist to https://vtliveview.com', async () => {
    const app = await loadApp({ NODE_ENV: 'production', ALLOWED_ORIGINS: undefined });

    const allowed = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://vtliveview.com' },
    });
    const blocked = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://vtliveview.pages.dev' },
    });

    expect(allowed.headers['access-control-allow-origin']).toBe('https://vtliveview.com');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('development: reflects any origin', async () => {
    const app = await loadApp({ NODE_ENV: 'development' });

    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://localhost:5173' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});

describe('rate limiting', () => {
  it('returns 429 on /api/vt511/* after 100 requests per minute', async () => {
    server.use(http.get(VT511, () => HttpResponse.text('<ok/>')));
    const app = await loadApp();

    for (let i = 0; i < 100; i++) {
      const res = await app.inject({ method: 'GET', url: '/api/vt511/incidents' });
      expect(res.statusCode).toBe(200);
    }
    const limited = await app.inject({ method: 'GET', url: '/api/vt511/network' });

    expect(limited.statusCode).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('exempts /health', async () => {
    const app = await loadApp();

    for (let i = 0; i < 110; i++) {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.statusCode).toBe(200);
    }
  });

  it.todo('rate-limits POST /graphql with its own bucket (FINDINGS H3)');
  it.todo('keys the rate limit on fly-client-ip behind the Fly proxy (FINDINGS H3)');
});

describe('POST /admin/clear-cache', () => {
  const TOKEN = 'correct-horse-battery';
  const prod = { NODE_ENV: 'production', ADMIN_TOKEN: TOKEN };

  it('production: rejects a missing token', async () => {
    const app = await loadApp(prod);
    const res = await app.inject({ method: 'POST', url: '/admin/clear-cache' });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('production: rejects a wrong token of the same length', async () => {
    const app = await loadApp(prod);
    const res = await app.inject({
      method: 'POST',
      url: '/admin/clear-cache',
      headers: { 'x-admin-token': 'x'.repeat(TOKEN.length) },
    });
    expect(res.statusCode).toBe(401);
  });

  it('production: rejects a wrong token of a different length', async () => {
    const app = await loadApp(prod);
    const res = await app.inject({
      method: 'POST',
      url: '/admin/clear-cache',
      headers: { 'x-admin-token': `${TOKEN}-extra` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('production: rejects every request when ADMIN_TOKEN is not configured', async () => {
    const app = await loadApp({ NODE_ENV: 'production', ADMIN_TOKEN: undefined });
    const res = await app.inject({
      method: 'POST',
      url: '/admin/clear-cache',
      headers: { 'x-admin-token': 'anything' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('production: clears the cache with the right token', async () => {
    const app = await loadApp(prod);
    const res = await app.inject({
      method: 'POST',
      url: '/admin/clear-cache',
      headers: { 'x-admin-token': TOKEN },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      cleared: true,
      message: 'Weather station cache cleared',
      timestamp: expect.any(String) as string,
    });
  });

  it.todo(
    'requires the admin token outside production too (fail-open when NODE_ENV != production, FINDINGS Medium)',
  );
});

describe('VT 511 proxy routes', () => {
  const routes = [
    ['/api/vt511/incidents', 'incidentData', 'incident'],
    ['/api/vt511/closures', 'laneClosureData', 'lane closure'],
    ['/api/vt511/traffic-conditions', 'trafficCondData', 'traffic condition'],
    ['/api/vt511/network', 'networkData', 'network'],
  ] as const;

  it.each(routes)('%s relays upstream XML for dataTypes=%s', async (url, dataType) => {
    const seen: { search: URLSearchParams; ua: string | null }[] = [];
    server.use(
      http.get(VT511, ({ request }) => {
        const u = new URL(request.url);
        seen.push({ search: u.searchParams, ua: request.headers.get('user-agent') });
        return HttpResponse.text(`<data type="${u.searchParams.get('dataTypes')}"/>`);
      }),
    );
    const app = await loadApp({ CONTACT_EMAIL: 'ops@example.com' });

    const res = await app.inject({ method: 'GET', url });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/xml/);
    expect(res.body).toBe(`<data type="${dataType}"/>`);
    expect(seen).toHaveLength(1);
    expect(seen[0]?.search.get('networks')).toBe('Vermont');
    expect(seen[0]?.search.get('dataTypes')).toBe(dataType);
    expect(seen[0]?.ua).toBe('VT-Liveview/1.0 (ops@example.com)');
  });

  it.each(routes)(
    '%s returns 502 when upstream fails (FINDINGS Medium: response.ok)',
    async (url) => {
      server.use(http.get(VT511, () => HttpResponse.text('Bad gateway', { status: 502 })));
      const app = await loadApp();

      const res = await app.inject({ method: 'GET', url });

      expect(res.statusCode).toBe(502);
      expect(res.json()).toEqual({ error: 'VT 511 upstream returned 502' });
    },
  );

  it.each(routes)('%s returns 500 on a network error', async (url, _dataType, label) => {
    server.use(http.get(VT511, () => HttpResponse.error()));
    const app = await loadApp();

    const res = await app.inject({ method: 'GET', url });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: `Failed to fetch VT 511 ${label} data` });
  });

  it.todo('aborts the upstream fetch after a timeout (FINDINGS H5)');
});

describe('POST /api/ski-conditions/refresh', () => {
  it('reports the number of resorts', async () => {
    mocks.fetchSkiConditions.mockResolvedValue([{}, {}, {}]);
    const app = await loadApp();

    const res = await app.inject({ method: 'POST', url: '/api/ski-conditions/refresh' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      success: true,
      resortCount: 3,
      updated: expect.any(String) as string,
    });
  });

  it('returns 500 with the error message on failure', async () => {
    mocks.fetchSkiConditions.mockRejectedValue(new Error('scrape failed'));
    const app = await loadApp();

    const res = await app.inject({ method: 'POST', url: '/api/ski-conditions/refresh' });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ success: false, error: 'scrape failed' });
  });

  it.todo('requires auth and actually bypasses a warm cache (FINDINGS Medium)');
});

describe('startup', () => {
  it('touches the database connection only when configured', async () => {
    await loadApp();
    expect(mocks.getDb).not.toHaveBeenCalled();

    mocks.isDatabaseEnabled.mockReturnValue(true);
    mocks.getDb.mockReturnValue({});
    await loadApp();
    expect(mocks.getDb).toHaveBeenCalledTimes(1);
  });

  it('fails fast on an invalid environment', async () => {
    vi.stubEnv('PORT', 'not-a-port');
    vi.resetModules();
    const { buildServer } = await import('../app.js');
    await expect(buildServer({ logger: false })).rejects.toThrow('Environment validation failed');
  });
});
