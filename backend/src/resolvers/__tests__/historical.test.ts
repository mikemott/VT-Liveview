/**
 * Historical (database-backed) Query fields, executed through /graphql with a
 * fake Drizzle client. Asserts query shape (filters, ordering, limits) and row mapping.
 */
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb, type FakeDb } from '../../db/__tests__/fakeDb.js';

const dbMock = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock('../../db/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../db/index.js')>()),
  getDb: dbMock.getDb,
  isDatabaseEnabled: vi.fn(() => true),
}));

interface GqlBody {
  data?: Record<string, unknown> | null;
  errors?: Array<{ message: string; path?: string[]; extensions?: { code?: string } }>;
}

let app: FastifyInstance;
let fake: FakeDb;

async function gql(query: string): Promise<{ status: number; body: GqlBody }> {
  const res = await app.inject({
    method: 'POST',
    url: '/graphql',
    headers: { 'content-type': 'application/json' },
    payload: { query },
  });
  return { status: res.statusCode, body: res.json<GqlBody>() };
}

beforeAll(async () => {
  const { buildServer } = await import('../../app.js');
  app = await buildServer({ logger: false });
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  fake = createFakeDb();
  dbMock.getDb.mockReset().mockReturnValue(fake.db);
});

const START = '2026-10-01T00:00:00Z';
const END = '2026-10-16T00:00:00Z';
const range = `startDate: "${START}", endDate: "${END}"`;

function onlySelect(): NonNullable<FakeDb['queries'][number]> {
  const selects = fake.ofType('select');
  expect(selects).toHaveLength(1);
  return selects[0] as NonNullable<FakeDb['queries'][number]>;
}

describe('database disabled', () => {
  it.each([
    ['weatherHistory', `{ weatherHistory(${range}) { stationId } }`, []],
    ['alertHistory', `{ alertHistory(${range}) { id } }`, []],
    ['incidentHistory', `{ incidentHistory(${range}) { id } }`, []],
    ['gaugeHistory', `{ gaugeHistory(siteCode: "1", ${range}) { siteCode } }`, []],
    ['dailyWeatherStats', `{ dailyWeatherStats(date: "2026-10-16") { date } }`, null],
  ])('%s returns an empty result without querying', async (field, query, empty) => {
    dbMock.getDb.mockReturnValue(null);
    const { body } = await gql(query);
    expect(body).toEqual({ data: { [field]: empty } });
  });
});

describe('weatherHistory', () => {
  it('maps rows and applies the date range, default limit and ordering', async () => {
    fake.queueSelect([
      {
        stationId: 'KBTV',
        stationName: 'Burlington',
        observedAt: new Date('2026-10-15T12:00:00Z'),
        temperatureF: '41.5',
        humidity: '80.25',
        windSpeedMph: '12.0',
        windDirection: 'NW',
        pressureMb: 1015,
        description: 'Cloudy',
      },
      {
        stationId: 'KBTV',
        stationName: 'Burlington',
        observedAt: new Date('2026-10-15T11:00:00Z'),
        temperatureF: null,
        humidity: null,
        windSpeedMph: null,
        windDirection: null,
        pressureMb: null,
        description: null,
      },
    ]);

    const { body } = await gql(
      `{ weatherHistory(${range}) { stationId stationName observedAt temperatureF humidity
          windSpeedMph windDirection pressureMb description } }`,
    );

    expect(body.errors).toBeUndefined();
    expect(body.data?.weatherHistory).toEqual([
      {
        stationId: 'KBTV',
        stationName: 'Burlington',
        observedAt: '2026-10-15T12:00:00.000Z',
        temperatureF: 41.5,
        humidity: 80.25,
        windSpeedMph: 12,
        windDirection: 'NW',
        pressureMb: 1015,
        description: 'Cloudy',
      },
      {
        stationId: 'KBTV',
        stationName: 'Burlington',
        observedAt: '2026-10-15T11:00:00.000Z',
        temperatureF: null,
        humidity: null,
        windSpeedMph: null,
        windDirection: null,
        pressureMb: null,
        description: null,
      },
    ]);

    const q = onlySelect();
    expect(q.table).toBe('weather_observations');
    expect(q.where?.sql).toBe(
      '("weather_observations"."observed_at" >= $1 and "weather_observations"."observed_at" <= $2)',
    );
    expect(q.where?.params).toEqual([new Date(START).toISOString(), new Date(END).toISOString()]);
    expect(q.orderBy).toEqual(['"weather_observations"."observed_at" desc']);
    expect(q.limit).toBe(100);
  });

  it('filters by station when given', async () => {
    await gql(`{ weatherHistory(stationId: "KMPV", ${range}) { stationId } }`);
    const q = onlySelect();
    expect(q.where?.sql).toContain('"weather_observations"."station_id" = $3');
    expect(q.where?.params[2]).toBe('KMPV');
  });

  it.each([
    [5, 5],
    [1000, 1000],
    [5000, 1000],
    [0, 100],
    [-3, 100],
  ])('limit %i is clamped to %i', async (limit, expected) => {
    await gql(`{ weatherHistory(${range}, limit: ${limit}) { stationId } }`);
    expect(onlySelect().limit).toBe(expected);
  });

  it('rejects an invalid date without querying', async () => {
    const { body } = await gql(
      `{ weatherHistory(startDate: "yesterday-ish", endDate: "${END}") { stationId } }`,
    );
    expect(body.data).toBeNull();
    expect(body.errors?.[0]?.message).toBe('Invalid date: yesterday-ish');
    expect(body.errors?.[0]?.path).toEqual(['weatherHistory']);
    expect(fake.queries).toHaveLength(0);
  });

  it('requires startDate and endDate', async () => {
    const { status, body } = await gql(`{ weatherHistory(startDate: "${START}") { stationId } }`);
    expect(status).toBe(400);
    expect(body.errors?.[0]?.extensions?.code).toBe('GRAPHQL_VALIDATION_FAILED');
  });

  it('surfaces database failures as a GraphQL error', async () => {
    fake.failNext('select', new Error('relation does not exist'));
    const { body } = await gql(`{ weatherHistory(${range}) { stationId } }`);
    expect(body.data).toBeNull();
    expect(body.errors?.[0]?.path).toEqual(['weatherHistory']);
    expect(body.errors?.[0]?.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('returns [] for an empty table', async () => {
    const { body } = await gql(`{ weatherHistory(${range}) { stationId } }`);
    expect(body).toEqual({ data: { weatherHistory: [] } });
  });
});

describe('alertHistory', () => {
  const row = {
    id: 7,
    noaaAlertId: 'urn:oid:1',
    eventType: 'Flood Watch',
    severity: 'Moderate',
    certainty: 'Possible',
    urgency: 'Future',
    headline: null,
    areaDesc: 'Windsor',
    effectiveAt: new Date('2026-10-10T00:00:00Z'),
    expiresAt: new Date('2026-10-11T00:00:00Z'),
    firstSeenAt: new Date('2026-10-10T00:02:00Z'),
    affectedZones: null,
  };

  it('maps rows (id to string, null zones to [])', async () => {
    fake.queueSelect([row]);

    const { body } = await gql(
      `{ alertHistory(${range}) { id noaaAlertId eventType severity certainty urgency headline
          areaDesc effectiveAt expiresAt firstSeenAt affectedZones } }`,
    );

    expect(body).toEqual({
      data: {
        alertHistory: [
          {
            id: '7',
            noaaAlertId: 'urn:oid:1',
            eventType: 'Flood Watch',
            severity: 'Moderate',
            certainty: 'Possible',
            urgency: 'Future',
            headline: null,
            areaDesc: 'Windsor',
            effectiveAt: '2026-10-10T00:00:00.000Z',
            expiresAt: '2026-10-11T00:00:00.000Z',
            firstSeenAt: '2026-10-10T00:02:00.000Z',
            affectedZones: [],
          },
        ],
      },
    });
    const q = onlySelect();
    expect(q.table).toBe('weather_alerts');
    expect(q.where?.sql).toContain('"weather_alerts"."effective_at" >= $1');
    expect(q.orderBy).toEqual(['"weather_alerts"."effective_at" desc']);
    expect(q.limit).toBe(100);
  });

  it('filters by event type and honours limit', async () => {
    await gql(`{ alertHistory(eventType: "Flood Watch", ${range}, limit: 3) { id } }`);
    const q = onlySelect();
    expect(q.where?.sql).toContain('"weather_alerts"."event_type" = $3');
    expect(q.where?.params[2]).toBe('Flood Watch');
    expect(q.limit).toBe(3);
  });

  it('rejects an invalid endDate', async () => {
    const { body } = await gql(`{ alertHistory(startDate: "${START}", endDate: "nope") { id } }`);
    expect(body.errors?.[0]?.message).toBe('Invalid date: nope');
  });

  it.todo(
    'handles a NULL first_seen_at without a non-null GraphQL error (FINDINGS Medium historical.ts:138)',
  );
});

describe('incidentHistory', () => {
  it('maps rows, parsing coordinates', async () => {
    fake.queueSelect([
      {
        id: 12,
        sourceId: 'vt511-INC-1',
        incidentType: 'ACCIDENT',
        severity: 'MAJOR',
        title: 'Crash',
        description: null,
        latitude: '44.475000',
        longitude: '-73.212000',
        roadName: 'I-89',
        firstSeenAt: new Date('2026-10-15T08:00:00Z'),
        resolvedAt: null,
      },
    ]);

    const { body } = await gql(
      `{ incidentHistory(type: "ACCIDENT", ${range}, limit: 2000) { id sourceId incidentType
          severity title description latitude longitude roadName firstSeenAt resolvedAt } }`,
    );

    expect(body).toEqual({
      data: {
        incidentHistory: [
          {
            id: '12',
            sourceId: 'vt511-INC-1',
            incidentType: 'ACCIDENT',
            severity: 'MAJOR',
            title: 'Crash',
            description: null,
            latitude: 44.475,
            longitude: -73.212,
            roadName: 'I-89',
            firstSeenAt: '2026-10-15T08:00:00.000Z',
            resolvedAt: null,
          },
        ],
      },
    });
    const q = onlySelect();
    expect(q.table).toBe('traffic_incidents');
    expect(q.where?.sql).toContain('"traffic_incidents"."first_seen_at" >= $1');
    expect(q.where?.sql).toContain('"traffic_incidents"."incident_type" = $3');
    expect(q.orderBy).toEqual(['"traffic_incidents"."first_seen_at" desc']);
    expect(q.limit).toBe(1000);
  });

  it('includes resolvedAt when present', async () => {
    fake.queueSelect([
      {
        id: 1,
        sourceId: 's',
        incidentType: 'HAZARD',
        severity: 'MINOR',
        title: 't',
        description: 'd',
        latitude: '44',
        longitude: '-72',
        roadName: null,
        firstSeenAt: new Date('2026-10-15T08:00:00Z'),
        resolvedAt: new Date('2026-10-15T09:00:00Z'),
      },
    ]);
    const { body } = await gql(`{ incidentHistory(${range}) { resolvedAt } }`);
    expect(body).toEqual({
      data: { incidentHistory: [{ resolvedAt: '2026-10-15T09:00:00.000Z' }] },
    });
  });
});

describe('gaugeHistory', () => {
  it('maps rows and always filters by site', async () => {
    fake.queueSelect([
      {
        siteCode: '04282500',
        siteName: 'Otter Creek',
        observedAt: new Date('2026-10-15T12:00:00Z'),
        gageHeightFt: '3.25',
        latitude: '44.010000',
        longitude: '-73.170000',
      },
    ]);

    const { body } = await gql(
      `{ gaugeHistory(siteCode: "04282500", ${range}, limit: 10) { siteCode siteName observedAt
          gageHeightFt latitude longitude } }`,
    );

    expect(body).toEqual({
      data: {
        gaugeHistory: [
          {
            siteCode: '04282500',
            siteName: 'Otter Creek',
            observedAt: '2026-10-15T12:00:00.000Z',
            gageHeightFt: 3.25,
            latitude: 44.01,
            longitude: -73.17,
          },
        ],
      },
    });
    const q = onlySelect();
    expect(q.table).toBe('river_gauges');
    expect(q.where?.sql).toBe(
      '("river_gauges"."site_code" = $1 and "river_gauges"."observed_at" >= $2 and "river_gauges"."observed_at" <= $3)',
    );
    expect(q.where?.params[0]).toBe('04282500');
    expect(q.limit).toBe(10);
  });

  it('requires siteCode', async () => {
    const { status } = await gql(`{ gaugeHistory(${range}) { siteCode } }`);
    expect(status).toBe(400);
  });
});

describe('dailyWeatherStats', () => {
  it('aggregates over the UTC day of the given date', async () => {
    fake.queueSelect([
      {
        avgTemperature: '40.123',
        minTemperature: '31.0',
        maxTemperature: '50.5',
        avgHumidity: '77.5',
        totalReadings: 288,
      },
    ]);

    const { body } = await gql(
      `{ dailyWeatherStats(stationId: "KBTV", date: "2026-10-15T22:30:00-04:00") { date stationId
          avgTemperature minTemperature maxTemperature avgHumidity totalReadings } }`,
    );

    expect(body).toEqual({
      data: {
        dailyWeatherStats: {
          date: '2026-10-15T22:30:00-04:00',
          stationId: 'KBTV',
          avgTemperature: 40.123,
          minTemperature: 31,
          maxTemperature: 50.5,
          avgHumidity: 77.5,
          totalReadings: 288,
        },
      },
    });
    const q = onlySelect();
    expect(q.table).toBe('weather_observations');
    expect(q.fields).toEqual([
      'avgTemperature',
      'minTemperature',
      'maxTemperature',
      'avgHumidity',
      'totalReadings',
    ]);
    // 22:30 EDT on the 15th is 02:30 UTC on the 16th -> UTC day boundaries of the 16th
    expect(q.where?.params).toEqual([
      '2026-10-16T00:00:00.000Z',
      '2026-10-16T23:59:59.999Z',
      'KBTV',
    ]);
  });

  it('returns null when there are no readings', async () => {
    fake.queueSelect([
      {
        avgTemperature: null,
        minTemperature: null,
        maxTemperature: null,
        avgHumidity: null,
        totalReadings: 0,
      },
    ]);
    const { body } = await gql('{ dailyWeatherStats(date: "2026-10-16") { date } }');
    expect(body).toEqual({ data: { dailyWeatherStats: null } });
  });

  it('returns null aggregates as null and stationId null when not filtered', async () => {
    fake.queueSelect([
      {
        avgTemperature: null,
        minTemperature: null,
        maxTemperature: null,
        avgHumidity: null,
        totalReadings: 4,
      },
    ]);
    const { body } = await gql(
      '{ dailyWeatherStats(date: "2026-10-16") { stationId avgTemperature avgHumidity totalReadings } }',
    );
    expect(body).toEqual({
      data: {
        dailyWeatherStats: {
          stationId: null,
          avgTemperature: null,
          avgHumidity: null,
          totalReadings: 4,
        },
      },
    });
    expect(onlySelect().where?.params).toHaveLength(2);
  });

  it('rejects an invalid date', async () => {
    const { body } = await gql('{ dailyWeatherStats(date: "16/10/2026x") { date } }');
    expect(body.data).toEqual({ dailyWeatherStats: null });
    expect(body.errors?.[0]?.message).toBe('Invalid date: 16/10/2026x');
  });
});
