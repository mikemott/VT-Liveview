/**
 * Vermont fire danger from Forests, Parks & Recreation (VTL-81).
 *
 * FPR rates five Fire Danger Rating Areas (FDRAs) each morning, March 20 to
 * November 30, on the NFDRS scale (Low, Moderate, High, Very High, Extreme),
 * and publishes them in ANR's public "Vermont Fire Danger - Public" feature
 * service (the source of its daily map). A sixth, geometry-less record holds
 * the statewide notes and preparedness level. No key needed.
 *
 * An area's EditDate only moves when its rating changes; the statewide record
 * is edited every day of the season, so the newest EditDate is "updated".
 */
import { cachedLoader } from './c2c.js';

const SERVICE =
  'https://services5.arcgis.com/Uzks6LSde6r23wwG/arcgis/rest/services/Vermont_Fire_Danger_-_Public/FeatureServer/1/query';
const TTL_MS = 30 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;
const STATEWIDE_FDRA = 6;

/**
 * FPR numbers the areas only; these names follow its town list
 * (Fire Danger Rating Areas with Town List, FPR).
 */
export const FDRA_NAMES: Record<number, string> = {
  1: 'Southern valleys',
  2: 'Southern Green Mountains',
  3: 'Champlain Valley',
  4: 'Central Vermont',
  5: 'Northeast Kingdom',
};

/** Checked against FPR's town list (Oct 2026) */
export const FDRA_DESCRIPTIONS: Record<number, string> = {
  1: 'Bennington, Manchester and Rutland, and the Connecticut River valley from Brattleboro to Norwich',
  2: 'From Readsboro and Wilmington north to Killington, Rochester and Bethel',
  3: 'From the Champlain Islands, Swanton and Enosburg south to Brandon and Benson',
  4: 'Montpelier, Barre, Stowe and Randolph, from Jericho and Cambridge east to Bradford and St. Johnsbury',
  5: 'Newport, Lyndon, Island Pond and the rest of the Northeast Kingdom, west to Jay, Montgomery and Richford',
};

type Ring = [number, number][];
type Geometry =
  { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };

export interface FireDangerArea {
  /** FDRA number, 1-5 */
  id: string;
  name: string;
  description: string;
  /** 1 Low … 5 Extreme; null when not rated */
  rating: number | null;
  /** A point well inside the area, for its marker */
  labelLat: number;
  labelLng: number;
  geometry: Geometry;
}

export interface FireDanger {
  areas: FireDangerArea[];
  /** Statewide notes for the day, if any */
  notes: string | null;
  /** National preparedness-style level 1-5 FPR sets for the state, if any */
  preparedness: number | null;
  /** ISO time of the newest edit */
  updatedAt: string | null;
}

interface RawFeature {
  properties?: {
    FDRA?: number;
    FIREDANGER?: number | null;
    NOTES?: string | null;
    EditDate?: number | null;
    preparedness?: number | null;
  };
  geometry?: Geometry | null;
}

function pointInRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(
  x: number,
  y: number,
  [ax, ay]: [number, number],
  [bx, by]: [number, number],
) {
  const dx = bx - ax;
  const dy = by - ay;
  const t =
    dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

/**
 * A point deep inside the largest polygon: on a grid over its bounding box,
 * the inside point farthest from any edge. Centroids won't do: area 1 is two
 * pieces either side of area 2, so its centroid falls in area 2.
 */
export function labelPoint(geometry: Geometry): [number, number] | null {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const ringArea = (r: Ring): number =>
    Math.abs(
      r.reduce((s, [x, y], i) => {
        const [nx, ny] = r[(i + 1) % r.length]!;
        return s + x * ny - nx * y;
      }, 0),
    ) / 2;
  const largest = polygons
    .filter((p) => p[0] && p[0].length >= 4)
    .sort((a, b) => ringArea(b[0]!) - ringArea(a[0]!))[0];
  if (!largest) return null;
  const outer = largest[0]!;
  const xs = outer.map((c) => c[0]);
  const ys = outer.map((c) => c[1]);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const N = 30;
  let best: { x: number; y: number; d: number } | null = null;
  for (let i = 1; i < N; i++) {
    for (let j = 1; j < N; j++) {
      const x = minX + ((maxX - minX) * i) / N;
      const y = minY + ((maxY - minY) * j) / N;
      if (!pointInRing(x, y, outer) || largest.slice(1).some((hole) => pointInRing(x, y, hole))) {
        continue;
      }
      let d = Infinity;
      for (const ring of largest) {
        for (let k = 0; k < ring.length - 1; k++)
          d = Math.min(d, distToSegment(x, y, ring[k]!, ring[k + 1]!));
      }
      if (!best || d > best.d) best = { x, y, d };
    }
  }
  return best ? [best.x, best.y] : null;
}

const validRating = (r: unknown): r is number =>
  typeof r === 'number' && Number.isInteger(r) && r >= 1 && r <= 5;

/** FPR writes "None" when there are no notes */
const notesText = (s: string | null | undefined): string | null => {
  const t = s?.trim().replace(/\s+/g, ' ');
  return t && !/^none\.?$/i.test(t) ? t : null;
};

export function parseFireDanger(body: unknown): FireDanger {
  const features = (body as { features?: unknown } | null)?.features;
  const result: FireDanger = { areas: [], notes: null, preparedness: null, updatedAt: null };
  if (!Array.isArray(features)) return result;
  let newest = 0;
  for (const f of features as (RawFeature | null)[]) {
    const p = f?.properties;
    if (!p || typeof p.FDRA !== 'number') continue;
    if (typeof p.EditDate === 'number' && p.EditDate > newest) newest = p.EditDate;
    if (p.FDRA === STATEWIDE_FDRA) {
      result.notes = notesText(p.NOTES);
      result.preparedness = validRating(p.preparedness) ? p.preparedness : null;
      continue;
    }
    const name = FDRA_NAMES[p.FDRA];
    const g = f.geometry;
    if (!name || !g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue;
    const label = labelPoint(g);
    if (!label) continue;
    result.areas.push({
      id: String(p.FDRA),
      name,
      description: FDRA_DESCRIPTIONS[p.FDRA] ?? '',
      rating: validRating(p.FIREDANGER) ? p.FIREDANGER : null,
      labelLng: Math.round(label[0] * 1e4) / 1e4,
      labelLat: Math.round(label[1] * 1e4) / 1e4,
      geometry: g,
    });
  }
  result.areas.sort((a, b) => Number(a.id) - Number(b.id));
  result.updatedAt = newest > 0 ? new Date(newest).toISOString() : null;
  return result;
}

export function createFireDangerService() {
  const danger = cachedLoader(TTL_MS, async () => {
    const url = new URL(SERVICE);
    url.searchParams.set('where', '1=1');
    url.searchParams.set('outFields', 'FDRA,FIREDANGER,NOTES,EditDate,preparedness');
    url.searchParams.set('returnGeometry', 'true');
    url.searchParams.set('outSR', '4326');
    // ~300 m simplification keeps the five areas to ~14 KB
    url.searchParams.set('maxAllowableOffset', '0.003');
    url.searchParams.set('geometryPrecision', '4');
    url.searchParams.set('f', 'geojson');
    const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`Fire danger: HTTP ${res.status}`);
    const body = (await res.json()) as { error?: { message?: string } };
    if (body?.error) throw new Error(`Fire danger: ${body.error.message ?? 'error'}`);
    const parsed = parseFireDanger(body);
    if (parsed.areas.length === 0) throw new Error('Fire danger: no rating areas');
    return parsed;
  });

  return {
    get: () => danger.get(),
    /** For tests. */
    reset: () => danger.reset(),
  };
}
