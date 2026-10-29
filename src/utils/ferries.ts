/**
 * Ferry status from the published season (VTL-81). There's no live feed, so
 * this says what the operator publishes for the date, never "running now".
 */
import type { Ferry } from '../data/ferries';

export type FerryState = 'season' | 'ice' | 'check' | 'closed' | 'suspended';

export interface FerryStatus {
  state: FerryState;
  /** Short, for markers and the panel banner */
  label: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
}

/** "MM-DD" of a date in Vermont */
function vermontMonthDay(now: Date): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).slice(5);
}

export function getFerryStatus(ferry: Ferry, now: Date = new Date()): FerryStatus {
  if (ferry.suspended) return { state: 'suspended', label: ferry.suspended, tone: 'bad' };
  const md = vermontMonthDay(now);
  const month = Number(md.slice(0, 2));
  const { from, to, shoulderTo, iceMonths } = ferry.season;
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
