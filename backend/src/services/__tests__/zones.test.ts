import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw.js';
import { loadJson } from '../../__fixtures__/load.js';
import {
  clearZoneCache,
  extractZoneId,
  fetchZoneBoundaries,
  fetchZoneBoundary,
  filterVermontZones,
  getZoneCacheStats,
  isVermontZone,
} from '../zones.js';

const ZONE = 'https://api.weather.gov/zones/forecast/:zoneId';

function useZones(): { calls: string[] } {
  const calls: string[] = [];
  server.use(
    http.get(ZONE, ({ params }) => {
      const id = String(params.zoneId);
      calls.push(id);
      if (id === 'VTZ005' || id === 'VTZ006') {
        return HttpResponse.json(loadJson(`noaa/zone-${id}.json`));
      }
      // Any other zone: synthesise a small polygon zone
      return HttpResponse.json({
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-72, 44],
              [-71.9, 44],
              [-72, 44.1],
              [-72, 44],
            ],
          ],
        },
        properties: { id, name: `Zone ${id}`, state: 'VT' },
      });
    }),
  );
  return { calls };
}

beforeEach(() => {
  clearZoneCache();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('zone id helpers', () => {
  it('extracts the id from a zone URL and passes bare ids through', () => {
    expect(extractZoneId('https://api.weather.gov/zones/forecast/VTZ001')).toBe('VTZ001');
    expect(extractZoneId('VTZ001')).toBe('VTZ001');
  });

  it('identifies Vermont zones by the VTZ prefix', () => {
    expect(isVermontZone('https://api.weather.gov/zones/forecast/VTZ001')).toBe(true);
    expect(isVermontZone('NYZ026')).toBe(false);
    expect(isVermontZone('VTC007')).toBe(false); // county, not forecast zone
  });

  it('filters a mixed list down to Vermont zones', () => {
    expect(
      filterVermontZones([
        'https://api.weather.gov/zones/forecast/VTZ001',
        'https://api.weather.gov/zones/forecast/NYZ026',
        'NHZ001',
        'VTZ002',
      ]),
    ).toEqual(['https://api.weather.gov/zones/forecast/VTZ001', 'VTZ002']);
  });
});

describe('fetchZoneBoundary', () => {
  it('parses a zone boundary', async () => {
    useZones();
    const boundary = await fetchZoneBoundary('VTZ006');

    expect(boundary).toMatchObject({ id: 'VTZ006', name: 'Lamoille', state: 'VT' });
    expect(boundary?.geometry.type).toBe('MultiPolygon');
  });

  it('caches boundaries for 24 hours', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const { calls } = useZones();

    await fetchZoneBoundary('VTZ005');
    await fetchZoneBoundary('VTZ005');
    expect(calls).toEqual(['VTZ005']);
    expect(getZoneCacheStats().size).toBe(1);

    vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000 + 1);
    await fetchZoneBoundary('VTZ005');
    expect(calls).toEqual(['VTZ005', 'VTZ005']);
    expect(getZoneCacheStats().size).toBe(1); // refreshed in place
  });

  it('returns null for a non-OK response', async () => {
    server.use(http.get(ZONE, () => new HttpResponse(null, { status: 404 })));
    expect(await fetchZoneBoundary('VTZ999')).toBeNull();
  });

  it('returns null when the zone has no geometry', async () => {
    server.use(
      http.get(ZONE, () =>
        HttpResponse.json({ geometry: null, properties: { id: 'VTZ1', name: 'x', state: 'VT' } }),
      ),
    );
    expect(await fetchZoneBoundary('VTZ1')).toBeNull();
    expect(getZoneCacheStats().size).toBe(0);
  });

  it('returns null on network error and on malformed JSON', async () => {
    server.use(http.get(ZONE, () => HttpResponse.error()));
    expect(await fetchZoneBoundary('VTZ1')).toBeNull();

    server.use(
      http.get(
        ZONE,
        () => new HttpResponse('<html>', { headers: { 'Content-Type': 'application/json' } }),
      ),
    );
    expect(await fetchZoneBoundary('VTZ1')).toBeNull();
  });

  it('evicts the oldest entry beyond 30 zones', async () => {
    const { calls } = useZones();
    for (let i = 1; i <= 31; i++) {
      await fetchZoneBoundary(`VTZ${100 + i}`);
    }
    expect(getZoneCacheStats()).toMatchObject({ size: 30, maxSize: 30 });

    await fetchZoneBoundary('VTZ131'); // newest: cached
    expect(calls).toHaveLength(31);
    await fetchZoneBoundary('VTZ101'); // oldest: evicted
    expect(calls).toHaveLength(32);
  });
});

describe('fetchZoneBoundaries', () => {
  it('dedupes URLs, uses the cache, and omits failed zones', async () => {
    const { calls } = useZones();
    server.use(
      http.get('https://api.weather.gov/zones/forecast/VTZ404', () => HttpResponse.error()),
    );
    await fetchZoneBoundary('VTZ005');

    const result = await fetchZoneBoundaries([
      'https://api.weather.gov/zones/forecast/VTZ005',
      'https://api.weather.gov/zones/forecast/VTZ006',
      'VTZ006',
      'VTZ404',
    ]);

    expect([...result.keys()].sort()).toEqual(['VTZ005', 'VTZ006']);
    expect(calls).toEqual(['VTZ005', 'VTZ006']); // VTZ005 served from cache
  });

  it('returns an empty map for no input without any requests', async () => {
    expect((await fetchZoneBoundaries([])).size).toBe(0);
  });
});

describe('clearZoneCache', () => {
  it('empties the cache and reports success', async () => {
    useZones();
    await fetchZoneBoundary('VTZ005');
    const result = clearZoneCache();

    expect(result.cleared).toBe(true);
    expect(getZoneCacheStats().size).toBe(0);
  });
});
