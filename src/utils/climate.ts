/**
 * Today's forecast against the normal (VTL-81): "High 48°, 6° below normal".
 */
import type { ClimateDay } from '../services/climateApi';
import type { ForecastPeriodData } from '../services/graphqlClient';

/** Within this many degrees counts as "near normal" */
export const NEAR_NORMAL_F = 2;

export interface NormalComparison {
  kind: 'high' | 'low';
  forecastF: number;
  normalF: number;
  /** forecast − normal */
  diffF: number;
  /** e.g. "6° below normal", "near normal" */
  text: string;
}

const vermontDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

export function describeDiff(diffF: number): string {
  if (Math.abs(diffF) <= NEAR_NORMAL_F) return 'near normal';
  return `${Math.abs(diffF)}° ${diffF > 0 ? 'above' : 'below'} normal`;
}

/**
 * Compare the first forecast period with today's normal: a daytime period
 * with the normal high, "Tonight" with the normal low. Only for a period that
 * starts today (Vermont time), since the normals are today's.
 */
export function compareWithNormal(
  period: ForecastPeriodData | undefined,
  climate: ClimateDay | undefined,
): NormalComparison | null {
  if (!period || !climate || vermontDate(period.startTime) !== climate.date) return null;
  if (period.temperatureUnit !== 'F') return null;
  const kind = period.isDaytime ? 'high' : 'low';
  const normalF = kind === 'high' ? climate.normalHighF : climate.normalLowF;
  if (normalF === null) return null;
  const forecastF = Math.round(period.temperature);
  const diffF = forecastF - normalF;
  return { kind, forecastF, normalF, diffF, text: describeDiff(diffF) };
}
