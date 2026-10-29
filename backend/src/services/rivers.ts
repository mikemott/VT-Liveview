/**
 * River and lake levels from the NWS National Water Prediction Service (VTL-81).
 *
 * - Gauges: every NWPS gauge in Vermont, plus Connecticut River and Lake
 *   Champlain gauges just over the line, with the latest stage, flow and the
 *   NWS flood category (observed and forecast). One request per TTL serves
 *   everyone.
 * - Gauge detail: flood stages, impact statements, historic crests and the
 *   recent hydrograph plus forecast, cached per gauge with LRU eviction.
 *
 * No key needed. Response shapes follow recorded NWPS v1 responses (Oct 2026).
 * Missing values are -999 (stage/flow) or -9999 (flood thresholds).
 */
import { cachedLoader } from './c2c.js';

const NWPS = 'https://api.water.noaa.gov/nwps/v1';
/** Vermont plus a margin for border gauges (EPSG:4326) */
const BBOX = { xmin: '-73.5', ymin: '42.65', xmax: '-71.4', ymax: '45.1' };
const GAUGES_TTL_MS = 10 * 60 * 1000;
const DETAIL_TTL_MS = 10 * 60 * 1000;
const DETAIL_CACHE_MAX = 100;
/** After a failed refresh, serve the stale copy this long before trying again */
const RETRY_AFTER_ERROR_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;
/** Hydrograph shown in the panel: the last week, one point an hour */
const HISTORY_MS = 7 * 24 * 3600_000;
const HISTORY_STEP_MS = 3600_000;

/** NWPS gauge ids: NWSLI, e.g. MONV1 */
export const GAUGE_ID = /^[A-Z0-9]{3,6}$/;

export type FloodCategory =
  | 'no_flooding'
  | 'action'
  | 'minor'
  | 'moderate'
  | 'major'
  /** The gauge reports a level but has no flood stages defined */
  | 'not_defined'
  /** No current reading */
  | 'unknown';

export interface RiverGauge {
  /** NWSLI id, e.g. MONV1 */
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  /** Feet; lake gauges report elevation above sea level */
  stageFt: number | null;
  /** Cubic feet per second, when the gauge rates flow */
  flowCfs: number | null;
  category: FloodCategory;
  /** ISO time of the reading, null without one */
  observedAt: string | null;
  /** The NWS forecast's category, null when this gauge has no current forecast */
  forecastCategory: FloodCategory | null;
  forecastStageFt: number | null;
  forecastAt: string | null;
}

export interface FloodStages {
  action: number | null;
  minor: number | null;
  moderate: number | null;
  major: number | null;
}

export interface StagePoint {
  /** ISO time */
  t: string;
  stageFt: number;
}

export interface RiverGaugeDetail {
  id: string;
  usgsId: string | null;
  county: string | null;
  floodStages: FloodStages;
  /** "At N ft: what floods", highest stage first */
  impacts: { stageFt: number; statement: string }[];
  /** The highest recorded crests, highest first */
  historicCrests: { date: string; stageFt: number; flowCfs: number | null }[];
  /** Last week, hourly */
  observed: StagePoint[];
  forecast: StagePoint[];
  forecastIssuedAt: string | null;
}

interface RawStatus {
  primary?: number;
  primaryUnit?: string;
  secondary?: number;
  secondaryUnit?: string;
  floodCategory?: string;
  validTime?: string;
}

interface RawGauge {
  lid?: string;
  name?: string;
  state?: { abbreviation?: string };
  latitude?: number;
  longitude?: number;
  status?: { observed?: RawStatus; forecast?: RawStatus };
}

interface RawGaugeDetail {
  lid?: string;
  usgsId?: string;
  county?: string;
  flood?: {
    categories?: Record<string, { stage?: number } | undefined>;
    impacts?: { stage?: number; statement?: string }[];
    crests?: {
      historic?: {
        occurredTime?: string;
        stage?: number;
        flow?: number;
        olddatum?: boolean;
      }[];
    };
  };
}

interface RawSeries {
  issuedTime?: string;
  primaryUnits?: string;
  data?: { validTime?: string; primary?: number }[];
}

/** NWPS uses -999 / -9999 for "none" */
const present = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > -900;

const CATEGORIES = new Set<FloodCategory>([
  'no_flooding',
  'action',
  'minor',
  'moderate',
  'major',
  'not_defined',
]);

/** Map an NWPS floodCategory; "obs_not_current", "fcst_not_current" etc. become unknown */
export function floodCategory(raw: string | undefined): FloodCategory {
  return CATEGORIES.has(raw as FloodCategory) ? (raw as FloodCategory) : 'unknown';
}

function flowCfs(status: RawStatus): number | null {
  if (!present(status.secondary)) return null;
  const unit = (status.secondaryUnit ?? '').toLowerCase();
  if (unit === 'kcfs') return Math.round(status.secondary * 1000);
  if (unit === 'cfs') return Math.round(status.secondary);
  return null;
}

/** Gauges in Vermont, plus border gauges on the Connecticut River and Lake Champlain */
export function isVermontGauge(state: string, name: string): boolean {
  if (state === 'VT') return true;
  return (
    (state === 'NH' || state === 'NY' || state === 'MA') &&
    /Connecticut River|Lake Champlain/i.test(name)
  );
}

export function parseGauges(body: unknown): RiverGauge[] {
  const rows = (body as { gauges?: unknown } | null)?.gauges;
  if (!Array.isArray(rows)) return [];
  const gauges: RiverGauge[] = [];
  for (const row of rows as (RawGauge | null)[]) {
    if (!row || typeof row !== 'object') continue;
    const { lid: id, latitude: lat, longitude: lng } = row;
    const name = row.name?.trim() ?? '';
    const state = row.state?.abbreviation ?? '';
    if (!id || !GAUGE_ID.test(id) || !name) continue;
    if (typeof lat !== 'number' || typeof lng !== 'number') continue;
    if (!isVermontGauge(state, name)) continue;
    const obs = row.status?.observed ?? {};
    const fcst = row.status?.forecast ?? {};
    const hasObs = present(obs.primary) && (obs.primaryUnit ?? 'ft') === 'ft';
    const hasFcst = present(fcst.primary) && (fcst.primaryUnit ?? 'ft') === 'ft';
    gauges.push({
      id,
      name,
      state,
      lat,
      lng,
      stageFt: hasObs ? obs.primary! : null,
      flowCfs: hasObs ? flowCfs(obs) : null,
      category: hasObs ? floodCategory(obs.floodCategory) : 'unknown',
      observedAt: hasObs ? (obs.validTime ?? null) : null,
      forecastCategory: hasFcst ? floodCategory(fcst.floodCategory) : null,
      forecastStageFt: hasFcst ? fcst.primary! : null,
      forecastAt: hasFcst ? (fcst.validTime ?? null) : null,
    });
  }
  return gauges.sort((a, b) => a.name.localeCompare(b.name));
}

/** Thin a series to one point per step, keeping the newest point in each step */
function thin(points: StagePoint[], stepMs: number): StagePoint[] {
  const byStep = new Map<number, StagePoint>();
  for (const p of points) byStep.set(Math.floor(Date.parse(p.t) / stepMs), p);
  return [...byStep.values()];
}

function parseSeries(series: RawSeries | undefined): StagePoint[] {
  if (!series || (series.primaryUnits ?? 'ft') !== 'ft' || !Array.isArray(series.data)) return [];
  return series.data
    .filter((d) => typeof d.validTime === 'string' && !Number.isNaN(Date.parse(d.validTime)))
    .filter((d) => present(d.primary))
    .map((d) => ({ t: d.validTime!, stageFt: d.primary! }))
    .sort((a, b) => a.t.localeCompare(b.t));
}

export function parseGaugeDetail(
  gauge: unknown,
  stageflow: unknown,
  now: number = Date.now(),
): RiverGaugeDetail | null {
  const g = gauge as RawGaugeDetail | null;
  if (!g || typeof g !== 'object' || !g.lid) return null;
  const cats = g.flood?.categories ?? {};
  const stage = (k: string): number | null => {
    const s = cats[k]?.stage;
    return present(s) ? s : null;
  };
  const impacts = (g.flood?.impacts ?? [])
    .filter((i) => present(i.stage) && typeof i.statement === 'string' && i.statement.trim())
    .map((i) => ({ stageFt: i.stage!, statement: i.statement!.trim() }))
    .sort((a, b) => b.stageFt - a.stageFt);
  const historicCrests = (g.flood?.crests?.historic ?? [])
    .filter((c) => !c.olddatum && present(c.stage) && typeof c.occurredTime === 'string')
    .map((c) => ({
      date: c.occurredTime!.slice(0, 10),
      stageFt: c.stage!,
      flowCfs: present(c.flow) ? Math.round(c.flow) : null,
    }))
    .sort((a, b) => b.stageFt - a.stageFt)
    .slice(0, 3);

  const sf = (stageflow ?? {}) as { observed?: RawSeries; forecast?: RawSeries };
  const observed = thin(
    parseSeries(sf.observed).filter((p) => now - Date.parse(p.t) <= HISTORY_MS),
    HISTORY_STEP_MS,
  );
  const forecast = parseSeries(sf.forecast);

  return {
    id: g.lid,
    usgsId: g.usgsId?.trim() || null,
    county: g.county?.trim() || null,
    floodStages: {
      action: stage('action'),
      minor: stage('minor'),
      moderate: stage('moderate'),
      major: stage('major'),
    },
    impacts,
    historicCrests,
    observed,
    forecast,
    forecastIssuedAt: forecast.length > 0 ? (sf.forecast?.issuedTime ?? null) : null,
  };
}

export function createRiverService(userAgent: string, now: () => number = Date.now) {
  async function getJson(path: string, query: Record<string, string> = {}): Promise<unknown> {
    const url = new URL(`${NWPS}${path}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const res = await fetch(url, {
      headers: { 'User-Agent': userAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`NWPS ${path}: HTTP ${res.status}`);
    return res.json();
  }

  const gauges = cachedLoader(GAUGES_TTL_MS, async () =>
    parseGauges(
      await getJson('/gauges', {
        'bbox.xmin': BBOX.xmin,
        'bbox.ymin': BBOX.ymin,
        'bbox.xmax': BBOX.xmax,
        'bbox.ymax': BBOX.ymax,
        srid: 'EPSG_4326',
      }),
    ),
  );

  // LRU of gauge details (Map keeps insertion order)
  const details = new Map<string, { value: RiverGaugeDetail | null; at: number }>();
  const inFlight = new Map<string, Promise<RiverGaugeDetail | null>>();

  async function getGauge(id: string): Promise<RiverGaugeDetail | null> {
    if (!GAUGE_ID.test(id)) return null;
    const hit = details.get(id);
    if (hit && now() - hit.at < DETAIL_TTL_MS) {
      details.delete(id);
      details.set(id, hit);
      return hit.value;
    }
    let pending = inFlight.get(id);
    if (!pending) {
      pending = (async () => {
        const [gauge, stageflow] = await Promise.all([
          getJson(`/gauges/${id}`),
          // A gauge without a hydrograph still has stages and crests
          getJson(`/gauges/${id}/stageflow`).catch(() => null),
        ]);
        const value = parseGaugeDetail(gauge, stageflow, now());
        details.delete(id);
        details.set(id, { value, at: now() });
        while (details.size > DETAIL_CACHE_MAX) {
          const oldest = details.keys().next().value;
          if (oldest === undefined) break;
          details.delete(oldest);
        }
        return value;
      })().finally(() => inFlight.delete(id));
      inFlight.set(id, pending);
    }
    try {
      return await pending;
    } catch (error) {
      if (!hit) throw error;
      // Stale beats nothing; don't retry on every request while NWPS is down
      details.set(id, { value: hit.value, at: now() - DETAIL_TTL_MS + RETRY_AFTER_ERROR_MS });
      return hit.value;
    }
  }

  return {
    getGauges: () => gauges.get(),
    getGauge,
    /** For tests. */
    reset: () => {
      gauges.reset();
      details.clear();
    },
  };
}
