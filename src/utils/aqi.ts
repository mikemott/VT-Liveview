/**
 * EPA Air Quality Index categories (VTL-75): names, theme colors and short
 * guidance.
 * https://www.airnow.gov/aqi/aqi-basics/
 */
import type { AirQualityForecastDay, Pollutant } from '../services/airQualityApi';

export interface AqiCategory {
  name: string;
  /**
   * Tint, outline and map-marker color. Muted to match the app's other status
   * colors (ski and beach markers, status banners) rather than the EPA's
   * highlighter shades; the order (green, yellow, orange, red, purple, maroon)
   * is the EPA's, so it still reads as the familiar scale.
   */
  color: string;
  /** Text on the light tint (>= 4.5:1; aqi.test.ts checks) */
  ink: string;
  /** Text on the dark tint */
  inkDark: string;
  /** One-line guidance */
  advice: string;
}

export const AQI_CATEGORIES: Record<number, AqiCategory> = {
  1: {
    name: 'Good',
    color: '#16a34a', // ski "green"
    ink: '#166534',
    inkDark: '#86efac',
    advice: 'Air quality is good.',
  },
  2: {
    name: 'Moderate',
    color: '#a16207', // ski / beach "yellow"
    ink: '#854d0e',
    inkDark: '#fcd34d',
    advice: 'Unusually sensitive people should consider limiting long outdoor exertion.',
  },
  3: {
    name: 'Unhealthy for Sensitive Groups',
    color: '#ea580c', // Construction orange
    ink: '#9a3412',
    inkDark: '#fdba74',
    advice:
      'People with heart or lung disease, older adults and children should limit long outdoor exertion.',
  },
  4: {
    name: 'Unhealthy',
    color: '#dc2626', // --color-error
    ink: '#b91c1c',
    inkDark: '#fca5a5',
    advice: 'Everyone should limit long outdoor exertion; sensitive groups should avoid it.',
  },
  5: {
    name: 'Very Unhealthy',
    color: '#9333ea',
    ink: '#7e22ce',
    inkDark: '#d8b4fe',
    advice: 'Everyone should avoid long outdoor exertion.',
  },
  6: {
    name: 'Hazardous',
    color: '#9f1239',
    ink: '#881337',
    inkDark: '#fda4af',
    advice: 'Everyone should avoid all outdoor exertion.',
  },
};

/** CSS variables for an element with the `aqi-tone` class (src/styles/aqi.css) */
export function aqiToneVars(category: number): Record<string, string> {
  const c = aqiCategory(category);
  return { '--aqi-color': c.color, '--aqi-ink': c.ink, '--aqi-ink-dark': c.inkDark };
}

export function aqiCategory(category: number): AqiCategory {
  return AQI_CATEGORIES[category] ?? AQI_CATEGORIES[1]!;
}

/** Short label for chips: "Sensitive groups" instead of the full name */
export function aqiShortName(category: number): string {
  return category === 3 ? 'Unhealthy for sensitive groups' : aqiCategory(category).name;
}

export function pollutantLabel(p: Pollutant): string {
  return p === 'OZONE' ? 'Ozone' : p === 'PM2.5' ? 'Fine particles (PM2.5)' : 'Particles (PM10)';
}

/** Vermont's calendar date (YYYY-MM-DD) for a moment */
const vtDate = (d: Date): string => d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

/** "Today", "Tomorrow" or the weekday for a forecast date (YYYY-MM-DD) */
export function dayLabel(date: string, now: Date = new Date()): string {
  if (date === vtDate(now)) return 'Today';
  if (date === vtDate(new Date(now.getTime() + 24 * 3600 * 1000))) return 'Tomorrow';
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
}

/** Forecast days from today on, at most `max` */
export function upcomingAirDays(
  forecast: readonly AirQualityForecastDay[],
  now: Date = new Date(),
  max = 3,
): AirQualityForecastDay[] {
  const today = vtDate(now);
  return forecast.filter((d) => d.date >= today).slice(0, max);
}

/**
 * AirNow stamps a reading with the start of its hour and posts it 20-60
 * minutes after the hour ends, so a current reading is up to ~2 hours "old".
 */
export const AIR_READING_STALE_MINUTES = 150;

export function isAirReadingStale(observedAt: string, now: Date = new Date()): boolean {
  const t = new Date(observedAt).getTime();
  return Number.isFinite(t) && now.getTime() - t > AIR_READING_STALE_MINUTES * 60_000;
}
