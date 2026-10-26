/**
 * Air quality (EPA AirNow) via the backend (VTL-75).
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

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

export async function fetchAirQuality(lat: number, lng: number): Promise<PointAirQuality> {
  const res = await fetch(
    `${BACKEND_URL}/api/air-quality?lat=${lat.toFixed(2)}&lon=${lng.toFixed(2)}`,
  );
  if (!res.ok) throw new Error(`Air quality unavailable (HTTP ${res.status})`);
  return (await res.json()) as PointAirQuality;
}

export async function fetchAirQualityMonitors(): Promise<AirQualityMonitor[]> {
  const res = await fetch(`${BACKEND_URL}/api/air-quality/monitors`);
  if (!res.ok) throw new Error(`Air quality monitors unavailable (HTTP ${res.status})`);
  const body = (await res.json()) as { monitors?: AirQualityMonitor[] };
  return body.monitors ?? [];
}
