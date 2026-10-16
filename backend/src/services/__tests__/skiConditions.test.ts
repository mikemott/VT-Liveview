import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw.js';
import { loadText } from '../../__fixtures__/load.js';
import { calculateResortColor, clearCache, fetchSkiConditions } from '../skiConditions.js';
import { RESORT_COORDS, RESORT_LOGOS } from '../../data/resortData.js';

describe('calculateResortColor', () => {
  it('returns green for good snow and operations', () => {
    const result = calculateResortColor({
      snowfall24hr: 2.5,
      trailsOpen: 80,
      trailsTotal: 100,
      liftsOpen: 14,
      liftsTotal: 15,
    });
    expect(result).toBe('green');
  });

  it('returns yellow for decent snow and moderate operations', () => {
    const result = calculateResortColor({
      snowfall24hr: 0.5,
      trailsOpen: 50,
      trailsTotal: 100,
      liftsOpen: 6,
      liftsTotal: 15,
    });
    expect(result).toBe('yellow');
  });

  it('returns yellow for open resort with no fresh snow', () => {
    const result = calculateResortColor({
      snowfall24hr: 0,
      trailsOpen: 80,
      trailsTotal: 100,
      liftsOpen: 12,
      liftsTotal: 15,
    });
    expect(result).toBe('yellow');
  });

  it('returns red for poor operations', () => {
    const result = calculateResortColor({
      snowfall24hr: 1,
      trailsOpen: 20,
      trailsTotal: 100,
      liftsOpen: 2,
      liftsTotal: 15,
    });
    expect(result).toBe('red');
  });

  it('handles null snowfall', () => {
    const result = calculateResortColor({
      snowfall24hr: null,
      trailsOpen: 70,
      trailsTotal: 100,
      liftsOpen: 10,
      liftsTotal: 15,
    });
    expect(result).toBe('yellow');
  });
});

// ===========================================================================
// fetchSkiConditions (scraper) — synthetic skivermont.com HTML via MSW
// ===========================================================================

const SKI_URL = 'https://skivermont.com/conditions';
const TWELVE_HOURS = 12 * 60 * 60 * 1000;

function useSkiHtml(html = loadText('skivermont/conditions.html')): { calls: () => number } {
  let calls = 0;
  server.use(
    http.get(SKI_URL, () => {
      calls++;
      return HttpResponse.html(html);
    }),
  );
  return { calls: () => calls };
}

function useSkiOutage(): void {
  server.use(http.get(SKI_URL, () => new HttpResponse(null, { status: 503 })));
}

describe('fetchSkiConditions', () => {
  beforeEach(() => {
    clearCache();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('parses resort cards, normalising names and skipping duplicates/unknowns', async () => {
    useSkiHtml();
    const resorts = await fetchSkiConditions();

    expect(resorts.map((r) => r.name)).toEqual([
      'Stowe', // "Stowe Cross Country" is a duplicate and skipped
      'Killington',
      'Smugglers Notch', // "Smugglers' Notch Resort"
      'Jay Peak',
      'Sugarbush', // "Sugarbush Resort"
      'Mad River Glen',
      'Okemo',
      'Mount Snow',
      'Bolton Valley',
      'Burke Mountain',
      'Middlebury Snow Bowl', // "Middlebury Snowbowl"
      'Cochrans Ski Area', // curly apostrophe "Cochran’s Ski Area"
    ]);
  });

  it('extracts snowfall, lifts, trails, temperatures, status and colour', async () => {
    useSkiHtml();
    const resorts = await fetchSkiConditions();
    const byName = Object.fromEntries(resorts.map((r) => [r.name, r]));

    expect(byName['Stowe']).toEqual({
      id: 'stowe',
      name: 'Stowe',
      latitude: RESORT_COORDS['Stowe']!.lat,
      longitude: RESORT_COORDS['Stowe']!.lon,
      logoUrl: RESORT_LOGOS['Stowe'],
      snowfall24hr: 4,
      snowfallCumulative: 52,
      liftsOpen: 12,
      liftsTotal: 13,
      trailsOpen: 100,
      trailsTotal: 116,
      tempCurrent: 12,
      tempHigh: 24,
      tempLow: 12,
      baseDepth: null,
      lastUpdated: expect.any(String) as string,
      status: 'open',
      color: 'green',
    });
    expect(byName['Killington']).toMatchObject({
      snowfall24hr: 1.5,
      tempLow: -3,
      tempHigh: 15,
      status: 'partial',
      color: 'yellow',
    });
    expect(byName['Smugglers Notch']).toMatchObject({
      id: 'smugglers-notch',
      snowfall24hr: null, // "No Update"
      snowfallCumulative: 6, // from "Last Snowfall"
      tempLow: null,
    });
    expect(byName['Mad River Glen']).toMatchObject({ status: 'closed', color: 'red' });
    expect(byName['Cochrans Ski Area']?.logoUrl).toBeNull();
  });

  it('returns [] when fewer than 10 resorts can be parsed', async () => {
    const html = loadText('skivermont/conditions.html');
    const cards = html.split('<div class="card">');
    useSkiHtml(cards.slice(0, 4).join('<div class="card">')); // 3 cards
    expect(await fetchSkiConditions()).toEqual([]);
  });

  it.each([
    ['an upstream 503', () => useSkiOutage()],
    ['a network error', () => server.use(http.get(SKI_URL, () => HttpResponse.error()))],
    ['non-HTML garbage', () => useSkiHtml('{"not":"html"}')],
    ['an empty body', () => useSkiHtml('')],
  ])('returns [] on %s with no cache', async (_name, arrange) => {
    arrange();
    expect(await fetchSkiConditions()).toEqual([]);
  });

  it('serves the cache for 12 hours, then refetches', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const { calls } = useSkiHtml();

    const first = await fetchSkiConditions();
    expect(await fetchSkiConditions()).toBe(first);
    expect(calls()).toBe(1);

    vi.advanceTimersByTime(TWELVE_HOURS + 1);
    await fetchSkiConditions();
    expect(calls()).toBe(2);
  });

  // Regression: FINDINGS Medium "TTL timer clears the Map, so the stale-on-error
  // fallback is dead code and an outage returns [] uncached".
  it('falls back to stale data when a refresh after expiry fails', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    useSkiHtml();
    const good = await fetchSkiConditions();

    vi.advanceTimersByTime(TWELVE_HOURS + 1);
    useSkiOutage();
    expect(await fetchSkiConditions()).toBe(good);
  });

  it('clearCache forces a refetch', async () => {
    const { calls } = useSkiHtml();
    await fetchSkiConditions();
    clearCache();
    await fetchSkiConditions();
    expect(calls()).toBe(2);
  });

  it.todo('aborts a hung skivermont.com request with a timeout (FINDINGS H5)');
});
