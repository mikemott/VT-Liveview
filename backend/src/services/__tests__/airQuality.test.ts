import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/msw.js';
import { loadJson } from '../../__fixtures__/load.js';
import {
  categoryForAqi,
  createAirQualityService,
  nearestMonitor,
  parseForecast,
  parseMonitors,
} from '../airQuality.js';

const monitorsJson = loadJson<unknown[]>('airnow/monitors.json');
const forecastJson = loadJson<unknown[]>('airnow/forecast.json');
const NOW = Date.parse('2026-10-26T14:40:00Z');

describe('parseMonitors', () => {
  const monitors = parseMonitors(monitorsJson);

  it('groups readings by site and keeps the newest reading per pollutant', () => {
    expect(monitors.map((m) => m.name)).toEqual([
      'Bennington Airport Rd',
      'Rutland State St',
      'Underhill',
      'Whiteface Base',
    ]);
    const underhill = monitors.find((m) => m.name === 'Underhill')!;
    expect(underhill.readings).toEqual([
      { pollutant: 'OZONE', aqi: 35, category: 1 },
      { pollutant: 'PM2.5', aqi: 28, category: 1 }, // 14:00, not the 13:00 reading
    ]);
    expect(underhill).toMatchObject({
      id: '500070007',
      aqi: 35,
      category: 1,
      pollutant: 'OZONE',
      observedAt: '2026-10-26T14:00:00Z',
    });
  });

  it('drops missing (-999) readings', () => {
    const rutland = monitors.find((m) => m.name === 'Rutland State St')!;
    expect(rutland.readings).toEqual([{ pollutant: 'PM2.5', aqi: 59, category: 2 }]);
  });

  it('tolerates junk', () => {
    expect(parseMonitors({ WebServiceError: [] })).toEqual([]);
    expect(parseMonitors([{ Parameter: 'PM2.5' }, null])).toEqual([]);
  });
});

describe('parseForecast', () => {
  it('keeps the worst pollutant per day, including category-only (-1) forecasts', () => {
    expect(parseForecast(forecastJson)).toEqual([
      {
        date: '2026-10-26',
        aqi: 38,
        category: 1,
        pollutant: 'OZONE',
        reportingArea: 'Northern Vermont',
        actionDay: false,
      },
      {
        date: '2026-10-27',
        aqi: null,
        category: 2,
        pollutant: 'PM2.5',
        reportingArea: 'Northern Vermont',
        actionDay: false,
      },
      // 2026-10-28 had no category and no AQI: not issued, left out
    ]);
  });
});

describe('categoryForAqi', () => {
  it('follows the EPA breakpoints', () => {
    expect([0, 50, 51, 100, 101, 150, 151, 200, 201, 300, 301, 600].map(categoryForAqi)).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6,
    ]);
  });
});

describe('nearestMonitor', () => {
  const monitors = parseMonitors(monitorsJson);
  it('picks the closest monitor and says how far', () => {
    // Burlington: Underhill is ~15 mi away, Whiteface (NY) ~45
    const near = nearestMonitor(monitors, 44.476, -73.212)!;
    expect(near.name).toBe('Underhill');
    expect(near.distanceMi).toBeGreaterThan(12);
    expect(near.distanceMi).toBeLessThan(20);
  });
  it('gives up beyond 60 miles', () => {
    expect(nearestMonitor(monitors, 47.4, -68.6)).toBeNull();
  });
});

describe('createAirQualityService', () => {
  it('asks AirNow for the Vermont box and the last three hours, with the key', async () => {
    let url: URL | null = null;
    server.use(
      http.get('https://www.airnowapi.org/aq/data/', ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json(monitorsJson);
      }),
    );
    const svc = createAirQualityService('KEY', () => NOW);
    expect(await svc.getMonitors()).toHaveLength(4);
    const q = url!.searchParams;
    expect(q.get('BBOX')).toBe('-73.9,42.4,-71.0,45.4');
    expect(q.get('startDate')).toBe('2026-10-26T11');
    expect(q.get('endDate')).toBe('2026-10-26T14');
    expect(q.get('parameters')).toBe('OZONE,PM25');
    expect(q.get('API_KEY')).toBe('KEY');
    expect(q.get('format')).toBe('application/json');
  });

  it('caches forecasts per ~0.1° cell', async () => {
    let calls = 0;
    server.use(
      http.get('https://www.airnowapi.org/aq/forecast/current/', ({ request }) => {
        calls++;
        const q = new URL(request.url).searchParams;
        expect(q.get('latitude')).toBe('44.3');
        expect(q.get('longitude')).toBe('-72.6');
        return HttpResponse.json(forecastJson);
      }),
    );
    const svc = createAirQualityService('KEY', () => NOW);
    await svc.getForecast(44.26, -72.58);
    await svc.getForecast(44.29, -72.61); // same cell
    expect(calls).toBe(1);
  });

  it('returns what it can when one source fails', async () => {
    server.use(
      http.get('https://www.airnowapi.org/aq/data/', () => HttpResponse.json(monitorsJson)),
      http.get('https://www.airnowapi.org/aq/forecast/current/', () =>
        HttpResponse.json({ error: 'Invalid API key' }),
      ),
    );
    const svc = createAirQualityService('KEY', () => NOW);
    const point = await svc.getPoint(44.476, -73.212);
    expect(point.current?.name).toBe('Underhill');
    expect(point.forecast).toEqual([]);
  });

  it('refuses without a key', async () => {
    const svc = createAirQualityService(undefined);
    expect(svc.configured).toBe(false);
    await expect(svc.getMonitors()).rejects.toThrow('AIRNOW_API_KEY is not set');
  });
});
