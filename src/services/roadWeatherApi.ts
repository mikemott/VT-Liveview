/**
 * VTrans road weather stations via the backend (VTL-61).
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export interface RoadWeatherStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  roadway: string | null;
  direction: string | null;
  location: string | null;
  surface: string | null;
  pavementTempC: number | null;
  airTempC: number | null;
  dewPointC: number | null;
  friction: number | null;
  precip: string | null;
  observedAt: string | null;
}

export async function fetchRoadWeather(): Promise<RoadWeatherStation[]> {
  const res = await fetch(`${BACKEND_URL}/api/road-weather`);
  if (!res.ok) throw new Error(`Road weather unavailable (HTTP ${res.status})`);
  const body = (await res.json()) as { stations?: RoadWeatherStation[] };
  return body.stations ?? [];
}
