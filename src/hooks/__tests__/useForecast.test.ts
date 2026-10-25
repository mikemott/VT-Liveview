/**
 * Tests for the forecast and historical-data React Query hooks.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { graphql, HttpResponse } from 'msw';
import { server } from '@/test/msw';
import { createQueryWrapper } from '@/test/helpers/queryWrapper';
import forecastRaw from '@/__fixtures__/graphql/forecast.json?raw';
import { useForecast } from '../useForecast';
import { useHistoricalData } from '../useHistoricalData';

const forecastFixture = JSON.parse(forecastRaw) as { data: Record<string, unknown> };

describe('useForecast', () => {
  it('does not fetch while disabled', async () => {
    let calls = 0;
    server.use(
      graphql.query('Forecast', () => {
        calls++;
        return HttpResponse.json(forecastFixture);
      }),
    );
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useForecast({ lat: 44, lng: -72, enabled: false }), {
      wrapper,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toBe(0);
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('maps lng to the lon variable and returns the forecast', async () => {
    let variables: Record<string, unknown> | undefined;
    server.use(
      graphql.query('Forecast', ({ variables: v }) => {
        variables = v;
        return HttpResponse.json(forecastFixture);
      }),
    );
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useForecast({ lat: 44.26012, lng: -72.57541, enabled: true }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(variables).toEqual({ lat: 44.26012, lon: -72.57541 });
    expect(result.current.data?.forecast).toHaveLength(2);
    expect(result.current.data?.forecast[1]?.precipChance).toBe(40);
  });

  it('keys the cache on coordinates rounded to 3 decimals', async () => {
    server.use(graphql.query('Forecast', () => HttpResponse.json(forecastFixture)));
    const { wrapper, client } = createQueryWrapper();
    const { result } = renderHook(
      () => useForecast({ lat: 44.26012, lng: -72.57541, enabled: true }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData(['forecast', '44.260', '-72.575'])).toBeDefined();
  });

  it('surfaces GraphQL errors', async () => {
    server.use(
      graphql.query('Forecast', () => HttpResponse.json({ errors: [{ message: 'grid miss' }] })),
    );
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useForecast({ lat: 44, lng: -72, enabled: true }), {
      wrapper,
    });
    // The hook sets retry: 1, overriding the wrapper default; allow for the retry delay.
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });
    expect(result.current.error?.message).toContain('grid miss');
  });
});

describe('useHistoricalData', () => {
  const historical = {
    historicalData: {
      weather: [{ date: '2026-10-15', tempMin: 30, tempMax: 52, precipitation: 0, snowfall: 0 }],
      stationName: 'MONTPELIER AP',
      stationDistance: 4.2,
    },
  };

  it('does not fetch while disabled', async () => {
    let calls = 0;
    server.use(
      graphql.query('HistoricalData', () => {
        calls++;
        return HttpResponse.json({ data: historical });
      }),
    );
    const { wrapper } = createQueryWrapper();
    renderHook(() => useHistoricalData({ lat: 44, lng: -72, enabled: false }), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(calls).toBe(0);
  });

  it('sends lat/lng and returns the data', async () => {
    let variables: Record<string, unknown> | undefined;
    server.use(
      graphql.query('HistoricalData', ({ variables: v }) => {
        variables = v;
        return HttpResponse.json({ data: historical });
      }),
    );
    const { wrapper, client } = createQueryWrapper();
    const { result } = renderHook(
      () => useHistoricalData({ lat: 44.1234, lng: -72.9876, enabled: true }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(variables).toEqual({ lat: 44.1234, lng: -72.9876 });
    expect(result.current.data).toEqual(historical);
    expect(client.getQueryData(['historical-data', '44.123', '-72.988'])).toEqual(historical);
  });
});
