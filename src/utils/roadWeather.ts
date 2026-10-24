/**
 * How to present a road weather station's reading (VTL-61).
 */
import type { RoadWeatherStation } from '../services/roadWeatherApi';
import { vermontDateKey } from './seasonalRoads';

export type RoadRisk = 'hazard' | 'freezing' | 'nearFreezing' | 'ok' | 'unknown';

/** Reported surfaces that mean slippery right now */
const SLIPPERY_SURFACE = /ice|icy|snow|frost|slush/i;

export function cToF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

/** Main number on the marker: pavement temperature, else air temperature. */
export function headlineTempF(
  s: Pick<RoadWeatherStation, 'pavementTempC' | 'airTempC'>,
): { value: number; kind: 'pavement' | 'air' } | null {
  if (s.pavementTempC !== null) return { value: cToF(s.pavementTempC), kind: 'pavement' };
  if (s.airTempC !== null) return { value: cToF(s.airTempC), kind: 'air' };
  return null;
}

export function getRoadRisk(s: Pick<RoadWeatherStation, 'surface' | 'pavementTempC'>): RoadRisk {
  if (s.surface && SLIPPERY_SURFACE.test(s.surface)) return 'hazard';
  if (s.pavementTempC === null) return s.surface ? 'ok' : 'unknown';
  const f = cToF(s.pavementTempC);
  if (f <= 32) return 'freezing';
  if (f <= 36) return 'nearFreezing';
  return 'ok';
}

export const ROAD_RISK_LABELS: Record<RoadRisk, string> = {
  hazard: 'Slippery surface reported',
  freezing: 'Pavement at or below freezing',
  nearFreezing: 'Pavement near freezing',
  ok: 'Above freezing',
  unknown: 'No pavement reading',
};

/** Grip coefficient in words (Vaisala-style scale). */
export function describeFriction(friction: number): string {
  if (friction >= 0.7) return 'good grip';
  if (friction >= 0.5) return 'fair grip';
  if (friction >= 0.3) return 'poor grip';
  return 'very poor grip';
}

/** Winter driving season (November–March, Vermont date): layer on by default. */
export function isRoadWeatherSeason(now: Date = new Date()): boolean {
  const key = vermontDateKey(now);
  return key >= '11-01' || key <= '03-31';
}
