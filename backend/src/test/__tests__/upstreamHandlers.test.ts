/**
 * Checks the E2E mock layer: with only upstreamHandlers installed, every query
 * and REST route the frontend uses returns real (non-empty) data. If a service
 * starts calling a new upstream URL, this fails here instead of as a blank map
 * in Playwright.
 */
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../msw.js';
import { upstreamHandlers } from '../upstreamHandlers.js';

let app: FastifyInstance;

beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('ALLOWED_ORIGINS', 'http://localhost:4173');
  vi.stubEnv('CONTACT_EMAIL', 'e2e@example.com');
  vi.stubEnv('DATABASE_URL', undefined);
  const { buildServer } = await import('../../app.js');
  app = await buildServer({ logger: false });
});

afterAll(async () => {
  await app.close();
  vi.unstubAllEnvs();
});

beforeEach(() => {
  server.use(...upstreamHandlers);
});

async function gql(query: string, variables: Record<string, unknown> = {}): Promise<unknown> {
  const res = await app.inject({
    method: 'POST',
    url: '/graphql',
    headers: { origin: 'http://localhost:4173' },
    payload: { query, variables },
  });
  expect(res.statusCode).toBe(200);
  expect(res.headers['access-control-allow-origin']).toBe('http://localhost:4173');
  const body = res.json<{ data?: Record<string, unknown>; errors?: unknown[] }>();
  expect(body.errors).toBeUndefined();
  return Object.values(body.data ?? {})[0];
}

const BURLINGTON = { lat: 44.4759, lon: -73.2121 };

describe('E2E upstream handlers', () => {
  it.each([
    ['mergedAlerts', '{ mergedAlerts(state: "VT") { id event geometry { type } } }'],
    ['alerts', '{ alerts(state: "VT") { id event } }'],
    ['observationStations', '{ observationStations { id name } }'],
    ['skiResorts', '{ skiResorts { name } }'],
    ['beaches', '{ beaches { name } }'],
    ['recreationSites', '{ recreationSites { name } }'],
    ['backcountrySites', '{ backcountrySites { id } }'],
    ['creemeeStands', '{ creemeeStands { name } }'],
    ['campingAreas', '{ campingAreas(minSites: 1) { name } }'],
  ])('%s returns data', async (_name, query) => {
    const result = await gql(query);
    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[]).length).toBeGreaterThan(0);
  });

  it('currentWeather and forecast return data for Burlington', async () => {
    const current = await gql(
      'query($lat: Float!, $lon: Float!) { currentWeather(lat: $lat, lon: $lon) { temperature } }',
      BURLINGTON,
    );
    expect(current).toMatchObject({ temperature: expect.any(Number) as number });

    const forecast = await gql(
      'query($lat: Float!, $lon: Float!) { forecast(lat: $lat, lon: $lon) { name } }',
      BURLINGTON,
    );
    expect((forecast as unknown[]).length).toBeGreaterThan(0);
  });

  it('radarInfo returns a tile pattern', async () => {
    const radar = await gql('{ radarInfo { tilePattern } }');
    expect(radar).toMatchObject({ tilePattern: expect.stringContaining('{z}') as string });
  });

  it.each(['incidents', 'closures'])('/api/vt511/%s relays XML', async (feed) => {
    const res = await app.inject({ method: 'GET', url: `/api/vt511/${feed}` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/xml');
  });
});
