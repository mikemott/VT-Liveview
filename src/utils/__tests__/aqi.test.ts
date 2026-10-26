import { describe, expect, it } from 'vitest';
import { AQI_CATEGORIES, dayLabel, isAirReadingStale, upcomingAirDays } from '../aqi';
import { relativeLuminance } from '../../config/layers';
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

/** Mix two #rrggbb colors like CSS color-mix(in srgb, a p, b) */
function mix(a: string, b: string, p: number): string {
  const ch = (hex: string, i: number): number => parseInt(hex.slice(i, i + 2), 16);
  return `#${[1, 3, 5]
    .map((i) =>
      Math.round(p * ch(a, i) + (1 - p) * ch(b, i))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}
const contrast = (x: string, y: string): number => {
  const [hi, lo] = [relativeLuminance(x), relativeLuminance(y)].sort((m, n) => n - m) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
};

describe('AQI tones', () => {
  // The lightest and darkest surfaces a badge sits on (panel cream, dark panel)
  const LIGHT = '#fafcf3';
  const DARK = '#1b1f24';

  it('keeps badge text readable on its tint in both themes (4.5:1)', () => {
    const low: string[] = [];
    for (const [n, c] of Object.entries(AQI_CATEGORIES)) {
      const light = contrast(c.ink, mix(c.color, LIGHT, 0.12));
      const dark = contrast(c.inkDark, mix(c.color, DARK, 0.22));
      if (light < 4.5) low.push(`${n} light ${light.toFixed(2)}`);
      if (dark < 4.5) low.push(`${n} dark ${dark.toFixed(2)}`);
    }
    expect(low).toEqual([]);
  });
});
