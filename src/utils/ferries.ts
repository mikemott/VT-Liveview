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

/** Boats cross on the map only while the published season says they run */
export const isRunning = (status: FerryStatus): boolean =>
  status.state === 'season' || status.state === 'check';

/** Length of a [lng, lat] line in km (equirectangular; fine for a few km) */
function segmentKm([x1, y1]: [number, number], [x2, y2]: [number, number]): number {
  const kx = 111.32 * Math.cos((((y1 + y2) / 2) * Math.PI) / 180);
  return Math.hypot((x2 - x1) * kx, (y2 - y1) * 110.57);
}

/** The point a fraction `t` (0-1) along a line */
export function pointAlong(route: [number, number][], t: number): [number, number] {
  if (route.length === 1 || t <= 0) return route[0]!;
  if (t >= 1) return route[route.length - 1]!;
  const lengths = route.slice(1).map((p, i) => segmentKm(route[i]!, p));
  let target = lengths.reduce((a, b) => a + b, 0) * Math.min(1, Math.max(0, t));
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i]!;
    if (target <= len || i === lengths.length - 1) {
      const f = len === 0 ? 0 : Math.min(1, target / len);
      const [x1, y1] = route[i]!;
      const [x2, y2] = route[i + 1]!;
      return [x1 + (x2 - x1) * f, y1 + (y2 - y1) * f];
    }
    target -= len;
  }
  return route[route.length - 1]!;
}

/**
 * Where a boat is `ms` into its loop: cross, wait at the far landing, cross
 * back, wait. A real crossing minute plays as half a second, so a 25-minute
 * crossing takes 12.5 s on the map.
 */
export const DWELL_MS = 1500;
export function boatPosition(ferry: Ferry, ms: number): [number, number] {
  const cross = Math.max(ferry.crossingMinutes * 500, 2000);
  const loop = 2 * (cross + DWELL_MS);
  const t = ms % loop;
  if (t < cross) return pointAlong(ferry.route, t / cross);
  if (t < cross + DWELL_MS) return ferry.route[ferry.route.length - 1]!;
  if (t < 2 * cross + DWELL_MS) return pointAlong(ferry.route, 1 - (t - cross - DWELL_MS) / cross);
  return ferry.route[0]!;
}
