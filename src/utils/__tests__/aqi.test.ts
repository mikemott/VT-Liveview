import { describe, expect, it } from 'vitest';
import { dayLabel, isAirReadingStale, upcomingAirDays } from '../aqi';
import { isInVermont } from '../vermont';
import type { AirQualityForecastDay } from '../../services/airQualityApi';

// 10 AM in Vermont on Monday, Oct 26 2026
const NOW = new Date('2026-10-26T14:00:00Z');
const day = (date: string): AirQualityForecastDay => ({
  date,
  aqi: 30,
  category: 1,
  pollutant: 'OZONE',
  reportingArea: 'Burlington',
  actionDay: false,
});

describe('air quality helpers (VTL-76)', () => {
  it('labels forecast days in Vermont time', () => {
    expect(dayLabel('2026-10-26', NOW)).toBe('Today');
    expect(dayLabel('2026-10-27', NOW)).toBe('Tomorrow');
    expect(dayLabel('2026-10-28', NOW)).toBe('Wednesday');
    // 11:30 PM Monday in Vermont is already Tuesday in UTC
    expect(dayLabel('2026-10-26', new Date('2026-10-27T03:30:00Z'))).toBe('Today');
  });

  it('keeps forecast days from today on, at most three', () => {
    const days = ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'].map(day);
    expect(upcomingAirDays(days, NOW).map((d) => d.date)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
    ]);
  });

  it('treats a reading as current for 2.5 hours after its hour starts', () => {
    expect(isAirReadingStale('2026-10-26T12:00:00Z', NOW)).toBe(false);
    expect(isAirReadingStale('2026-10-26T11:00:00Z', NOW)).toBe(true);
    expect(isAirReadingStale('not a date', NOW)).toBe(false);
  });

  it('knows which monitors are inside Vermont', () => {
    expect(isInVermont(43.6085, -72.9822)).toBe(true); // Rutland
    expect(isInVermont(44.474, -73.189)).toBe(true); // Burlington UVM
    expect(isInVermont(43.6295, -72.3093)).toBe(false); // Lebanon, NH
    expect(isInVermont(45.041, -72.858)).toBe(false); // Frelighsburg, QC
    expect(isInVermont(42.702, -73.11)).toBe(false); // North Adams, MA
  });
});
