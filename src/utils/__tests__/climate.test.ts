import { describe, expect, it } from 'vitest';
import { compareWithNormal, describeDiff } from '../climate';
import type { ClimateDay } from '../../services/climateApi';
import type { ForecastPeriodData } from '../../services/graphqlClient';

const CLIMATE: ClimateDay = {
  date: '2026-10-28',
  station: { name: 'Burlington', distanceMi: 3 },
  normalHighF: 54,
  normalLowF: 38,
  recordHigh: { tempF: 75, year: 1947 },
  recordLow: { tempF: 19, year: 1974 },
};

const period = (over: Partial<ForecastPeriodData>): ForecastPeriodData => ({
  name: 'This Afternoon',
  temperature: 48,
  temperatureUnit: 'F',
  shortForecast: 'Cloudy',
  detailedForecast: '',
  startTime: '2026-10-28T14:00:00-04:00',
  endTime: '2026-10-28T18:00:00-04:00',
  isDaytime: true,
  icon: '',
  windSpeed: '',
  windDirection: '',
  ...over,
});

describe('today vs normal (VTL-81)', () => {
  it('describes the difference', () => {
    expect(describeDiff(6)).toBe('6° above normal');
    expect(describeDiff(-6)).toBe('6° below normal');
    expect(describeDiff(2)).toBe('near normal');
    expect(describeDiff(-1)).toBe('near normal');
  });

  it('compares a daytime period with the normal high, tonight with the normal low', () => {
    expect(compareWithNormal(period({}), CLIMATE)).toEqual({
      kind: 'high',
      forecastF: 48,
      normalF: 54,
      diffF: -6,
      text: '6° below normal',
    });
    expect(
      compareWithNormal(
        period({
          name: 'Tonight',
          isDaytime: false,
          temperature: 44,
          startTime: '2026-10-28T18:00:00-04:00',
        }),
        CLIMATE,
      ),
    ).toMatchObject({ kind: 'low', diffF: 6, text: '6° above normal' });
  });

  it('only compares a period that starts on the normals’ day, in °F', () => {
    expect(
      compareWithNormal(period({ startTime: '2026-10-29T06:00:00-04:00' }), CLIMATE),
    ).toBeNull();
    expect(compareWithNormal(period({ temperatureUnit: 'C' }), CLIMATE)).toBeNull();
    expect(compareWithNormal(period({}), { ...CLIMATE, normalHighF: null })).toBeNull();
    expect(compareWithNormal(undefined, CLIMATE)).toBeNull();
    expect(compareWithNormal(period({}), undefined)).toBeNull();
  });
});
