/**
 * Tests for the GraphQL client fetch helpers and their error handling.
 */
import { describe, it, expect } from 'vitest';
import { graphql, http, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import forecastRaw from '@/__fixtures__/graphql/forecast.json?raw';
import mergedAlertsRaw from '@/__fixtures__/graphql/mergedAlerts.json?raw';
import {
  fetchCurrentWeather,
  fetchForecast,
  fetchAlerts,
  fetchMergedAlerts,
  fetchRadarInfo,
  graphqlClient,
} from '../graphqlClient';

const forecastFixture = JSON.parse(forecastRaw) as { data: Record<string, unknown> };
const mergedAlertsFixture = JSON.parse(mergedAlertsRaw) as { data: Record<string, unknown> };

const currentWeather = {
  temperature: 41,
  temperatureUnit: 'F',
  description: 'Light Rain',
  windSpeed: '8 mph',
  windDirection: 'SW',
  humidity: 88,
  timestamp: '2026-10-16T12:00:00Z',
  stationName: 'Montpelier, Edward F Knapp State Airport',
  icon: 'https://api.weather.gov/icons/land/day/rain?size=medium',
};

describe('graphqlClient', () => {
  it('is exported as a GraphQLClient instance', () => {
    expect(typeof graphqlClient.request).toBe('function');
  });
});

describe('fetchCurrentWeather', () => {
  it('sends lat/lon variables and unwraps currentWeather', async () => {
    let variables: Record<string, unknown> | undefined;
    server.use(
      graphql.query('CurrentWeather', ({ variables: v }) => {
        variables = v;
        return HttpResponse.json({ data: { currentWeather } });
      }),
    );
    await expect(fetchCurrentWeather(44.26, -72.58)).resolves.toEqual(currentWeather);
    expect(variables).toEqual({ lat: 44.26, lon: -72.58 });
  });

  it('returns null when the backend has no observation', async () => {
    server.use(
      graphql.query('CurrentWeather', () => HttpResponse.json({ data: { currentWeather: null } })),
    );
    await expect(fetchCurrentWeather(44, -72)).resolves.toBeNull();
  });

  it('rejects with the GraphQL error message', async () => {
    server.use(
      graphql.query('CurrentWeather', () =>
        HttpResponse.json({ errors: [{ message: 'NOAA unavailable' }] }),
      ),
    );
    await expect(fetchCurrentWeather(44, -72)).rejects.toThrow('NOAA unavailable');
  });

  it('rejects on an HTTP 500', async () => {
    server.use(
      http.post('http://localhost:4000/graphql', () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    );
    await expect(fetchCurrentWeather(44, -72)).rejects.toThrow();
  });

  it('rejects on a network failure', async () => {
    server.use(http.post('http://localhost:4000/graphql', () => HttpResponse.error()));
    await expect(fetchCurrentWeather(44, -72)).rejects.toThrow();
  });
});

describe('fetchForecast', () => {
  it('unwraps the forecast array', async () => {
    let variables: Record<string, unknown> | undefined;
    server.use(
      graphql.query('Forecast', ({ variables: v }) => {
        variables = v;
        return HttpResponse.json(forecastFixture);
      }),
    );
    const periods = await fetchForecast(44.5, -72.6);
    expect(periods).toHaveLength(2);
    expect(periods[0]?.name).toBe('Tonight');
    expect(variables).toEqual({ lat: 44.5, lon: -72.6 });
  });
});

describe('fetchAlerts', () => {
  it("defaults the state to 'VT'", async () => {
    let state: unknown;
    server.use(
      graphql.query('Alerts', ({ variables }) => {
        state = variables.state;
        return HttpResponse.json({ data: { alerts: [] } });
      }),
    );
    await expect(fetchAlerts()).resolves.toEqual([]);
    expect(state).toBe('VT');
  });

  it('passes an explicit state through', async () => {
    let state: unknown;
    server.use(
      graphql.query('Alerts', ({ variables }) => {
        state = variables.state;
        return HttpResponse.json({ data: { alerts: [] } });
      }),
    );
    await fetchAlerts('NH');
    expect(state).toBe('NH');
  });
});

describe('fetchMergedAlerts', () => {
  it('unwraps merged alerts with MultiPolygon geometry', async () => {
    server.use(graphql.query('MergedAlerts', () => HttpResponse.json(mergedAlertsFixture)));
    const alerts = await fetchMergedAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.geometry.type).toBe('MultiPolygon');
    expect(alerts[0]?.affectedZoneIds).toEqual(['VTZ006', 'VTZ007']);
  });
});

describe('fetchRadarInfo', () => {
  it('unwraps radarInfo', async () => {
    const radarInfo = {
      baseUrl: 'https://mesonet.agron.iastate.edu',
      timestamps: [{ time: '2026-10-16T12:00:00Z', path: '/radar/1' }],
      tilePattern: '{z}/{x}/{y}.png',
    };
    server.use(graphql.query('RadarInfo', () => HttpResponse.json({ data: { radarInfo } })));
    await expect(fetchRadarInfo()).resolves.toEqual(radarInfo);
  });
});
