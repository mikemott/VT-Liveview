/**
 * Status logic for seasonally closed roads (VTL-55).
 *
 * A road's status comes from, in order:
 * 1. An active 511 closure reported on (near) the road: "closed now"
 * 2. Today's date (in Vermont) inside its typical closure window: "seasonal"
 * 3. Within CLOSING_SOON_DAYS of the window starting: "closing soon"
 * 4. Otherwise "open" (still drawn faintly, so people know it's a seasonal road)
 */
import { SEASONAL_ROADS, type SeasonalRoad } from '../data/seasonalRoads';

export type SeasonalStatus = 'closed511' | 'seasonal' | 'closingSoon' | 'open';

export interface RoadStatus {
  status: SeasonalStatus;
  /** Short line for the panel header and list */
  label: string;
}

export interface ClosurePoint {
  lat: number;
  lng: number;
}

/** The parts of a travel incident needed to tell if it closes a road. */
export interface ClosureCandidate {
  type: string;
  title: string;
  description: string;
  affectedLanes?: string | null;
  location: { lat: number; lng: number };
}

const FULL_CLOSURE_TEXT =
  /\b(road|roadway|route|highway) (is )?closed\b|\ball lanes (are )?closed\b|\bclosed (in )?both directions\b/i;

/** True for a 511 report that closes the road (not just a lane). */
export function isFullClosure(incident: ClosureCandidate): boolean {
  if (incident.type === 'CLOSURE') return true;
  const text = `${incident.title} ${incident.description} ${incident.affectedLanes ?? ''}`;
  return FULL_CLOSURE_TEXT.test(text);
}

/** Locations of full closures, for the seasonal-road override. */
export function closurePoints(incidents: readonly ClosureCandidate[]): ClosurePoint[] {
  return incidents
    .filter((i) => i.type !== 'FLOODING' && isFullClosure(i))
    .map((i) => ({ lat: i.location.lat, lng: i.location.lng }))
    .filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && !(p.lat === 0 && p.lng === 0),
    );
}

export const CLOSING_SOON_DAYS = 21;
/** A 511 closure within this distance of a road counts as being on it. */
export const CLOSURE_MATCH_METERS = 250;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "MM-DD" for a date as seen in Vermont (America/New_York). */
export function vermontDateKey(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '01';
  return `${get('month')}-${get('day')}`;
}

/** Inclusive window check on "MM-DD" keys; windows may wrap over New Year. */
export function inWindow(key: string, window: { start: string; end: string }): boolean {
  return window.start <= window.end
    ? key >= window.start && key <= window.end
    : key >= window.start || key <= window.end;
}

/** Day of a (non-leap) year for "MM-DD", 0-based. */
function dayOfYear(key: string): number {
  const [m, d] = key.split('-').map(Number);
  return Math.round((Date.UTC(2001, (m ?? 1) - 1, d ?? 1) - Date.UTC(2001, 0, 1)) / 86_400_000);
}

/** Days from `from` forward to the next `to` (0 when equal). */
export function daysUntil(from: string, to: string): number {
  return (dayOfYear(to) - dayOfYear(from) + 365) % 365;
}

/** "11-15" → "Nov 15" */
export function formatMonthDay(key: string): string {
  const [m, d] = key.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${d}`;
}

/** Approximate distance (m) from a point to a polyline set; fine at road scale. */
export function distanceToLinesMeters(
  lat: number,
  lng: number,
  lines: [number, number][][],
): number {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const a = line[i]!;
      const b = line[i + 1] ?? a;
      // Work in local metres relative to the point
      const ax = (a[0] - lng) * mPerDegLng;
      const ay = (a[1] - lat) * mPerDegLat;
      const bx = (b[0] - lng) * mPerDegLng;
      const by = (b[1] - lat) * mPerDegLat;
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < best) best = d;
    }
  }
  return best;
}

export function getRoadStatus(
  road: SeasonalRoad,
  now: Date,
  closures: readonly ClosurePoint[] = [],
): RoadStatus {
  if (
    closures.some((c) => distanceToLinesMeters(c.lat, c.lng, road.lines) <= CLOSURE_MATCH_METERS)
  ) {
    return { status: 'closed511', label: 'Closed now (Vermont 511 report)' };
  }
  const today = vermontDateKey(now);
  if (inWindow(today, road.season)) {
    return {
      status: 'seasonal',
      label: `Seasonally closed, usually until about ${formatMonthDay(road.season.end)}`,
    };
  }
  const days = daysUntil(today, road.season.start);
  if (days <= CLOSING_SOON_DAYS) {
    return {
      status: 'closingSoon',
      label: `Usually closes for winter around ${formatMonthDay(road.season.start)}`,
    };
  }
  return { status: 'open', label: `Open; closes for winter ${road.seasonText}` };
}

/** Status for every road (map layer, detail panel, search). */
export function getSeasonalStatuses(
  closures: readonly ClosurePoint[],
  now: Date = new Date(),
): Map<string, RoadStatus> {
  return new Map(SEASONAL_ROADS.map((road) => [road.id, getRoadStatus(road, now, closures)]));
}

export const SEASONAL_STATUS_COLORS: Record<SeasonalStatus, string> = {
  closed511: '#dc2626',
  seasonal: '#b91c1c',
  closingSoon: '#d97706',
  open: '#64748b',
};

export interface SeasonalRoadFeatureCollection {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    properties: { id: string; name: string; status: SeasonalStatus };
    geometry: { type: 'MultiLineString'; coordinates: [number, number][][] };
  }[];
}

export function buildSeasonalRoadsGeoJSON(
  roads: readonly SeasonalRoad[],
  statusById: ReadonlyMap<string, RoadStatus>,
): SeasonalRoadFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: roads.map((road) => ({
      type: 'Feature',
      properties: {
        id: road.id,
        name: road.name,
        status: statusById.get(road.id)?.status ?? 'open',
      },
      geometry: { type: 'MultiLineString', coordinates: road.lines },
    })),
  };
}

/** [west, south, east, north] of a road. */
export function roadBounds(road: SeasonalRoad): [number, number, number, number] {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const line of road.lines) {
    for (const [x, y] of line) {
      if (x < w) w = x;
      if (x > e) e = x;
      if (y < s) s = y;
      if (y > n) n = y;
    }
  }
  return [w, s, e, n];
}

/** Center [lng, lat] of a road's bounding box. */
export function roadCenter(road: SeasonalRoad): [number, number] {
  const [w, s, e, n] = roadBounds(road);
  return [(w + e) / 2, (s + n) / 2];
}
