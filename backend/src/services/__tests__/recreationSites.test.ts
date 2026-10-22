import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw.js';
import { loadJson } from '../../__fixtures__/load.js';
import { clearCache, fetchRecreationSites } from '../recreationSites.js';
import { paddedFixture, RECREATION_URL, type EsriResponse } from './arcgisFixtures.js';

const DAY = 24 * 60 * 60 * 1000;
const FIXTURE = 'anr/recreation-sites.json';

function useRecreation(body: unknown = paddedFixture(FIXTURE, 30)): {
  calls: () => number;
  lastUrl: () => URL | undefined;
} {
  let calls = 0;
  let lastUrl: URL | undefined;
  server.use(
    http.get(RECREATION_URL, ({ request }) => {
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

describe('fetchRecreationSites', () => {
  it('queries camping/swimming sites and parses amenities', async () => {
    const { lastUrl } = useRecreation();
    const sites = await fetchRecreationSites();

    expect(lastUrl()?.searchParams.get('where')).toContain("F_CAMP='Y'");
    expect(lastUrl()?.searchParams.get('f')).toBe('json');

    // 6 fixture features + 24 clones of the first; 2 fixture features are invalid
    expect(sites).toHaveLength(28);
    const byId = Object.fromEntries(sites.map((s) => [s.id, s]));
    expect(byId['rec-15']).toBeUndefined(); // no name
    expect(byId['rec-16']).toBeUndefined(); // outside Vermont

    const smugglers = byId['rec-11']!;
    expect(smugglers).toMatchObject({
      name: 'Smugglers Notch State Park',
      type: 'camping',
      address: '6443 Mountain Rd',
      town: 'Stowe',
      phone: '802-253-4014',
      isPublic: true,
      acreage: 35,
      parkingSpaces: 40,
      amenities: {
        camping: {
          tentSites: 20,
          rvSites: 0,
          shelters: 14,
          hookups: { electric: 0, water: 0, both: 0 },
          groupCamping: false,
          primitiveCamping: false,
          winterCamping: true,
        },
        swimming: null,
        boatRental: false,
        picnicArea: true,
        playground: false,
      },
    });
    expect(smugglers.latitude).toBeCloseTo(44.536, 2);
    expect(smugglers.longitude).toBeCloseTo(-72.816, 2);

    expect(byId['rec-12']).toMatchObject({
      type: 'beach',
      address: null,
      acreage: null,
      amenities: {
        camping: null,
        swimming: {
          lakeSwimming: true,
          poolSwimming: false,
          riverSwimming: false,
          hasBeach: true,
          waterBodyName: 'Lake Champlain',
        },
        boatRental: true,
        playground: true,
      },
    });
    expect(byId['rec-13']?.type).toBe('mixed');
    // Tents but F_CAMP != 'Y': counted as camping type, but no camping amenity block
    expect(byId['rec-14']).toMatchObject({
      type: 'camping',
      isPublic: false,
      amenities: { camping: null },
    });
  });

  it('accepts truncated (exceededTransferLimit) responses', async () => {
    const body = paddedFixture(FIXTURE, 30);
    body.exceededTransferLimit = true;
    useRecreation(body);

    expect(await fetchRecreationSites()).toHaveLength(28);
  });

  it.each([
    ['fewer than 20 valid sites', () => useRecreation(loadJson<EsriResponse>(FIXTURE))],
    ['an empty feature list', () => useRecreation({ features: [] })],
    [
      'an ArcGIS error body',
      () => useRecreation({ error: { code: 400, message: 'Invalid query' } }),
    ],
    [
      'an upstream 500',
      () => server.use(http.get(RECREATION_URL, () => new HttpResponse(null, { status: 500 }))),
    ],
    ['a network error', () => server.use(http.get(RECREATION_URL, () => HttpResponse.error()))],
    [
      'malformed JSON',
      () => server.use(http.get(RECREATION_URL, () => HttpResponse.text('<html>'))),
    ],
  ])('returns [] on %s with no cache', async (_name, arrange) => {
    arrange();
    expect(await fetchRecreationSites()).toEqual([]);
  });

  it('serves the cache for 24 hours, then refetches', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const { calls } = useRecreation();

    const first = await fetchRecreationSites();
    expect(await fetchRecreationSites()).toBe(first);
    expect(calls()).toBe(1);

    vi.advanceTimersByTime(DAY + 1);
    await fetchRecreationSites();
    expect(calls()).toBe(2);
  });

  // Regression: FINDINGS Medium (stale-on-error fallback was dead code).
  it('falls back to stale data when a refresh after expiry fails', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    useRecreation();
    const good = await fetchRecreationSites();

    vi.advanceTimersByTime(DAY + 1);
    server.use(http.get(RECREATION_URL, () => HttpResponse.error()));
    expect(await fetchRecreationSites()).toBe(good);
  });

  it('clearCache forces a refetch', async () => {
    const { calls } = useRecreation();
    await fetchRecreationSites();
    clearCache();
    await fetchRecreationSites();
    expect(calls()).toBe(2);
  });
});
