import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw.js';
import { loadJson } from '../../__fixtures__/load.js';
import { clearCache, fetchBeachWaterQuality } from '../beachWaterQuality.js';
import beachData from '../../data/vtBeaches.json' with { type: 'json' };
import type { BurlingtonApiResponse } from '../../types/beach.js';

const BTV_URL =
  'https://maps.burlingtonvt.gov/arcgis/rest/services/BTV_Beach_Status/MapServer/0/query';
const TWELVE_HOURS = 12 * 60 * 60 * 1000;

function fixture(): BurlingtonApiResponse {
  return loadJson<BurlingtonApiResponse>('burlington/beach-status.json');
}

function useBurlington(body: BurlingtonApiResponse = fixture()): {
  calls: () => number;
  lastUrl: () => string | undefined;
} {
  let calls = 0;
  let lastUrl: string | undefined;
  server.use(
    http.get(BTV_URL, ({ request }) => {
      calls++;
      lastUrl = request.url;
      return HttpResponse.json(body);
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

describe('fetchBeachWaterQuality', () => {
  it('merges Burlington results into the static beach list', async () => {
    const { lastUrl } = useBurlington();
    const beaches = await fetchBeachWaterQuality();
    const byId = Object.fromEntries(beaches.map((b) => [b.id, b]));

    expect(new URL(lastUrl()!).searchParams.get('f')).toBe('json');
    expect(beaches).toHaveLength(beachData.length);

    expect(byId['north-shore-natural-area']).toMatchObject({
      status: 'open',
      color: 'green',
      waterQualityGrade: 'A',
      eColiLevel: 20,
      cyanobacteriaCategory: 1,
      lastTested: '2026-07-14T13:30:00Z',
      advisory: null,
      waterTemp: null,
    });
    expect(byId['leddy-beach-north']).toMatchObject({
      status: 'alert',
      color: 'yellow',
      waterQualityGrade: 'B',
      advisory:
        'Cyanobacteria is present in low levels. Vulnerable groups (children and pets) are advised to avoid the water. Resampling tomorrow.',
    });
    expect(byId['leddy-beach-south']).toMatchObject({
      status: 'closed',
      color: 'red',
      advisory: 'Cyanobacteria bloom present at dangerous levels. Swimming prohibited.',
    });
    expect(byId['north-beach-north']).toMatchObject({
      status: 'open',
      color: 'red',
      waterQualityGrade: 'D',
      advisory: 'High E. coli levels detected. Beach closed until levels return to safe range.',
    });
    // EColi 0 = not tested; null category = unknown
    expect(byId['north-beach-south']).toMatchObject({
      status: 'unknown',
      color: 'yellow',
      eColiLevel: null,
      waterQualityGrade: null,
    });
    // Burlington beach with no result, and a non-Burlington beach
    for (const id of ['texaco-beach', 'sand-bar-state-park']) {
      expect(byId[id]).toMatchObject({ status: 'unknown', color: 'yellow', lastTested: null });
    }
  });

  it.each([
    [99, 'B', 'green'],
    [100, 'C', 'yellow'],
    [234, 'C', 'yellow'],
    [235, 'D', 'red'],
    [500, 'F', 'red'],
  ])('grades E. coli %i as %s / %s for an open beach', async (eColi, grade, color) => {
    const body = fixture();
    body.features[0]!.attributes.EColi = eColi;
    useBurlington(body);

    const [beach] = await fetchBeachWaterQuality();
    expect(beach).toMatchObject({ waterQualityGrade: grade, color });
  });

  it('uses Notes alone as the advisory when no advisory is generated', async () => {
    const body = fixture();
    body.features[0]!.attributes.Notes = 'Lifeguards off duty.';
    useBurlington(body);

    const [beach] = await fetchBeachWaterQuality();
    expect(beach?.advisory).toBe('Lifeguards off duty.');
  });

  it('treats an unrecognised cyanobacteria category as unknown', async () => {
    const body = fixture();
    body.features[0]!.attributes.CyanobacteriaCategory = 7;
    body.features[0]!.attributes.EColi = null;
    useBurlington(body);

    const [beach] = await fetchBeachWaterQuality();
    expect(beach).toMatchObject({ status: 'unknown', color: 'yellow' });
  });

  it('handles an empty feature list', async () => {
    useBurlington({ features: [] });
    const beaches = await fetchBeachWaterQuality();
    expect(beaches.every((b) => b.status === 'unknown')).toBe(true);
  });

  it.each([
    [
      'an upstream 500',
      () => server.use(http.get(BTV_URL, () => new HttpResponse(null, { status: 500 }))),
    ],
    ['a network error', () => server.use(http.get(BTV_URL, () => HttpResponse.error()))],
    ['malformed JSON', () => server.use(http.get(BTV_URL, () => HttpResponse.text('<html>')))],
    [
      'a body without features',
      () => server.use(http.get(BTV_URL, () => HttpResponse.json({ error: { code: 400 } }))),
    ],
  ])('returns static beaches with unknown status on %s', async (_name, arrange) => {
    arrange();
    const beaches = await fetchBeachWaterQuality();

    expect(beaches).toHaveLength(beachData.length);
    expect(beaches.every((b) => b.status === 'unknown' && b.color === 'yellow')).toBe(true);
  });

  it('serves the cache for 12 hours, then refetches', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const { calls } = useBurlington();

    const first = await fetchBeachWaterQuality();
    expect(await fetchBeachWaterQuality()).toBe(first);
    expect(calls()).toBe(1);

    vi.advanceTimersByTime(TWELVE_HOURS + 1);
    await fetchBeachWaterQuality();
    expect(calls()).toBe(2);
  });

  // Regression: FINDINGS Medium (stale-on-error fallback was dead code).
  it('falls back to stale data when a refresh after expiry fails', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    useBurlington();
    const good = await fetchBeachWaterQuality();

    vi.advanceTimersByTime(TWELVE_HOURS + 1);
    server.use(http.get(BTV_URL, () => new HttpResponse(null, { status: 500 })));
    expect(await fetchBeachWaterQuality()).toBe(good);
  });

  it('clearCache forces a refetch', async () => {
    const { calls } = useBurlington();
    await fetchBeachWaterQuality();
    clearCache();
    await fetchBeachWaterQuality();
    expect(calls()).toBe(2);
  });
});
