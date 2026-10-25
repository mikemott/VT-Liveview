/**
 * Small geography helpers for "What's here?" (VTL-65).
 */
import { VT_COUNTIES, VT_TOWNS } from '../data/vtTowns';

const EARTH_RADIUS_MI = 3958.8;

/** Great-circle distance in miles */
export function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface NearestTown {
  name: string;
  county: string;
  /** Miles from the point to the town's label point */
  distanceMi: number;
}

/**
 * The town a point is in or near: among towns whose bounding box contains the
 * point, the one with the closest label point; otherwise the closest label
 * point overall (outside Vermont: null beyond 15 miles).
 */
export function nearestTown(lat: number, lng: number): NearestTown | null {
  let best: { row: (typeof VT_TOWNS)[number]; d: number; inBox: boolean } | null = null;
  for (const row of VT_TOWNS) {
    const [, , tLat, tLng, w, s, e, n] = row;
    const inBox = lng >= w && lng <= e && lat >= s && lat <= n;
    const d = distanceMiles(lat, lng, tLat, tLng);
    if (!best || (inBox && !best.inBox) || (inBox === best.inBox && d < best.d)) {
      best = { row, d, inBox };
    }
  }
  if (!best || (!best.inBox && best.d > 15)) return null;
  const [name, county] = best.row;
  return { name, county: VT_COUNTIES[county] ?? '', distanceMi: best.d };
}

type Ring = number[][];

function inRing([x, y]: [number, number], ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Whether [lng, lat] is inside a GeoJSON Polygon / MultiPolygon (holes respected) */
export function pointInGeometry(
  point: [number, number],
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] }
    | null
    | undefined,
): boolean {
  if (!geometry) return false;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(
    ([outer, ...holes]) => !!outer && inRing(point, outer) && !holes.some((h) => inRing(point, h)),
  );
}
