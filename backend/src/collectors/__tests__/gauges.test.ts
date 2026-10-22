import { http, HttpResponse, type JsonBodyType } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '../../test/msw.js';
import { createFakeDb, type FakeDb } from '../../db/__tests__/fakeDb.js';
import type { NewRiverGauge } from '../../db/schema.js';

const dbMock = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock('../../db/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../db/index.js')>()),
  getDb: dbMock.getDb,
}));

const { collectRiverGauges } = await import('../gauges.js');

const USGS_URL = 'https://waterservices.usgs.gov/nwis/iv';

interface SeriesOptions {
  code?: string | undefined;
  name?: string | undefined;
  lat?: number | undefined;
  lon?: number | undefined;
  values?: Array<{ value?: string; dateTime?: string }>;
  noGeo?: boolean;
}

function series(opts: SeriesOptions = {}): JsonBodyType {
  return {
    sourceInfo: {
      ...(opts.name !== undefined && { siteName: opts.name }),
      siteCode: [{ value: opts.code }],
      ...(!opts.noGeo && {
        geoLocation: { geogLocation: { latitude: opts.lat, longitude: opts.lon } },
      }),
    },
    values: [{ value: opts.values ?? [] }],
  };
}

const minutesAgo = (m: number): string => new Date(Date.now() - m * 60_000).toISOString();

function serveUsgs(body: JsonBodyType, init?: { status?: number; raw?: boolean }): void {
  server.use(
    http.get(USGS_URL, ({ request }) => {
      const params = new URL(request.url).searchParams;
      expect(params.get('stateCd')).toBe('VT');
      expect(params.get('parameterCd')).toBe('00065');
      if (init?.raw) {
        return new HttpResponse(body as string, {
          status: init.status ?? 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return HttpResponse.json(body, { status: init?.status ?? 200 });
    }),
  );
}

let fake: FakeDb;

beforeEach(() => {
  fake = createFakeDb();
  dbMock.getDb.mockReturnValue(fake.db);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('collectRiverGauges', () => {
  it('returns 0 without fetching when the database is not configured', async () => {
    dbMock.getDb.mockReturnValue(null);
    await expect(collectRiverGauges()).resolves.toBe(0);
  });

  it('stores the latest fresh reading per site and skips invalid series', async () => {
    const fresh = minutesAgo(15);
    serveUsgs({
      value: {
        timeSeries: [
          series({
            code: '04282500',
            name: 'OTTER CREEK AT MIDDLEBURY, VT',
            lat: 44.01,
            lon: -73.17,
            values: [
              { value: '3.10', dateTime: minutesAgo(30) },
              { value: '3.25', dateTime: fresh },
            ],
          }),
          series({
            code: '04290500',
            lat: 44.47,
            lon: -73.2,
            values: [{ value: '5', dateTime: fresh }],
          }),
          series({ code: undefined, lat: 44, lon: -72, values: [{ value: '1', dateTime: fresh }] }),
          series({ code: 'NOGEO', noGeo: true, values: [{ value: '1', dateTime: fresh }] }),
          series({ code: 'ZERO', lat: 0, lon: 0, values: [{ value: '1', dateTime: fresh }] }),
          series({ code: 'NOVAL', lat: 44, lon: -72, values: [] }),
          series({ code: 'NAN', lat: 44, lon: -72, values: [{ value: 'Ice', dateTime: fresh }] }),
          series({ code: 'BADDATE', lat: 44, lon: -72, values: [{ value: '1', dateTime: 'x' }] }),
          series({
            code: 'STALE',
            lat: 44,
            lon: -72,
            values: [{ value: '1', dateTime: minutesAgo(4 * 60) }],
          }),
          { values: [] }, // no sourceInfo
        ],
      },
    });

    await expect(collectRiverGauges()).resolves.toBe(2);

    const [insert] = fake.ofType('insert');
    expect(insert?.table).toBe('river_gauges');
    expect(insert?.onConflictDoNothing).toBe(true);
    const rows = insert?.values as NewRiverGauge[];
    expect(rows).toEqual([
      {
        siteCode: '04282500',
        siteName: 'OTTER CREEK AT MIDDLEBURY, VT',
        latitude: '44.01',
        longitude: '-73.17',
        observedAt: new Date(fresh),
        gageHeightFt: '3.25',
      },
      {
        siteCode: '04290500',
        siteName: 'Unknown',
        latitude: '44.47',
        longitude: '-73.2',
        observedAt: new Date(fresh),
        gageHeightFt: '5',
      },
    ]);
  });

  it('returns 0 without inserting when no usable readings exist', async () => {
    serveUsgs({ value: { timeSeries: [] } });
    await expect(collectRiverGauges()).resolves.toBe(0);
    expect(fake.queries).toHaveLength(0);
  });

  it('treats an unexpected JSON shape as no data', async () => {
    serveUsgs({ value: { timeSeries: 'nope' } });
    await expect(collectRiverGauges()).resolves.toBe(0);
  });

  it('throws on non-2xx responses', async () => {
    serveUsgs({}, { status: 503 });
    await expect(collectRiverGauges()).rejects.toThrow('USGS API returned 503');
  });

  it('throws on malformed JSON', async () => {
    serveUsgs('{not json', { raw: true });
    await expect(collectRiverGauges()).rejects.toThrow('USGS API returned invalid JSON');
  });

  it('propagates insert failures', async () => {
    serveUsgs({
      value: {
        timeSeries: [
          series({
            code: 'A',
            lat: 44,
            lon: -72,
            values: [{ value: '1', dateTime: minutesAgo(5) }],
          }),
        ],
      },
    });
    fake.failNext('insert', new Error('pool exhausted'));
    await expect(collectRiverGauges()).rejects.toThrow('pool exhausted');
  });

  it.todo('aborts the USGS fetch after a timeout (FINDINGS H5)');
});
