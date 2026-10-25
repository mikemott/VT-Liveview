/**
 * Whether a ski area is reporting conditions (VTL-64).
 *
 * The scraper defaults lift/trail totals to 1 when a resort isn't reporting
 * (e.g. off-season), so "0/1" means "no data", not "1 lift, closed".
 */
import type { SkiResort } from '../services/skiApi';

type SkiReport = Pick<
  SkiResort,
  | 'snowfall24hr'
  | 'trailsOpen'
  | 'trailsTotal'
  | 'liftsOpen'
  | 'liftsTotal'
  | 'tempCurrent'
  | 'baseDepth'
  | 'snowfallCumulative'
>;

export function isSkiReporting(r: SkiReport): boolean {
  const counts = (open: number, total: number): boolean => open > 0 || total > 1;
  return (
    r.snowfall24hr !== null ||
    r.baseDepth !== null ||
    r.snowfallCumulative !== null ||
    r.tempCurrent !== null ||
    counts(r.trailsOpen, r.trailsTotal) ||
    counts(r.liftsOpen, r.liftsTotal)
  );
}

/** Marker fills: darker than the chip palette so the white icon reads */
export const SKI_STATUS_FILL = {
  green: '#16a34a',
  yellow: '#a16207',
  red: '#dc2626',
  off: '#64748b', // not reporting
} as const;
