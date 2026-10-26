/**
 * Integration tests for the Fastify app (routes, CORS, rate limiting, admin auth)
 * via fastify.inject(). The database layer is mocked; upstream HTTP goes to MSW.
 */
import type { FastifyInstance } from 'fastify';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../test/msw.js';
import { loadText } from '../__fixtures__/load.js';

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

describe('traffic cameras (VTL-56)', () => {
  const statusXml = loadText('c2c/cctvStatus.xml');
  const snapshotXml = loadText('c2c/cctvSnapshot.xml');
  const useC2C = (fail = false) =>
    server.use(
      http.get(VT511, ({ request }) => {
        if (fail) return new HttpResponse(null, { status: 503 });
        const type = new URL(request.url).searchParams.get('dataTypes');
        return HttpResponse.text(type === 'cctvStatusData' ? statusXml : snapshotXml);
      }),
    );

  it('lists cameras', async () => {
    useC2C();
    const app = await loadApp();
    const res = await app.inject({ method: 'GET', url: '/api/cameras' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=300');
    const body = res.json<{ cameras: { id: string }[] }>();
    expect(body.cameras.map((c) => c.id)).toEqual(['I-89 SB BERLIN', 'VT-108 SMUGGLERS & NOTCH']);
  });

  it('serves a snapshot as image/jpeg, with ids that need URL encoding', async () => {
    useC2C();
    const app = await loadApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/cameras/${encodeURIComponent('I-89 SB BERLIN')}/snapshot.jpg`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/jpeg');
    expect(res.headers['last-modified']).toBe('Sat, 24 Oct 2026 18:19:36 GMT');
    expect(res.rawPayload.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
  });

  it('omits Last-Modified when the capture time is unknown', async () => {
    server.use(
      http.get(VT511, () =>
        HttpResponse.text(
          snapshotXml.replace(/<timestamp>[^<]*<\/timestamp>/g, '<timestamp></timestamp>'),
        ),
      ),
    );
    const app = await loadApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/cameras/${encodeURIComponent('I-89 SB BERLIN')}/snapshot.jpg`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['last-modified']).toBeUndefined();
  });

  it('returns 404 for a camera without a current image', async () => {
    useC2C();
    const app = await loadApp();
    const res = await app.inject({
      method: 'GET',
      url: `/api/cameras/${encodeURIComponent('VT-108 SMUGGLERS & NOTCH')}/snapshot.jpg`,
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 502 when the upstream portal is down', async () => {
    useC2C(true);
    const app = await loadApp();
    expect((await app.inject({ method: 'GET', url: '/api/cameras' })).statusCode).toBe(502);
    expect(
      (await app.inject({ method: 'GET', url: '/api/cameras/x/snapshot.jpg' })).statusCode,
    ).toBe(502);
  });
});

describe('road weather (VTL-61)', () => {
  const essXml = loadText('c2c/essData.xml');

  it('lists online stations with a short cache', async () => {
    server.use(http.get(VT511, () => HttpResponse.text(essXml)));
    const app = await loadApp();
    const res = await app.inject({ method: 'GET', url: '/api/road-weather' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=120');
    const body = res.json<{ stations: { name: string; pavementTempC: number | null }[] }>();
    expect(body.stations).toHaveLength(4);
    expect(body.stations[0]).toMatchObject({ name: 'I-89 BERLIN', pavementTempC: 16.8 });
  });

  it('returns 502 when the portal is down', async () => {
    server.use(http.get(VT511, () => new HttpResponse(null, { status: 503 })));
    const app = await loadApp();
    expect((await app.inject({ method: 'GET', url: '/api/road-weather' })).statusCode).toBe(502);
  });
});

describe('air quality (VTL-75)', () => {
  const AIRNOW = 'https://www.airnowapi.org/aq';
  const monitorsJson = JSON.parse(loadText('airnow/monitors.json')) as unknown[];
  const forecastJson = JSON.parse(loadText('airnow/forecast.json')) as unknown[];

  it('answers an empty 200 without an AirNow key (no console errors in browsers)', async () => {
    const app = await loadApp({ AIRNOW_API_KEY: undefined });
    const monitors = await app.inject({ method: 'GET', url: '/api/air-quality/monitors' });
    expect(monitors.statusCode).toBe(200);
    expect(monitors.json()).toEqual({ configured: false, monitors: [] });
    const point = await app.inject({ method: 'GET', url: '/api/air-quality?lat=44.3&lon=-72.6' });
    expect(point.statusCode).toBe(200);
    expect(point.json()).toEqual({ configured: false, current: null, forecast: [] });
  });

  it('rejects points outside the map area', async () => {
    const app = await loadApp({ AIRNOW_API_KEY: 'KEY' });
    for (const q of ['', '?lat=44.3', '?lat=10&lon=-72', '?lat=abc&lon=-72.6']) {
      const res = await app.inject({ method: 'GET', url: `/api/air-quality${q}` });
      expect(res.statusCode, q).toBe(400);
    }
  });

  it('serves monitors and a point reading with forecast', async () => {
    server.use(
      http.get(`${AIRNOW}/data/`, () => HttpResponse.json(monitorsJson)),
      http.get(`${AIRNOW}/forecast/current/`, () => HttpResponse.json(forecastJson)),
    );
    const app = await loadApp({ AIRNOW_API_KEY: 'KEY' });
    const monitors = await app.inject({ method: 'GET', url: '/api/air-quality/monitors' });
    expect(monitors.statusCode).toBe(200);
    expect(monitors.headers['cache-control']).toBe('public, max-age=600');
    expect(monitors.json<{ monitors: unknown[] }>().monitors).toHaveLength(4);

    const point = await app.inject({ method: 'GET', url: '/api/air-quality?lat=44.48&lon=-73.21' });
    expect(point.statusCode).toBe(200);
    const body = point.json<{ current: { name: string } | null; forecast: unknown[] }>();
    expect(body.current?.name).toBe('Underhill');
    expect(body.forecast).toHaveLength(2);
  });

  it('answers 502 when AirNow is down', async () => {
    server.use(
      http.get(`${AIRNOW}/data/`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${AIRNOW}/forecast/current/`, () => new HttpResponse(null, { status: 500 })),
    );
    const app = await loadApp({ AIRNOW_API_KEY: 'KEY' });
    expect((await app.inject({ method: 'GET', url: '/api/air-quality/monitors' })).statusCode).toBe(
      502,
    );
    expect(
      (await app.inject({ method: 'GET', url: '/api/air-quality?lat=44.3&lon=-72.6' })).statusCode,
    ).toBe(502);
  });
});
