/**
 * The hourly view behind a forecast card: the hours inside one day or night
 * period, labelled in Vermont time.
 */
import type { HourlyPeriodData } from '../services/graphqlClient';

/** Hours that start inside the period. NOAA's hourly list starts at the current hour. */
export function hoursInPeriod(
  hours: HourlyPeriodData[],
  period: { startTime: string; endTime: string },
): HourlyPeriodData[] {
  const start = Date.parse(period.startTime);
  const end = Date.parse(period.endTime);
  return hours.filter((h) => {
    const t = Date.parse(h.startTime);
    return t >= start && t < end;
  });
}

const HOUR = new Intl.DateTimeFormat('en-US', { hour: 'numeric', timeZone: 'America/New_York' });

/** "9 AM" in Vermont */
export function hourLabel(iso: string): string {
  return HOUR.format(new Date(iso));
}
