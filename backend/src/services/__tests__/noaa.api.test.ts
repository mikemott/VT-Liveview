/**
 * Behavioural tests for the NOAA service's network-facing functions.
 * All upstream HTTP is served by MSW from synthetic fixtures (src/__fixtures__/noaa, usgs).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw.js';
import { loadJson } from '../../__fixtures__/load.js';
import type { NOAAAlertsResponse } from '../../types/index.js';

const NOAA = 'https://api.weather.gov';
const POINTS = `${NOAA}/points/:coords`;
const STATIONS = `${NOAA}/gridpoints/BTV/89,56/stations`;
const FORECAST = `${NOAA}/gridpoints/BTV/89,56/forecast`;
const OBS = `${NOAA}/stations/:id/observations/latest`;
const ALERTS = `${NOAA}/alerts/active`;
const ZONE = `${NOAA}/zones/forecast/:zoneId`;
const USGS = 'https://waterservices.usgs.gov/nwis/iv/';

type NoaaModule = typeof import('../noaa.js');

/** Fresh module instance so module-level caches don't leak between tests. */
async function loadNoaa(): Promise<NoaaModule> {
  vi.resetModules();
  return import('../noaa.js');
}

interface ObsFixture {
  properties: Record<string, unknown> & { temperature: { value: number | null } | null };
}

function observation(overrides: Record<string, unknown> = {}): ObsFixture {
  const obs = loadJson<ObsFixture>('noaa/observation-latest.json');
  Object.assign(obs.properties, overrides);
  return obs;
}

/** Points + stations handlers with a counter for the points endpoint. */
function useGridHandlers(): { pointsCalls: () => number } {
  let calls = 0;
  server.use(
    http.get(POINTS, () => {
      calls++;
      return HttpResponse.json(loadJson('noaa/points.json'));
    }),
    http.get(STATIONS, () => HttpResponse.json(loadJson('noaa/stations.json'))),
  );
  return { pointsCalls: () => calls };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ===========================================================================
// formatWindSpeed
// ===========================================================================

describe('formatWindSpeed', () => {
  it('converts km/h (the api.weather.gov observation unit) to mph', async () => {
    const { formatWindSpeed } = await loadNoaa();
    expect(formatWindSpeed({ value: 16.09, unitCode: 'wmoUnit:km_h-1' })).toBe('10 mph');
  });

  it('converts m/s to mph', async () => {
    const { formatWindSpeed } = await loadNoaa();
    expect(formatWindSpeed({ value: 4.47, unitCode: 'wmoUnit:m_s-1' })).toBe('10 mph');
  });

  it('returns null for missing values', async () => {
    const { formatWindSpeed } = await loadNoaa();
    expect(formatWindSpeed(null)).toBeNull();
    expect(formatWindSpeed({ value: null, unitCode: 'wmoUnit:km_h-1' })).toBeNull();
  });
});

// ===========================================================================
// getCurrentWeather
// ===========================================================================

describe('getCurrentWeather', () => {
  it('parses the first station with a valid observation', async () => {
    useGridHandlers();
    server.use(http.get(OBS, () => HttpResponse.json(observation())));
    const { getCurrentWeather } = await loadNoaa();

    const wx = await getCurrentWeather(44.4759, -73.2121);

    expect(wx).toEqual({
      temperature: 23, // -5°C
      temperatureUnit: 'F',
      description: 'Light Snow',
      windSpeed: '3 mph', // 4.47 km/h
      windDirection: 'S',
      humidity: 77.5,
      timestamp: '2026-01-15T14:54:00+00:00',
      stationName: 'Burlington International Airport',
      icon: 'https://api.weather.gov/icons/land/day/snow?size=medium',
    });
  });

  it('skips stations that error, lack temperature, or throw, and uses the next one', async () => {
    useGridHandlers();
    server.use(
      http.get(OBS, ({ params }) => {
        if (params.id === 'KBTV') return new HttpResponse(null, { status: 500 });
        if (params.id === 'KMPV') return HttpResponse.json(observation({ temperature: null }));
        return HttpResponse.json(
          observation({
            windSpeed: null,
            windDirection: { value: null, unitCode: 'x' },
            textDescription: null,
            relativeHumidity: null,
          }),
        );
      }),
    );
    const { getCurrentWeather } = await loadNoaa();

    const wx = await getCurrentWeather(44.4759, -73.2121);

    expect(wx.stationName).toBe('Morrisville-Stowe State Airport');
    expect(wx.description).toBe('Unknown');
    expect(wx.windSpeed).toBeNull();
    expect(wx.windDirection).toBeNull();
    expect(wx.humidity).toBeNull();
  });

  it('throws when no nearby station has a valid observation', async () => {
    useGridHandlers();
    server.use(http.get(OBS, () => HttpResponse.error()));
    const { getCurrentWeather } = await loadNoaa();

    await expect(getCurrentWeather(44.4759, -73.2121)).rejects.toThrow(
      'No valid observations available from nearby stations',
    );
  });

  it('throws when the station list is empty', async () => {
    server.use(
      http.get(POINTS, () => HttpResponse.json(loadJson('noaa/points.json'))),
      http.get(STATIONS, () => HttpResponse.json({ type: 'FeatureCollection', features: [] })),
    );
    const { getCurrentWeather } = await loadNoaa();

    await expect(getCurrentWeather(44.4759, -73.2121)).rejects.toThrow(
      'No observation stations found',
    );
  });

  it('throws when the stations endpoint is not OK', async () => {
    server.use(
      http.get(POINTS, () => HttpResponse.json(loadJson('noaa/points.json'))),
      http.get(STATIONS, () => new HttpResponse(null, { status: 503 })),
    );
    const { getCurrentWeather } = await loadNoaa();

    await expect(getCurrentWeather(44.4759, -73.2121)).rejects.toThrow(
      'Failed to get stations: 503',
    );
  });

  it('throws when the points lookup is not OK', async () => {
    server.use(http.get(POINTS, () => new HttpResponse(null, { status: 404 })));
    const { getCurrentWeather } = await loadNoaa();

    await expect(getCurrentWeather(0, 0)).rejects.toThrow('Failed to get grid point: 404');
  });

  it('sends the NOAA User-Agent and geo+json Accept headers', async () => {
    let ua: string | null = null;
    let accept: string | null = null;
    server.use(
      http.get(POINTS, ({ request }) => {
        ua = request.headers.get('user-agent');
        accept = request.headers.get('accept');
        return new HttpResponse(null, { status: 500 });
      }),
    );
    const { getCurrentWeather } = await loadNoaa();

    await expect(getCurrentWeather(44, -72)).rejects.toThrow();
    expect(ua).toMatch(/^VT-Liveview Weather App \(.+\)$/);
    expect(accept).toBe('application/geo+json');
  });
});

// ===========================================================================
// getForecast + grid point cache
// ===========================================================================

describe('getForecast', () => {
  it('maps forecast periods', async () => {
    useGridHandlers();
    server.use(http.get(FORECAST, () => HttpResponse.json(loadJson('noaa/forecast.json'))));
    const { getForecast } = await loadNoaa();

    const periods = await getForecast(44.4759, -73.2121);

    expect(periods).toHaveLength(2);
    expect(periods[0]).toEqual({
      name: 'Today',
      temperature: 25,
      temperatureUnit: 'F',
      shortForecast: 'Snow Likely',
      detailedForecast:
        'Snow likely. Cloudy, with a high near 25. New snow accumulation of 1 to 2 inches possible.',
      startTime: '2026-01-15T09:00:00-05:00',
      endTime: '2026-01-15T18:00:00-05:00',
      isDaytime: true,
      icon: 'https://api.weather.gov/icons/land/day/snow,60?size=medium',
      precipChance: 60,
      windSpeed: '5 to 10 mph',
      windDirection: 'S',
    });
    expect(periods[1]?.precipChance).toBe(20);
  });

  it('throws on a non-OK forecast response', async () => {
    useGridHandlers();
    server.use(http.get(FORECAST, () => new HttpResponse(null, { status: 500 })));
    const { getForecast } = await loadNoaa();

    await expect(getForecast(44.4759, -73.2121)).rejects.toThrow('Failed to get forecast: 500');
  });

  it('rejects on malformed JSON', async () => {
    useGridHandlers();
    server.use(
      http.get(
        FORECAST,
        () => new HttpResponse('{not json', { headers: { 'Content-Type': 'application/json' } }),
      ),
    );
    const { getForecast } = await loadNoaa();

    await expect(getForecast(44.4759, -73.2121)).rejects.toThrow();
  });

  it('caches grid points per rounded coordinate for 1 hour', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const { pointsCalls } = useGridHandlers();
    server.use(http.get(FORECAST, () => HttpResponse.json(loadJson('noaa/forecast.json'))));
    const { getForecast } = await loadNoaa();

    await getForecast(44.4759, -73.2121);
    await getForecast(44.47591, -73.21209); // same key at 4dp
    expect(pointsCalls()).toBe(1);

    await getForecast(44.5, -73.2); // different key
    expect(pointsCalls()).toBe(2);

    vi.advanceTimersByTime(3_600_001);
    await getForecast(44.4759, -73.2121);
    expect(pointsCalls()).toBe(3);
  });

  it('evicts the oldest grid point once 100 are cached', async () => {
    const { pointsCalls } = useGridHandlers();
    server.use(http.get(FORECAST, () => HttpResponse.json(loadJson('noaa/forecast.json'))));
    const { getForecast } = await loadNoaa();

    for (let i = 0; i < 101; i++) {
      await getForecast(44 + i / 1000, -72);
    }
    expect(pointsCalls()).toBe(101);

    await getForecast(44 + 100 / 1000, -72); // newest: still cached
    expect(pointsCalls()).toBe(101);
    await getForecast(44, -72); // oldest: evicted
    expect(pointsCalls()).toBe(102);
  });

  it('keeps a fresher grid point after concurrent misses (no orphaned TTL timer)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get(POINTS, async () => {
        calls++;
        if (calls === 2) await gate;
        return HttpResponse.json(loadJson('noaa/points.json'));
      }),
      http.get(FORECAST, () => HttpResponse.json(loadJson('noaa/forecast.json'))),
    );
    const { getForecast } = await loadNoaa();

    const first = getForecast(44.4759, -73.2121);
    const second = getForecast(44.4759, -73.2121);
    await first; // cached at t=0, timer for t=60min

    vi.advanceTimersByTime(30 * 60_000);
    release();
    await second; // re-cached at t=30min, timer for t=90min

    vi.advanceTimersByTime(45 * 60_000); // t=75min: the first timer must not evict
    await getForecast(44.4759, -73.2121);
    expect(calls).toBe(2);

    vi.advanceTimersByTime(16 * 60_000); // t=91min: expired
    await getForecast(44.4759, -73.2121);
    expect(calls).toBe(3);
  });
});

// ===========================================================================
// getAlerts
// ===========================================================================

describe('getAlerts', () => {
  it('maps active alerts including null and polygon geometry', async () => {
    server.use(http.get(ALERTS, () => HttpResponse.json(loadJson('noaa/alerts-vt.json'))));
    const { getAlerts } = await loadNoaa();

    const alerts = await getAlerts('VT');

    expect(alerts).toHaveLength(4);
    expect(alerts[0]).toMatchObject({
      id: 'urn:oid:2.49.0.1.840.0.aaa.001.1',
      event: 'Winter Weather Advisory',
      severity: 'Moderate',
      areaDesc: 'Western Chittenden; Grand Isle',
      geometry: null,
    });
    expect(alerts[2]?.geometry?.type).toBe('Polygon');
    expect(alerts[2]?.instruction).toBeNull();
  });

  it('returns an empty list when there are no active alerts', async () => {
    server.use(http.get(ALERTS, () => HttpResponse.json({ features: [] })));
    const { getAlerts } = await loadNoaa();

    expect(await getAlerts('VT')).toEqual([]);
  });

  it('throws on a non-OK response', async () => {
    server.use(http.get(ALERTS, () => new HttpResponse(null, { status: 502 })));
    const { getAlerts } = await loadNoaa();

    await expect(getAlerts('VT')).rejects.toThrow('Failed to get alerts: 502');
  });

  it('rejects on a network error', async () => {
    server.use(http.get(ALERTS, () => HttpResponse.error()));
    const { getAlerts } = await loadNoaa();

    await expect(getAlerts('VT')).rejects.toThrow();
  });

  it('normalises the state code before building the query', async () => {
    let area: string | null = null;
    server.use(
      http.get(ALERTS, ({ request }) => {
        area = new URL(request.url).searchParams.get('area');
        return HttpResponse.json({ features: [] });
      }),
    );
    const { getAlerts } = await loadNoaa();

    await getAlerts(' vt ');
    expect(area).toBe('VT');
  });

  it.each(['VT&limit=500', 'Vermont', '', 'V1', 'VT#'])(
    'rejects invalid state %j without calling upstream',
    async (state) => {
      const { getAlerts, getMergedAlerts } = await loadNoaa();
      // No handler registered: any request would fail with onUnhandledRequest=error.
      await expect(getAlerts(state)).rejects.toThrow('Invalid state code');
      await expect(getMergedAlerts(state)).rejects.toThrow('Invalid state code');
    },
  );
});

// ===========================================================================
// getMergedAlerts
// ===========================================================================

function useZoneHandlers(): { zoneCalls: string[] } {
  const zoneCalls: string[] = [];
  server.use(
    http.get(ZONE, ({ params }) => {
      const id = String(params.zoneId);
      zoneCalls.push(id);
      if (id === 'VTZ005' || id === 'VTZ006') {
        return HttpResponse.json(loadJson(`noaa/zone-${id}.json`));
      }
      return new HttpResponse(null, { status: 404 });
    }),
  );
  return { zoneCalls };
}

describe('getMergedAlerts', () => {
  it('groups by event, keeps VT zones only, and builds MultiPolygon geometry', async () => {
    server.use(http.get(ALERTS, () => HttpResponse.json(loadJson('noaa/alerts-vt.json'))));
    const { zoneCalls } = useZoneHandlers();
    const { getMergedAlerts } = await loadNoaa();

    const merged = await getMergedAlerts('VT');

    // NY-only Lake Effect Snow Warning is dropped
    expect(merged.map((m) => m.event)).toEqual([
      'Winter Weather Advisory',
      'Special Weather Statement',
    ]);
    // Only alerts without geometry trigger zone fetches; NY zones are never fetched
    expect([...zoneCalls].sort()).toEqual(['VTZ001', 'VTZ005', 'VTZ006']);

    const wwa = merged[0]!;
    expect(wwa.mergedFrom).toEqual([
      'urn:oid:2.49.0.1.840.0.aaa.001.1',
      'urn:oid:2.49.0.1.840.0.aaa.002.1',
    ]);
    expect(wwa.affectedZoneIds).toEqual(['VTZ005', 'VTZ001', 'VTZ006']);
    // Primary = most severe (Severe beats Moderate)
    expect(wwa.severity).toBe('Severe');
    expect(wwa.headline).toContain('10:00AM');
    // Earliest effective and latest expires across the group
    expect(wwa.effective).toBe('2026-01-15T08:00:00-05:00');
    expect(wwa.expires).toBe('2026-01-16T12:00:00-05:00');
    // VTZ001 404s; geometry = VTZ005 polygon + 2 parts of VTZ006 multipolygon
    expect(wwa.areaDesc).toBe('Western Chittenden; Lamoille');
    expect(wwa.geometry.type).toBe('MultiPolygon');
    expect(wwa.geometry.coordinates).toHaveLength(3);

    const sws = merged[1]!;
    expect(sws.geometry.coordinates).toHaveLength(1); // uses the alert's own polygon
    expect(sws.affectedZoneIds).toEqual(['VTZ005']);
  });

  it('merges MultiPolygon alert geometry and falls back to areaDesc without zone names', async () => {
    const data = loadJson<NOAAAlertsResponse>('noaa/alerts-vt.json');
    const sws = data.features[2]!;
    sws.properties.affectedZones = ['https://api.weather.gov/zones/forecast/VTZ009'];
    sws.geometry = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [-73, 44],
            [-72.9, 44],
            [-73, 44.1],
            [-73, 44],
          ],
        ],
        [
          [
            [-72, 43],
            [-71.9, 43],
            [-72, 43.1],
            [-72, 43],
          ],
        ],
      ],
    };
    server.use(http.get(ALERTS, () => HttpResponse.json({ features: [sws] })));
    const { getMergedAlerts } = await loadNoaa();

    const [merged] = await getMergedAlerts('VT');

    expect(merged?.geometry.coordinates).toHaveLength(2);
    expect(merged?.areaDesc).toBe('Chittenden, VT');
  });

  it('skips an event when neither alert geometry nor zone boundaries are available', async () => {
    const data = loadJson<NOAAAlertsResponse>('noaa/alerts-vt.json');
    const first = data.features[0]!;
    first.properties.affectedZones = ['https://api.weather.gov/zones/forecast/VTZ001'];
    server.use(http.get(ALERTS, () => HttpResponse.json({ features: [first] })));
    useZoneHandlers();
    const { getMergedAlerts } = await loadNoaa();

    expect(await getMergedAlerts('VT')).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('No geometry or zone boundaries found for event'),
    );
  });

  it('returns [] when there are no active alerts', async () => {
    server.use(http.get(ALERTS, () => HttpResponse.json({ features: [] })));
    const { getMergedAlerts } = await loadNoaa();

    expect(await getMergedAlerts('VT')).toEqual([]);
  });

  it('wraps upstream HTTP errors', async () => {
    server.use(http.get(ALERTS, () => new HttpResponse(null, { status: 500 })));
    const { getMergedAlerts } = await loadNoaa();

    await expect(getMergedAlerts('VT')).rejects.toThrow(
      'Failed to get merged alerts for VT: HTTP 500',
    );
  });

  it('wraps network errors', async () => {
    server.use(http.get(ALERTS, () => HttpResponse.error()));
    const { getMergedAlerts } = await loadNoaa();

    await expect(getMergedAlerts('VT')).rejects.toThrow('Failed to get merged alerts for VT');
  });

  // Regression: FINDINGS H1 — id used to embed Date.now(), so every poll produced a new id.
  it('produces a stable id across polls for the same source alerts (FINDINGS H1)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    server.use(http.get(ALERTS, () => HttpResponse.json(loadJson('noaa/alerts-vt.json'))));
    useZoneHandlers();
    const { getMergedAlerts } = await loadNoaa();

    vi.setSystemTime(new Date('2026-01-15T15:00:00Z'));
    const a = await getMergedAlerts('VT');
    vi.setSystemTime(new Date('2026-01-15T15:02:00Z'));
    const b = await getMergedAlerts('VT');

    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
    expect(a[0]?.id).toMatch(/^merged-winter-weather-advisory-[0-9a-f]{16}$/);
  });

  it('derives the id from the set of source alert ids, independent of order (FINDINGS H1)', async () => {
    const data = loadJson<NOAAAlertsResponse>('noaa/alerts-vt.json');
    const [a1, a2] = data.features;
    let features = [a1, a2];
    server.use(http.get(ALERTS, () => HttpResponse.json({ features })));
    useZoneHandlers();
    const { getMergedAlerts } = await loadNoaa();

    const forward = await getMergedAlerts('VT');
    features = [a2, a1];
    const reversed = await getMergedAlerts('VT');
    features = [a1];
    const subset = await getMergedAlerts('VT');

    expect(forward[0]?.id).toBe(reversed[0]?.id);
    expect(subset[0]?.id).not.toBe(forward[0]?.id);
  });
});

// ===========================================================================
// getObservationStations
// ===========================================================================

function useStationsHappyPath(): { obsCalls: () => number; usgsCalls: () => number } {
  let obs = 0;
  let usgs = 0;
  useGridHandlers();
  server.use(
    http.get(OBS, ({ params }) => {
      obs++;
      if (params.id === 'KBTV') return HttpResponse.json(observation());
      if (params.id === 'KMPV') return HttpResponse.json(observation({ temperature: null }));
      return new HttpResponse(null, { status: 500 });
    }),
    http.get(USGS, () => {
      usgs++;
      return HttpResponse.json(loadJson('usgs/lake-champlain-iv.json'));
    }),
  );
  return { obsCalls: () => obs, usgsCalls: () => usgs };
}

function useTotalOutage(): void {
  server.use(
    http.get(POINTS, () => new HttpResponse(null, { status: 500 })),
    http.get(STATIONS, () => new HttpResponse(null, { status: 500 })),
    http.get(OBS, () => HttpResponse.error()),
    http.get(USGS, () => new HttpResponse(null, { status: 500 })),
  );
}

describe('getObservationStations', () => {
  it('dedupes stations across grid points and adds the Lake Champlain sensor', async () => {
    const { obsCalls } = useStationsHappyPath();
    const { getObservationStations } = await loadNoaa();

    const stations = await getObservationStations();

    // 6 grid points x 3 stations -> 3 unique observation fetches
    expect(obsCalls()).toBe(3);
    expect(stations.map((s) => s.id)).toEqual(['KBTV', 'USGS-04294500']);

    expect(stations[0]).toEqual({
      id: 'KBTV',
      name: 'Burlington International Airport',
      location: { lat: 44.47, lng: -73.15 },
      elevation: 331,
      weather: {
        temperature: 23,
        temperatureUnit: 'F',
        description: 'Light Snow',
        windSpeed: '3 mph',
        windDirection: 'S',
        humidity: 77.5,
        dewpoint: 17,
        pressure: 1016,
        timestamp: '2026-01-15T14:54:00+00:00',
      },
    });
    expect(stations[1]).toMatchObject({
      name: 'LAKE CHAMPLAIN AT BURLINGTON, VT (Water Temp)',
      location: { lat: 44.47588889, lng: -73.2214444 },
      weather: { temperature: 39, timestamp: '2026-01-15T09:15:00.000-05:00' },
    });
  });

  it('maps missing optional observation fields to null', async () => {
    useGridHandlers();
    server.use(
      http.get(OBS, () =>
        HttpResponse.json(
          observation({
            dewpoint: null,
            barometricPressure: { value: null, unitCode: 'wmoUnit:Pa' },
            windDirection: null,
            textDescription: null,
          }),
        ),
      ),
      http.get(USGS, () => HttpResponse.error()),
    );
    const { getObservationStations } = await loadNoaa();

    const stations = await getObservationStations();
    const kmvl = stations.find((s) => s.id === 'KMVL');

    expect(stations).toHaveLength(3);
    expect(kmvl?.elevation).toBeNull();
    expect(kmvl?.weather).toMatchObject({
      dewpoint: null,
      pressure: null,
      windDirection: null,
      description: 'Unknown',
    });
  });

  it('serves from cache for 15 minutes, then refetches', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const { obsCalls, usgsCalls } = useStationsHappyPath();
    const { getObservationStations } = await loadNoaa();

    const first = await getObservationStations();
    const second = await getObservationStations();
    expect(second).toBe(first);
    expect(obsCalls()).toBe(3);
    expect(usgsCalls()).toBe(1);

    vi.advanceTimersByTime(15 * 60_000 + 1);
    await getObservationStations();
    expect(obsCalls()).toBe(6);
    expect(usgsCalls()).toBe(2);
  });

  it('clearStationsCache forces a refetch', async () => {
    const { usgsCalls } = useStationsHappyPath();
    const { getObservationStations, clearStationsCache } = await loadNoaa();

    await getObservationStations();
    clearStationsCache();
    await getObservationStations();
    expect(usgsCalls()).toBe(2);
  });

  // Regression: FINDINGS Medium "noaa.ts getObservationStations caches an empty array
  // for 15 minutes after a total upstream failure, overwriting good data".
  it('does not cache an empty result after a total upstream failure', async () => {
    useTotalOutage();
    const { getObservationStations } = await loadNoaa();

    expect(await getObservationStations()).toEqual([]);

    // Upstream recovers: the next call must refetch rather than serve a cached []
    useStationsHappyPath();
    expect(await getObservationStations()).toHaveLength(2);
  });

  it('keeps serving the last good data when a refresh fails completely', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    useStationsHappyPath();
    const { getObservationStations } = await loadNoaa();
    const good = await getObservationStations();

    vi.advanceTimersByTime(15 * 60_000 + 1);
    useTotalOutage();
    expect(await getObservationStations()).toBe(good);
  });

  describe('Lake Champlain sensor edge cases', () => {
    type Usgs = {
      value: {
        timeSeries: Array<{
          sourceInfo: { geoLocation: { geogLocation: { latitude: unknown } } };
          values: Array<{ value: Array<{ value: string; dateTime: string }> }>;
        }>;
      };
    };
    const mutate: Record<string, (d: Usgs) => unknown> = {
      'no time series': (d) => ({ value: { ...d.value, timeSeries: [] } }),
      'invalid coordinates': (d) => {
        d.value.timeSeries[0]!.sourceInfo.geoLocation.geogLocation.latitude = 'abc';
        return d;
      },
      'no values': (d) => {
        d.value.timeSeries[0]!.values = [{ value: [] }];
        return d;
      },
      'non-numeric value': (d) => {
        d.value.timeSeries[0]!.values[0]!.value = [{ value: 'Ice', dateTime: '2026-01-15' }];
        return d;
      },
      'invalid timestamp': (d) => {
        d.value.timeSeries[0]!.values[0]!.value = [{ value: '4.0', dateTime: 'not-a-date' }];
        return d;
      },
    };

    it.each(Object.keys(mutate))('omits the sensor when USGS returns %s', async (name) => {
      useGridHandlers();
      server.use(
        http.get(OBS, ({ params }) =>
          params.id === 'KBTV'
            ? HttpResponse.json(observation())
            : new HttpResponse(null, { status: 404 }),
        ),
        http.get(USGS, () =>
          HttpResponse.json(mutate[name]!(loadJson<Usgs>('usgs/lake-champlain-iv.json')) as object),
        ),
      );
      const { getObservationStations } = await loadNoaa();

      const stations = await getObservationStations();
      expect(stations.map((s) => s.id)).toEqual(['KBTV']);
    });

    it('omits the sensor when USGS is unreachable', async () => {
      useGridHandlers();
      server.use(
        http.get(OBS, () => HttpResponse.json(observation())),
        http.get(USGS, () => HttpResponse.error()),
      );
      const { getObservationStations } = await loadNoaa();

      const stations = await getObservationStations();
      expect(stations.some((s) => s.id.startsWith('USGS'))).toBe(false);
    });
  });

  it('tolerates a grid point whose stations request fails', async () => {
    server.use(
      http.get(POINTS, () => HttpResponse.json(loadJson('noaa/points.json'))),
      http.get(STATIONS, () => new HttpResponse(null, { status: 500 })),
      http.get(USGS, () => HttpResponse.json(loadJson('usgs/lake-champlain-iv.json'))),
    );
    const { getObservationStations } = await loadNoaa();

    const stations = await getObservationStations();
    expect(stations.map((s) => s.id)).toEqual(['USGS-04294500']);
  });

  it.todo(
    'does not fall back to "now" when an observation has no timestamp (FINDINGS Low, noaa.ts:837)',
  );
  it.todo(
    'exposes Lake Champlain water temperature separately from air temperature (FINDINGS Low, noaa.ts:692-711)',
  );
  it.todo('aborts hung upstream requests with a timeout (FINDINGS H5)');
});
