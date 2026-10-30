/**
 * Ferry status from the published season (VTL-81). There's no live feed, so
 * this says what the operator publishes for the date, never "running now".
 */
import type { Ferry, SeasonDate } from '../data/ferries';
import { vermontDateKey } from './seasonalRoads';

export type FerryState = 'season' | 'ice' | 'check' | 'closed';

export interface FerryStatus {
  state: FerryState;
  /** Short, for markers and the panel banner */
  label: string;
  tone: 'good' | 'warn' | 'neutral';
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Day of the month of the nth (1-based; -1 = last) given weekday (0 = Sunday) */
function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  if (n > 0) {
    const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  }
  const lastDay = new Date(Date.UTC(year, month, 0));
  return lastDay.getUTCDate() - ((lastDay.getUTCDay() - weekday + 7) % 7);
}

/** A season date as "MM-DD" for a year: holidays move from year to year */
export function seasonDay(date: SeasonDate, year: number): string {
  if (date === 'memorialDayWeekend') {
    // The Saturday before Memorial Day (last Monday in May)
    return `05-${pad(nthWeekday(year, 5, 1, -1) - 2)}`;
  }
  if (date === 'laborDay') return `09-${pad(nthWeekday(year, 9, 1, 1))}`;
  return date;
}

/** The year in Vermont */
const vermontYear = (now: Date): number =>
  Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric' }).format(now),
  );

export function getFerryStatus(ferry: Ferry, now: Date = new Date()): FerryStatus {
  const md = vermontDateKey(now);
  const month = Number(md.slice(0, 2));
  const year = vermontYear(now);
  const { iceMonths } = ferry.season;
  const from = ferry.season.from && seasonDay(ferry.season.from, year);
  const to = ferry.season.to && seasonDay(ferry.season.to, year);
  const shoulderTo = ferry.season.shoulderTo && seasonDay(ferry.season.shoulderTo, year);
  if (from && to) {
    if (md >= from && md <= to) return { state: 'season', label: 'In season', tone: 'good' };
    if (shoulderTo && md > to && md <= shoulderTo) {
      return { state: 'check', label: 'End of season: check before you go', tone: 'warn' };
    }
    return { state: 'closed', label: 'Closed for the season', tone: 'neutral' };
  }
  if (iceMonths?.includes(month)) {
    return { state: 'ice', label: 'Ice season: often closed', tone: 'warn' };
  }
  return { state: 'season', label: 'Year-round', tone: 'good' };
}

/** The route is drawn in colour only while the published season says it runs */
export const isRunning = (status: FerryStatus): boolean =>
  status.state === 'season' || status.state === 'check';
