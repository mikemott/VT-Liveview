/**
 * Today's climate normals and records (RCC-ACIS) via the backend (VTL-81).
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

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

export async function fetchClimateToday(lat: number, lng: number): Promise<ClimateDay> {
  const res = await fetch(
    `${BACKEND_URL}/api/climate/today?lat=${lat.toFixed(2)}&lon=${lng.toFixed(2)}`,
  );
  if (!res.ok) throw new Error(`Climate normals unavailable (HTTP ${res.status})`);
  return (await res.json()) as ClimateDay;
}
