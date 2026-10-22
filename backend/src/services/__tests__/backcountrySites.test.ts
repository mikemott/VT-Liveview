import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw.js';
import { loadJson } from '../../__fixtures__/load.js';
import { clearCache, fetchBackcountrySites } from '../backcountrySites.js';
import { BACKCOUNTRY_URL, paddedFixture, type EsriResponse } from './arcgisFixtures.js';

const DAY = 24 * 60 * 60 * 1000;
const FIXTURE = 'anr/backcountry-campsites.json';

function useBackcountry(body: unknown = paddedFixture(FIXTURE, 60)): {
  calls: () => number;
  lastUrl: () => URL | undefined;
} {
  let calls = 0;
  let lastUrl: URL | undefined;
  server.use(
    http.get(BACKCOUNTRY_URL, ({ request }) => {
      calls++;
      lastUrl = new URL(request.url);
      return HttpResponse.json(body as object);
    }),
  );
  return { calls: () => calls, lastUrl: () => lastUrl };
}

beforeEach(() => {
  clearCache();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('fetchBackcountrySites', () => {
  it('queries all site types and parses campsites', async () => {
    const { lastUrl } = useBackcountry();
    const sites = await fetchBackcountrySites();

    expect(lastUrl()?.searchParams.get('where')).toBe('Type IN (1, 2, 3, 4, 5, 6)');
    // 6 fixture features + 54 clones; 2 fixture features have unusable geometry
    expect(sites).toHaveLength(58);

    const byId = Object.fromEntries(sites.map((s) => [s.id, s]));
    expect(byId['bc-505']).toBeUndefined(); // x/y = 0
    expect(byId['bc-506']).toBeUndefined(); // outside Vermont

    const leanTo = byId['bc-501']!;
    expect(leanTo).toMatchObject({
      siteId: 'LT-01',
      siteType: 'Lean-to',
      isAccessible: false,
      hasFirePit: true,
      hasPicnicTable: true,
      notes: 'Lake view',
      parkId: 42,
      districtId: 3,
    });
    expect(leanTo.latitude).toBeCloseTo(44.536, 2);
    expect(leanTo.longitude).toBeCloseTo(-72.816, 2);

    expect(byId['bc-502']).toMatchObject({
      siteId: 'Site 502', // blank Site name
      siteType: 'Tent Site',
      isAccessible: true,
      hasFirePit: false,
      hasPicnicTable: false,
      notes: null,
    });
    expect(byId['bc-503']).toMatchObject({ siteType: 'Cabin', notes: null, parkId: 77 });
    expect(byId['bc-504']).toMatchObject({ siteType: 'Unknown', parkId: null, districtId: null });
  });

  it.each([
    ['fewer than 50 valid sites', () => useBackcountry(loadJson<EsriResponse>(FIXTURE))],
    ['an empty feature list', () => useBackcountry({ features: [] })],
    [
      'an upstream 500',
      () => server.use(http.get(BACKCOUNTRY_URL, () => new HttpResponse(null, { status: 500 }))),
    ],
    ['a network error', () => server.use(http.get(BACKCOUNTRY_URL, () => HttpResponse.error()))],
    [
      'malformed JSON',
      () => server.use(http.get(BACKCOUNTRY_URL, () => HttpResponse.text('nope'))),
    ],
  ])('returns [] on %s with no cache', async (_name, arrange) => {
    arrange();
    expect(await fetchBackcountrySites()).toEqual([]);
  });

  it('accepts truncated (exceededTransferLimit) responses', async () => {
    const body = paddedFixture(FIXTURE, 60);
    body.exceededTransferLimit = true;
    useBackcountry(body);
    expect(await fetchBackcountrySites()).toHaveLength(58);
  });

  it('serves the cache for 24 hours, then refetches', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const { calls } = useBackcountry();

    const first = await fetchBackcountrySites();
    expect(await fetchBackcountrySites()).toBe(first);
    expect(calls()).toBe(1);

    vi.advanceTimersByTime(DAY + 1);
    await fetchBackcountrySites();
    expect(calls()).toBe(2);
  });

  // Regression: FINDINGS Medium (stale-on-error fallback was dead code).
  it('falls back to stale data when a refresh after expiry fails', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    useBackcountry();
    const good = await fetchBackcountrySites();

    vi.advanceTimersByTime(DAY + 1);
    server.use(http.get(BACKCOUNTRY_URL, () => new HttpResponse(null, { status: 502 })));
    expect(await fetchBackcountrySites()).toBe(good);
  });

  it('clearCache forces a refetch', async () => {
    const { calls } = useBackcountry();
    await fetchBackcountrySites();
    clearCache();
    await fetchBackcountrySites();
    expect(calls()).toBe(2);
  });
});
