/**
 * Air quality from EPA AirNow (VTL-75).
 *
 * - Monitors: hourly ozone and PM2.5 AQI for permanent and temporary monitors in a box around
 *   Vermont (neighbouring NY/NH/MA/QC sites help near the border). One request
 *   per TTL serves everyone; we keep each site's latest reading per pollutant.
 * - Forecast: the daily AQI forecast for the reporting area covering a point,
 *   cached per ~0.1° cell with LRU eviction.
 *
 * Vermont has only a handful of monitors (Burlington, Underhill, Rutland,
 * Bennington), so a point's "current" reading is the nearest monitor's, and we
 * always say which monitor and how far away.
 *
 * Response shapes follow recorded AirNow responses (Sept 2026): the bounding-box
 * service uses PascalCase (SiteName, AQI, Category, UTC); the newer forecast
 * service uses camelCase (dateValid, aqi, categoryNumber, reportingArea).
 */
import { cachedLoader } from './c2c.js';

const AIRNOW = 'https://www.airnowapi.org/aq';
/** minLon,minLat,maxLon,maxLat: Vermont plus ~40 km of neighbours */
const BBOX = '-73.9,42.4,-71.0,45.4';
const MONITOR_TTL_MS = 20 * 60 * 1000;
const FORECAST_TTL_MS = 60 * 60 * 1000;
const FORECAST_CACHE_MAX = 100;
const REQUEST_TIMEOUT_MS = 10_000;
/** Beyond this, the nearest monitor says little about the point */
export const NEAREST_MAX_MI = 60;

export type Pollutant = 'PM2.5' | 'OZONE' | 'PM10';

export interface AirQualityReading {
  pollutant: Pollutant;
  aqi: number;
  /** AirNow category 1 (Good) to 6 (Hazardous) */
  category: number;
}

export interface AirQualityMonitor {
  id: string;
  name: string;
  agency: string | null;
  lat: number;
  lng: number;
  /** Worst current reading across pollutants */
  aqi: number;
  category: number;
  pollutant: Pollutant;
  readings: AirQualityReading[];
  /** ISO time (UTC) of the newest reading */
  observedAt: string;
}

export interface AirQualityForecastDay {
  /** YYYY-MM-DD */
  date: string;
  /** null when the forecaster gave only a category */
  aqi: number | null;
  category: number;
  pollutant: Pollutant;
  reportingArea: string;
  actionDay: boolean;
}

export interface PointAirQuality {
  current: (AirQualityMonitor & { distanceMi: number }) | null;
  forecast: AirQualityForecastDay[];
}

interface RawMonitorRow {
  Latitude?: number;
  Longitude?: number;
  UTC?: string;
  Parameter?: string;
  AQI?: number;
  Category?: number;
  SiteName?: string;
  AgencyName?: string;
  FullAQSCode?: string;
  IntlAQSCode?: string;
}

interface RawForecastRow {
  dateValid?: string;
  reportingArea?: string;
  parameterName?: string;
  aqi?: number;
  categoryNumber?: number;
  actionDay?: boolean;
}

function pollutant(name: string | undefined): Pollutant | null {
  const n = (name ?? '').toUpperCase().replace(/\s/g, '');
  if (n === 'PM2.5' || n === 'PM25') return 'PM2.5';
  if (n === 'OZONE' || n === 'O3') return 'OZONE';
  if (n === 'PM10') return 'PM10';
  return null;
}

const validCategory = (c: unknown): c is number =>
  typeof c === 'number' && Number.isInteger(c) && c >= 1 && c <= 6;

/** AQI → category, for rows that carry an AQI but no usable category. */
export function categoryForAqi(aqi: number): number {
  if (aqi <= 50) return 1;
  if (aqi <= 100) return 2;
  if (aqi <= 150) return 3;
  if (aqi <= 200) return 4;
  if (aqi <= 300) return 5;
  return 6;
}

/** Group hourly rows by site; keep each pollutant's newest valid reading. */
export function parseMonitors(rows: unknown): AirQualityMonitor[] {
  if (!Array.isArray(rows)) return [];
  const sites = new Map<
    string,
    {
      name: string;
      agency: string | null;
      lat: number;
      lng: number;
      byPollutant: Map<Pollutant, AirQualityReading & { at: string }>;
    }
  >();
  for (const row of rows as (RawMonitorRow | null)[]) {
    if (!row || typeof row !== 'object') continue;
    const p = pollutant(row.Parameter);
    const { Latitude: lat, Longitude: lng, AQI: aqi, UTC: at } = row;
    // -999 / -1 mean missing; AQI above 500 is still "Hazardous", keep it
    if (!p || typeof lat !== 'number' || typeof lng !== 'number') continue;
    if (typeof aqi !== 'number' || !Number.isFinite(aqi) || aqi < 0) continue;
    if (typeof at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)) continue;
    const id = row.FullAQSCode || row.IntlAQSCode || `${lat.toFixed(4)},${lng.toFixed(4)}`;
    let site = sites.get(id);
    if (!site) {
      site = {
        name: row.SiteName?.trim() || 'Air monitor',
        agency: row.AgencyName?.trim() || null,
        lat,
        lng,
        byPollutant: new Map(),
      };
      sites.set(id, site);
    }
    const prev = site.byPollutant.get(p);
    if (!prev || at > prev.at) {
      site.byPollutant.set(p, {
        pollutant: p,
        aqi: Math.round(aqi),
        category: validCategory(row.Category) ? row.Category : categoryForAqi(aqi),
        at,
      });
    }
  }
  const monitors: AirQualityMonitor[] = [];
  for (const [id, s] of sites) {
    const readings = [...s.byPollutant.values()];
    if (readings.length === 0) continue;
    const worst = readings.reduce((a, b) => (b.aqi > a.aqi ? b : a));
    const newest = readings.reduce((a, b) => (b.at > a.at ? b : a)).at;
    monitors.push({
      id,
      name: s.name,
      agency: s.agency,
      lat: s.lat,
      lng: s.lng,
      aqi: worst.aqi,
      category: worst.category,
      pollutant: worst.pollutant,
      readings: readings
        .map(({ pollutant: rp, aqi, category }) => ({ pollutant: rp, aqi, category }))
        .sort((a, b) => b.aqi - a.aqi),
      observedAt: `${newest}:00Z`,
    });
  }
  return monitors.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * One entry per day: the worst pollutant that day. A row with aqi -1 carries
 * only a category (the forecaster's call); it still counts.
 */
export function parseForecast(rows: unknown): AirQualityForecastDay[] {
  if (!Array.isArray(rows)) return [];
  const days = new Map<string, AirQualityForecastDay>();
  for (const row of rows as (RawForecastRow | null)[]) {
    if (!row || typeof row !== 'object') continue;
    const p = pollutant(row.parameterName);
    const date = row.dateValid?.slice(0, 10);
    if (!p || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const aqi = typeof row.aqi === 'number' && row.aqi >= 0 ? Math.round(row.aqi) : null;
    const category = validCategory(row.categoryNumber)
      ? row.categoryNumber
      : aqi !== null
        ? categoryForAqi(aqi)
        : null;
    if (category === null) continue; // not issued for this pollutant
    const day: AirQualityForecastDay = {
      date,
      aqi,
      category,
      pollutant: p,
      reportingArea: row.reportingArea?.trim() || '',
      actionDay: row.actionDay === true,
    };
    const prev = days.get(date);
    const worse =
      !prev ||
      category > prev.category ||
      (category === prev.category && (aqi ?? 0) > (prev.aqi ?? 0));
    if (worse) days.set(date, { ...day, actionDay: day.actionDay || (prev?.actionDay ?? false) });
    else if (day.actionDay) prev.actionDay = true;
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Great-circle distance in miles. */
export function distanceMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}

export function nearestMonitor(
  monitors: AirQualityMonitor[],
  lat: number,
  lng: number,
): (AirQualityMonitor & { distanceMi: number }) | null {
  let best: (AirQualityMonitor & { distanceMi: number }) | null = null;
  for (const m of monitors) {
    const d = distanceMi(lat, lng, m.lat, m.lng);
    if (d <= NEAREST_MAX_MI && (!best || d < best.distanceMi)) best = { ...m, distanceMi: d };
  }
  return best;
}

/** UTC hour string AirNow expects: YYYY-MM-DDTHH */
function utcHour(ms: number): string {
  return new Date(ms).toISOString().slice(0, 13);
}

export class AirQualityNotConfiguredError extends Error {
  constructor() {
    super('AIRNOW_API_KEY is not set');
  }
}

export function createAirQualityService(apiKey: string | undefined, now: () => number = Date.now) {
  async function getJson(path: string, query: Record<string, string>): Promise<unknown> {
    if (!apiKey) throw new AirQualityNotConfiguredError();
    const url = new URL(`${AIRNOW}/${path}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    url.searchParams.set('format', 'application/json');
    url.searchParams.set('API_KEY', apiKey);
    const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`AirNow ${path}: HTTP ${res.status}`);
    const body: unknown = await res.json();
    // AirNow reports some errors as a JSON object with a message, not a status code
    if (!Array.isArray(body)) throw new Error(`AirNow ${path}: unexpected response`);
    return body;
  }

  const monitors = cachedLoader(MONITOR_TTL_MS, async () => {
    const end = now();
    // Three hours back: sites report 10-60 minutes late, some skip an hour
    const rows = await getJson('data/', {
      startDate: utcHour(end - 3 * 3600_000),
      endDate: utcHour(end),
      parameters: 'OZONE,PM25',
      BBOX,
      dataType: 'A',
      verbose: '1',
      // Permanent and temporary monitors: states add temporary ones during smoke events
      monitorType: '2',
      includerawconcentrations: '0',
    });
    return parseMonitors(rows);
  });

  // LRU of forecasts per ~0.1° cell (Map keeps insertion order)
  const forecasts = new Map<string, { value: AirQualityForecastDay[]; at: number }>();
  const inFlight = new Map<string, Promise<AirQualityForecastDay[]>>();

  async function getForecast(lat: number, lng: number): Promise<AirQualityForecastDay[]> {
    const key = `${lat.toFixed(1)},${lng.toFixed(1)}`;
    const hit = forecasts.get(key);
    if (hit && now() - hit.at < FORECAST_TTL_MS) {
      forecasts.delete(key);
      forecasts.set(key, hit);
      return hit.value;
    }
    let pending = inFlight.get(key);
    if (!pending) {
      pending = getJson('forecast/current/', {
        latitude: lat.toFixed(1),
        longitude: lng.toFixed(1),
      })
        .then((rows) => {
          const value = parseForecast(rows);
          forecasts.delete(key);
          forecasts.set(key, { value, at: now() });
          while (forecasts.size > FORECAST_CACHE_MAX) {
            const oldest = forecasts.keys().next().value;
            if (oldest === undefined) break;
            forecasts.delete(oldest);
          }
          return value;
        })
        .finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }
    try {
      return await pending;
    } catch (error) {
      if (hit) return hit.value; // stale beats nothing
      throw error;
    }
  }

  return {
    configured: Boolean(apiKey),
    getMonitors: () => monitors.get(),
    getForecast,
    /** Nearest monitor's reading plus the area forecast; either part may be missing. */
    async getPoint(lat: number, lng: number): Promise<PointAirQuality> {
      const [m, f] = await Promise.allSettled([monitors.get(), getForecast(lat, lng)]);
      if (m.status === 'rejected' && f.status === 'rejected') throw m.reason;
      return {
        current: m.status === 'fulfilled' ? nearestMonitor(m.value, lat, lng) : null,
        forecast: f.status === 'fulfilled' ? f.value : [],
      };
    },
    /** For tests. */
    reset: () => {
      monitors.reset();
      forecasts.clear();
    },
  };
}
