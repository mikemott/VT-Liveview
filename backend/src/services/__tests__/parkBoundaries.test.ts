import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw.js';
import { loadJson } from '../../__fixtures__/load.js';
import { clearCache, fetchParkBoundaries } from '../parkBoundaries.js';
import { PARK_BOUNDARIES_URL } from './arcgisFixtures.js';

const WEEK = 7 * 24 * 60 * 60 * 1000;

function useBoundaries(body: unknown = loadJson('anr/park-boundaries.geojson')): {
  calls: () => number;
  lastUrl: () => URL | undefined;
} {
  let calls = 0;
  let lastUrl: URL | undefined;
  server.use(
    http.get(PARK_BOUNDARIES_URL, ({ request }) => {
      calls++;
      lastUrl = new URL(request.url);
      return HttpResponse.json(body as object);
    }),
  );
  return { calls: () => calls, lastUrl: () => lastUrl };
}

beforeEach(() => {
  clearCache();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('fetchParkBoundaries', () => {
  it('requests GeoJSON and keeps named FPR units only', async () => {
    const { lastUrl } = useBoundaries();
    const boundaries = await fetchParkBoundaries();

    expect(lastUrl()?.searchParams.get('f')).toBe('geojson');
    expect(boundaries).toEqual([
      {
        id: 'park-1',
        anrUnit: 42,
        name: 'Smugglers Notch State Park',
        unitType: 'SP',
        acreage: 35.2,
        geometry: expect.objectContaining({ type: 'Polygon' }) as object,
      },
      {
        id: 'park-2',
        anrUnit: 77,
        name: 'Lake Carmi State Forest',
        unitType: 'SF',
        acreage: 0,
        geometry: expect.objectContaining({ type: 'MultiPolygon' }) as object,
      },
    ]);
  });

  it('returns [] (and does not throw) when every feature is filtered out', async () => {
    useBoundaries({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: 9,
          geometry: { type: 'Polygon', coordinates: [] },
          properties: {
            OBJECTID: 9,
            NAME: 'WMA',
            ANRUnit: 9,
            ANRUnitType: 'WMA',
            ANRDept: 'FWD',
            GISACRES: 1,
          },
        },
      ],
    });
    expect(await fetchParkBoundaries()).toEqual([]);
  });

  it.each([
    [
      'an empty FeatureCollection',
      () => useBoundaries({ type: 'FeatureCollection', features: [] }),
    ],
    [
      'an upstream 500',
      () =>
        server.use(http.get(PARK_BOUNDARIES_URL, () => new HttpResponse(null, { status: 500 }))),
    ],
    [
      'a network error',
      () => server.use(http.get(PARK_BOUNDARIES_URL, () => HttpResponse.error())),
    ],
    [
      'malformed JSON',
      () => server.use(http.get(PARK_BOUNDARIES_URL, () => HttpResponse.text('{'))),
    ],
  ])('returns [] on %s with no cache', async (_name, arrange) => {
    arrange();
    expect(await fetchParkBoundaries()).toEqual([]);
  });

  it('serves the cache for 7 days, then refetches', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const { calls } = useBoundaries();

    const first = await fetchParkBoundaries();
    expect(await fetchParkBoundaries()).toBe(first);
    expect(calls()).toBe(1);

    vi.advanceTimersByTime(WEEK + 1);
    await fetchParkBoundaries();
    expect(calls()).toBe(2);
  });

  // Regression: FINDINGS Medium (stale-on-error fallback was dead code).
  it('falls back to stale data when a refresh after expiry fails', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    useBoundaries();
    const good = await fetchParkBoundaries();

    vi.advanceTimersByTime(WEEK + 1);
    server.use(http.get(PARK_BOUNDARIES_URL, () => HttpResponse.error()));
    expect(await fetchParkBoundaries()).toBe(good);
  });

  it('clearCache forces a refetch', async () => {
    const { calls } = useBoundaries();
    await fetchParkBoundaries();
    clearCache();
    await fetchParkBoundaries();
    expect(calls()).toBe(2);
  });
});
