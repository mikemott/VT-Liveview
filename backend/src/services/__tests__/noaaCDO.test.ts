import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw.js';
import { loadJson } from '../../__fixtures__/load.js';

const CDO = 'https://www.ncei.noaa.gov/cdo-web/api/v2/data';
const BTV = { lat: 44.47, lng: -73.15 }; // Burlington Airport station

type CdoModule = typeof import('../noaaCDO.js');

/** Fresh module (and fresh memoised env) so caches don't leak between tests. */
async function loadCdo(token = 'test-token'): Promise<CdoModule> {
  vi.resetModules();
  vi.stubEnv('NOAA_CDO_TOKEN', token);
  return import('../noaaCDO.js');
}

function useCdo(body: unknown = loadJson('ncei-cdo/data-ghcnd.json')): {
  calls: () => number;
  lastRequest: () => Request | undefined;
} {
  let calls = 0;
  let last: Request | undefined;
  server.use(
    http.get(CDO, ({ request }) => {
      calls++;
      last = request;
      return HttpResponse.json(body as object);
    }),
  );
  return { calls: () => calls, lastRequest: () => last };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0)); // local time, Jan 15 2026
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('getHistoricalWeather', () => {
  it('queries the nearest station for the same week last year and groups by day', async () => {
    const { lastRequest } = useCdo();
    const { getHistoricalWeather } = await loadCdo();

    const result = await getHistoricalWeather(BTV.lat, BTV.lng);

    const url = new URL(lastRequest()!.url);
    expect(lastRequest()!.headers.get('token')).toBe('test-token');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      datasetid: 'GHCND',
      stationid: 'GHCND:USC00431705',
      startdate: '2025-01-08',
      enddate: '2025-01-15',
      datatypeid: 'TMAX,TMIN,PRCP,SNOW',
      units: 'standard',
    });

    expect(result.stationName).toBe('Burlington Airport');
    expect(result.stationDistance).toBeLessThan(0.01);
    // Dates are normalised from CDO's "YYYY-MM-DDT00:00:00" to YYYY-MM-DD, oldest first
    expect(result.weather).toEqual([
      { date: '2025-01-08', tempMax: 30, tempMin: 15, precipitation: 0.13, snowfall: 1.5 },
      { date: '2025-01-09', tempMax: 28, tempMin: 9, precipitation: 0, snowfall: null },
    ]);
  });

  it('picks the closest configured station', async () => {
    useCdo();
    const { getHistoricalWeather } = await loadCdo();

    const result = await getHistoricalWeather(43.6, -72.95); // Rutland
    expect(result.stationName).toBe('Rutland');
  });

  it('returns a null-filled week when CDO has no data', async () => {
    useCdo({});
    const { getHistoricalWeather } = await loadCdo();

    const result = await getHistoricalWeather(BTV.lat, BTV.lng);

    expect(result.weather).toHaveLength(8);
    expect(result.weather[0]).toEqual({
      date: '2025-01-08',
      tempMin: null,
      tempMax: null,
      precipitation: null,
      snowfall: null,
    });
    expect(result.weather.at(-1)?.date).toBe('2025-01-15');
  });

  it('caches empty results too', async () => {
    const { calls } = useCdo({ results: [] });
    const { getHistoricalWeather } = await loadCdo();

    await getHistoricalWeather(BTV.lat, BTV.lng);
    await getHistoricalWeather(BTV.lat, BTV.lng);
    expect(calls()).toBe(1);
  });

  it('throws without a token and makes no request', async () => {
    const { calls } = useCdo();
    const { getHistoricalWeather } = await loadCdo('');

    await expect(getHistoricalWeather(BTV.lat, BTV.lng)).rejects.toThrow(
      'NOAA_CDO_TOKEN environment variable is required',
    );
    expect(calls()).toBe(0);
  });

  it('throws on a non-OK response', async () => {
    server.use(
      http.get(CDO, () => new HttpResponse(null, { status: 429, statusText: 'Too Many Requests' })),
    );
    const { getHistoricalWeather } = await loadCdo();

    await expect(getHistoricalWeather(BTV.lat, BTV.lng)).rejects.toThrow(
      'NOAA CDO API error: 429 Too Many Requests',
    );
  });

  it('rejects on network error and on malformed JSON', async () => {
    server.use(http.get(CDO, () => HttpResponse.error()));
    const { getHistoricalWeather } = await loadCdo();
    await expect(getHistoricalWeather(BTV.lat, BTV.lng)).rejects.toThrow();

    server.use(http.get(CDO, () => HttpResponse.text('<html>oops</html>')));
    await expect(getHistoricalWeather(BTV.lat, BTV.lng)).rejects.toThrow();
  });

  it('aborts after 10 seconds with a timeout error', async () => {
    server.use(http.get(CDO, () => new Promise<Response>(() => {})));
    const { getHistoricalWeather } = await loadCdo();

    const pending = getHistoricalWeather(BTV.lat, BTV.lng);
    const assertion = expect(pending).rejects.toThrow('NOAA CDO API timeout');
    await vi.advanceTimersByTimeAsync(10_001);
    await assertion;
  });

  it('caches per coordinate (3dp) for one hour', async () => {
    const { calls } = useCdo();
    const { getHistoricalWeather } = await loadCdo();

    const a = await getHistoricalWeather(44.47, -73.15);
    const b = await getHistoricalWeather(44.4701, -73.1499); // same key at 3dp
    expect(b).toBe(a);
    expect(calls()).toBe(1);

    vi.advanceTimersByTime(3_600_001);
    await getHistoricalWeather(44.47, -73.15);
    expect(calls()).toBe(2);
  });

  it('evicts the oldest entry once 100 coordinates are cached', async () => {
    const { calls } = useCdo();
    const { getHistoricalWeather } = await loadCdo();

    for (let i = 0; i < 101; i++) {
      await getHistoricalWeather(44 + i / 1000, -73);
    }
    expect(calls()).toBe(101);
    await getHistoricalWeather(44.1, -73); // newest
    expect(calls()).toBe(101);
    await getHistoricalWeather(44, -73); // oldest: evicted
    expect(calls()).toBe(102);
  });

  // Regression: FINDINGS Low "noaaCDO.ts:302,342 orphaned TTL timers on concurrent misses".
  it('keeps the fresher entry after concurrent misses (no orphaned TTL timer)', async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get(CDO, async () => {
        calls++;
        if (calls === 2) await gate;
        return HttpResponse.json(loadJson('ncei-cdo/data-ghcnd.json'));
      }),
    );
    const { getHistoricalWeather } = await loadCdo();

    const first = getHistoricalWeather(BTV.lat, BTV.lng);
    const second = getHistoricalWeather(BTV.lat, BTV.lng);
    await first; // cached at t=0

    // Stay under the 10s request timeout while the second request is in flight
    vi.advanceTimersByTime(5_000);
    release();
    await second; // re-cached at t=5s

    vi.advanceTimersByTime(3_600_000 - 3_000); // t=60m02s: first entry's timer must not evict
    await getHistoricalWeather(BTV.lat, BTV.lng);
    expect(calls).toBe(2);

    vi.advanceTimersByTime(4_000); // t=60m06s: expired
    await getHistoricalWeather(BTV.lat, BTV.lng);
    expect(calls).toBe(3);
  });

  it.todo(
    'keys the cache by nearest station rather than raw lat/lng (FINDINGS Medium noaaCDO.ts:185)',
  );
});
