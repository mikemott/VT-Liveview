/**
 * Today's climate normals and records from RCC-ACIS (VTL-81): "normal high
 * 54°, record 75° in 1947" for the weather card.
 *
 * ACIS serves 1991-2020 daily normals and period-of-record extremes for any
 * station, with no key. We use a fixed set of long-record stations around
 * Vermont and pick the nearest one to the map center; the card names it.
 * Burlington uses the threaded record (BTVthr), which joins the city and
 * airport sites back to 1884.
 *
 * Response shapes follow recorded ACIS StnData responses (Oct 2026). Values
 * are strings; "M" means missing, "T" trace, and a trailing letter is a flag.
 */
import { distanceMi } from './airQuality.js';

const ACIS = 'https://data.rcc-acis.org/StnData';
const TTL_MS = 6 * 3600_000;
const CACHE_MAX = 50;
/** After a failed refresh, serve the stale copy this long before trying again */
const RETRY_AFTER_ERROR_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;
const TIME_ZONE = 'America/New_York';

export interface ClimateStation {
  /** ACIS station id */
  sid: string;
  name: string;
  lat: number;
  lng: number;
}

/** Long-record stations with current data (checked Oct 2026) */
export const CLIMATE_STATIONS: ClimateStation[] = [
  { sid: 'BTVthr', name: 'Burlington', lat: 44.468, lng: -73.15 },
  { sid: 'MPV', name: 'Montpelier', lat: 44.205, lng: -72.565 },
  { sid: 'USC00437054', name: 'St. Johnsbury', lat: 44.42, lng: -72.019 },
  { sid: 'USC00434120', name: 'Island Pond', lat: 44.813, lng: -71.89 },
  { sid: 'USC00431580', name: 'Cornwall', lat: 43.957, lng: -73.211 },
  { sid: 'USC00436995', name: 'Rutland', lat: 43.625, lng: -72.978 },
  { sid: 'USC00439984', name: 'Woodstock', lat: 43.63, lng: -72.507 },
  // Southern Vermont has no long-record station of its own
  { sid: 'USC00274399', name: 'Keene, NH', lat: 42.939, lng: -72.325 },
  { sid: 'PSF', name: 'Pittsfield, MA', lat: 42.427, lng: -73.289 },
];

export interface ClimateRecord {
  tempF: number;
  year: number;
}

export interface ClimateDay {
  /** YYYY-MM-DD, Vermont time */
  date: string;
  station: { name: string; distanceMi: number };
  normalHighF: number | null;
  normalLowF: number | null;
  recordHigh: ClimateRecord | null;
  recordLow: ClimateRecord | null;
}

/** "54" → 54; "M", "", "T" → null; "75A" (flagged) → 75 */
export function acisNumber(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m = /^(-?\d+(?:\.\d+)?)[A-Z]?$/.exec(value.trim());
  return m ? Math.round(Number(m[1])) : null;
}

function parseRecord(entry: unknown): ClimateRecord | null {
  // smry entry with add=date: [[value, "YYYY-MM-DD"]]
  const pair = Array.isArray(entry) ? (entry[0] as unknown) : null;
  if (!Array.isArray(pair)) return null;
  const tempF = acisNumber(pair[0]);
  const year = typeof pair[1] === 'string' ? Number(pair[1].slice(0, 4)) : NaN;
  return tempF === null || !Number.isInteger(year) ? null : { tempF, year };
}

export function parseNormals(body: unknown): { high: number | null; low: number | null } {
  const row = (body as { data?: unknown[][] } | null)?.data?.[0];
  return Array.isArray(row)
    ? { high: acisNumber(row[1]), low: acisNumber(row[2]) }
    : { high: null, low: null };
}

export function parseRecords(body: unknown): {
  high: ClimateRecord | null;
  low: ClimateRecord | null;
} {
  const smry = (body as { smry?: unknown[] } | null)?.smry;
  return Array.isArray(smry)
    ? { high: parseRecord(smry[0]), low: parseRecord(smry[1]) }
    : { high: null, low: null };
}

export function nearestClimateStation(
  lat: number,
  lng: number,
): ClimateStation & { distanceMi: number } {
  let best: (ClimateStation & { distanceMi: number }) | null = null;
  for (const s of CLIMATE_STATIONS) {
    const d = distanceMi(lat, lng, s.lat, s.lng);
    if (!best || d < best.distanceMi) best = { ...s, distanceMi: d };
  }
  return best!;
}

/** YYYY-MM-DD in Vermont */
export function vermontDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: TIME_ZONE });
}

export function createClimateService(now: () => number = Date.now) {
  async function post(body: unknown): Promise<unknown> {
    const res = await fetch(ACIS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`ACIS: HTTP ${res.status}`);
    const json = (await res.json()) as { error?: string };
    if (json && typeof json === 'object' && json.error) throw new Error(`ACIS: ${json.error}`);
    return json;
  }

  // LRU per station and day (Map keeps insertion order)
  const cache = new Map<string, { value: Omit<ClimateDay, 'station'>; at: number }>();
  const inFlight = new Map<string, Promise<Omit<ClimateDay, 'station'>>>();

  async function load(sid: string, date: string): Promise<Omit<ClimateDay, 'station'>> {
    const monthDay = date.slice(5).replace('-', '');
    const extreme = (name: string, reduce: 'max' | 'min') => ({
      name,
      interval: 'dly',
      duration: 'dly',
      smry: { reduce, add: 'date' },
      smry_only: 1,
      groupby: ['year', monthDay, monthDay],
    });
    const [normals, records] = await Promise.all([
      post({
        sid,
        sdate: date,
        edate: date,
        elems: [
          { name: 'maxt', normal: '1' },
          { name: 'mint', normal: '1' },
        ],
      }),
      post({
        sid,
        sdate: 'por',
        edate: date,
        elems: [extreme('maxt', 'max'), extreme('mint', 'min')],
      }),
    ]);
    const n = parseNormals(normals);
    const r = parseRecords(records);
    return { date, normalHighF: n.high, normalLowF: n.low, recordHigh: r.high, recordLow: r.low };
  }

  return {
    async getDay(lat: number, lng: number): Promise<ClimateDay> {
      const station = nearestClimateStation(lat, lng);
      const date = vermontDate(now());
      const key = `${station.sid}|${date}`;
      const hit = cache.get(key);
      let value: Omit<ClimateDay, 'station'>;
      if (hit && now() - hit.at < TTL_MS) {
        cache.delete(key);
        cache.set(key, hit);
        value = hit.value;
      } else {
        let pending = inFlight.get(key);
        if (!pending) {
          pending = load(station.sid, date)
            .then((v) => {
              cache.delete(key);
              cache.set(key, { value: v, at: now() });
              while (cache.size > CACHE_MAX) {
                const oldest = cache.keys().next().value;
                if (oldest === undefined) break;
                cache.delete(oldest);
              }
              return v;
            })
            .finally(() => inFlight.delete(key));
          inFlight.set(key, pending);
        }
        try {
          value = await pending;
        } catch (error) {
          if (!hit) throw error;
          // Stale (same day) beats nothing; don't retry on every request while ACIS is down
          cache.set(key, { value: hit.value, at: now() - TTL_MS + RETRY_AFTER_ERROR_MS });
          value = hit.value;
        }
      }
      return {
        ...value,
        station: { name: station.name, distanceMi: Math.round(station.distanceMi) },
      };
    },
    /** For tests. */
    reset: () => cache.clear(),
  };
}
