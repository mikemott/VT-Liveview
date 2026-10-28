/**
 * River and lake levels (NWS National Water Prediction Service) via the backend (VTL-81).
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export type FloodCategory =
  'no_flooding' | 'action' | 'minor' | 'moderate' | 'major' | 'not_defined' | 'unknown';

export interface RiverGauge {
  /** NWSLI id, e.g. MONV1 */
  id: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  /** Feet; lake gauges report elevation above sea level */
  stageFt: number | null;
  flowCfs: number | null;
  category: FloodCategory;
  observedAt: string | null;
  /** null when this gauge has no current NWS forecast */
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
  t: string;
  stageFt: number;
}

export interface RiverGaugeDetail {
  id: string;
  usgsId: string | null;
  county: string | null;
  floodStages: FloodStages;
  /** Highest stage first */
  impacts: { stageFt: number; statement: string }[];
  historicCrests: { date: string; stageFt: number; flowCfs: number | null }[];
  /** Last week, hourly */
  observed: StagePoint[];
  forecast: StagePoint[];
  forecastIssuedAt: string | null;
}

export async function fetchRiverGauges(): Promise<RiverGauge[]> {
  const res = await fetch(`${BACKEND_URL}/api/rivers`);
  if (!res.ok) throw new Error(`River gauges unavailable (HTTP ${res.status})`);
  const body = (await res.json()) as { gauges?: RiverGauge[] };
  return body.gauges ?? [];
}

export async function fetchRiverGauge(id: string): Promise<RiverGaugeDetail> {
  const res = await fetch(`${BACKEND_URL}/api/rivers/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`River gauge unavailable (HTTP ${res.status})`);
  return (await res.json()) as RiverGaugeDetail;
}
