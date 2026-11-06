import { describe, expect, it } from 'vitest';
import { hourLabel, hoursInPeriod } from '../hourlyForecast';
import type { HourlyPeriodData } from '../../services/graphqlClient';

const hour = (startTime: string): HourlyPeriodData => ({
  startTime,
  endTime: startTime,
  isDaytime: true,
  temperature: 40,
  shortForecast: 'Sunny',
  icon: null,
  precipChance: null,
});

describe('hourly forecast', () => {
  it('keeps the hours that start inside the period, whatever the offset', () => {
    const hours = [
      '2026-01-15T05:00:00-05:00',
      '2026-01-15T06:00:00-05:00',
      '2026-01-15T22:59:00Z',
      '2026-01-15T18:00:00-05:00',
    ].map(hour);
    const today = { startTime: '2026-01-15T06:00:00-05:00', endTime: '2026-01-15T18:00:00-05:00' };
    expect(hoursInPeriod(hours, today).map((h) => h.startTime)).toEqual([
      '2026-01-15T06:00:00-05:00',
      '2026-01-15T22:59:00Z',
    ]);
  });

  it('labels hours in Vermont time', () => {
    expect(hourLabel('2026-01-15T14:00:00Z')).toBe('9 AM');
    expect(hourLabel('2026-07-04T04:00:00Z')).toBe('12 AM');
  });
});
