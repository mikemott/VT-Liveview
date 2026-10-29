/**
 * NWS weather alerts on the map (VTL-85): which ones shade their area without
 * a click, their colours and order, and the area to zoom to.
 */
import type { AlertFeature, AlertGeometry } from '../types';

export const SEVERITY_COLORS = {
  Extreme: '#d00000',
  Severe: '#ff6d00',
  Moderate: '#ffba08',
  Minor: '#3b82f6',
} as const;
export const UNKNOWN_SEVERITY_COLOR = '#8b8b8b';

const SEVERITY_RANK: Record<string, number> = { Extreme: 4, Severe: 3, Moderate: 2, Minor: 1 };

export function severityColor(severity: string | null | undefined): string {
  const colors: Record<string, string> = SEVERITY_COLORS;
  return (severity && colors[severity]) || UNKNOWN_SEVERITY_COLOR;
}

/** Same alert across refetches */
export function alertKey(alert: AlertFeature): string {
  return alert.properties.id || alert.properties.event;
}

/**
 * Warnings (Severe/Extreme: tornado, severe thunderstorm, flash flood...)
 * shade their area as soon as they arrive. Statements and advisories often
 * cover most of the state, so they shade only when opened.
 */
export function isShadedByDefault(alert: AlertFeature): boolean {
  const severity = alert.properties.severity;
  return severity === 'Extreme' || severity === 'Severe';
}

/** Most severe first; equal severities keep NWS order */
export function sortAlerts(alerts: readonly AlertFeature[]): AlertFeature[] {
  const rank = (a: AlertFeature): number => SEVERITY_RANK[a.properties.severity ?? ''] ?? 0;
  return alerts
    .map((alert, i) => ({ alert, i }))
    .sort((a, b) => rank(b.alert) - rank(a.alert) || a.i - b.i)
    .map(({ alert }) => alert);
}

/** [[west, south], [east, north]] of an alert's area, or null if it has none */
export function alertBounds(
  geometry: AlertGeometry | null,
): [[number, number], [number, number]] | null {
  if (!geometry) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        if (lng === undefined || lat === undefined) continue;
        west = Math.min(west, lng);
        east = Math.max(east, lng);
        south = Math.min(south, lat);
        north = Math.max(north, lat);
      }
    }
  }
  if (west === Infinity) return null;
  return [
    [west, south],
    [east, north],
  ];
}
