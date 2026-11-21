/**
 * Where each traffic camera is, in words (VTL-94).
 *
 * The camera feed only has coordinates and a terse name ("BROOKFIELD GUA I-89
 * North"). VTrans's own 511 lookup service (the GIS behind Vermont 511) turns
 * the coordinates into what a driver understands: town and county, the posted
 * interstate mile marker, the nearest exit, the address block on other roads,
 * and the speed limit.
 *
 * Looked up when a camera is first opened, then cached for a week per camera:
 * cameras don't move, and this keeps us to a handful of VTrans calls a day.
 */
import { cachedLoader } from './c2c.js';

export const VTRANS_511_LOOKUP =
  'https://maps.vtrans.vermont.gov/arcgis/rest/services/VTrans511/511lookup/MapServer';

/** Layer ids in the 511lookup map service */
const LAYER = {
  interchanges: 0,
  tenthMile: 3,
  addresses: 17, // E911 address points
  roads: 12,
  towns: 16,
} as const;

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CAMERAS = 300;
const TIMEOUT_MS = 10_000;
const METERS_PER_MILE = 1609.344;

export interface NearestExit {
  number: string;
  name: string;
  /** Straight-line distance from the exit to the camera */
  distanceMi: number;
  /** Which way the camera is from the exit: "north", "southeast"… */
  direction: string;
}

export interface CameraLocation {
  town: string | null;
  county: string | null;
  /** Posted interstate mile marker, to a tenth */
  milepost: number | null;
  nearestExit: NearestExit | null;
  /** The local name of the road here, when it isn't just the route ("Franklin St") */
  streetName: string | null;
  /** "4200 block of US Route 2" on roads without exits */
  addressBlock: string | null;
  speedLimitMph: number | null;
}

export interface CameraPoint {
  lat: number;
  lng: number;
  roadway: string | null;
}

type Fetch = typeof fetch;

interface Feature {
  attributes: Record<string, unknown>;
  geometry?: { x: number; y: number };
}

// ---------------------------------------------------------------------------
// Helpers (exported for tests)
// ---------------------------------------------------------------------------

/** Great-circle distance in miles */
export function milesBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return (2 * 6_371_008.8 * Math.asin(Math.sqrt(a))) / METERS_PER_MILE;
}

const COMPASS = [
  'north',
  'northeast',
  'east',
  'southeast',
  'south',
  'southwest',
  'west',
  'northwest',
];

/** Eight-point compass direction from one point to another */
export function compassDirection(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const dy = toLat - fromLat;
  const dx = (toLng - fromLng) * Math.cos((fromLat * Math.PI) / 180);
  const degrees = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  return COMPASS[Math.round(degrees / 45) % 8]!;
}

const KEEP_UPPER = new Set(['US', 'VT', 'NH', 'NY', 'I']);

/** "US ROUTE 2" → "US Route 2", "ORANGE COUNTY" → "Orange County" */
export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((word) =>
      // "US", "VT" and route numbers like "22A" stay upper case
      KEEP_UPPER.has(word.toUpperCase()) || /\d/.test(word)
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join('');
}

/** "Town of Brookfield" → "Brookfield"; "City of South Burlington" → "South Burlington" */
export function townName(titleName: unknown, townName: unknown): string | null {
  if (typeof titleName === 'string' && titleName.trim()) {
    return titleName.replace(/^(Town|City|Village|Urban Compact)\s+of\s+/i, '').trim();
  }
  return typeof townName === 'string' && townName.trim() ? titleCase(townName.trim()) : null;
}

/** "I-89" → "I089": the interstate's code in VTrans linear referencing */
export function interstateCode(roadway: string | null): string | null {
  const m = roadway ? /^I-(\d{1,3})$/i.exec(roadway.trim()) : null;
  return m ? `I${m[1]!.padStart(3, '0')}` : null;
}

/**
 * Street names an E911 address on this route may use: "US-2" → US ROUTE 2 or
 * ROUTE 2 (not OLD ROUTE 2 or ROUTE 2A).
 */
export function routeAddressPattern(roadway: string | null): RegExp | null {
  const m = roadway ? /^(US|VT)-(\d+[A-Z]?)$/i.exec(roadway.trim()) : null;
  if (!m) return null;
  // VTrans names divided stretches with a direction: "VT ROUTE 105 E"
  return new RegExp(`^(?:${m[1]!.toUpperCase()} )?ROUTE ${m[2]!.toUpperCase()}(?: [NSEW])?$`);
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Street names an address on this road may use: the route's own ("US ROUTE 2")
 * and the local names VTrans gives its segments here ("FRANKLIN ST").
 */
export function streetPattern(
  roadway: string | null,
  localNames: readonly string[],
): RegExp | null {
  const route = routeAddressPattern(roadway);
  const names = localNames.map((n) => escapeRegExp(n.toUpperCase()));
  if (!route && names.length === 0) return null;
  const parts = [route ? route.source.slice(1, -1) : null, ...names].filter(Boolean);
  return new RegExp(`^(?:${parts.join('|')})$`);
}

/** "4220 US ROUTE 2" → "4200 block of US Route 2"; null under 100 */
export function addressBlock(address: string, pattern: RegExp): string | null {
  const m = /^(\d+)\s+(.+)$/.exec(address.trim());
  if (!m) return null;
  const number = Number(m[1]);
  const street = m[2]!;
  if (!pattern.test(street) || number < 100) return null;
  // "US ROUTE 2 N" → "US Route 2": the direction letter only marks a divided stretch
  const name = titleCase(street.replace(/^((?:US |VT )?ROUTE \S+) [NSEW]$/, '$1'));
  return `${Math.floor(number / 100) * 100} block of ${name}`;
}

// ---------------------------------------------------------------------------
// VTrans queries
// ---------------------------------------------------------------------------

async function query(
  fetchImpl: Fetch,
  layer: number,
  point: CameraPoint,
  options: { distanceM?: number; where?: string; fields: string; geometry?: boolean },
): Promise<Feature[]> {
  const params = new URLSearchParams({
    geometry: `${point.lng},${point.lat}`,
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    outSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    where: options.where ?? '1=1',
    outFields: options.fields,
    returnGeometry: String(options.geometry ?? false),
    f: 'json',
  });
  if (options.distanceM) {
    params.set('distance', String(options.distanceM));
    params.set('units', 'esriSRUnit_Meter');
  }
  const response = await fetchImpl(`${VTRANS_511_LOOKUP}/${layer}/query?${params.toString()}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`VTrans lookup returned ${response.status}`);
  const body = (await response.json()) as { features?: Feature[]; error?: { message?: string } };
  // ArcGIS reports errors with HTTP 200
  if (body.error) throw new Error(`VTrans lookup error: ${body.error.message ?? 'unknown'}`);
  return body.features ?? [];
}

function nearest(point: CameraPoint, features: Feature[]): Feature | null {
  let best: Feature | null = null;
  let bestMi = Infinity;
  for (const f of features) {
    if (!f.geometry) continue;
    const mi = milesBetween(point.lat, point.lng, f.geometry.y, f.geometry.x);
    if (mi < bestMi) {
      best = f;
      bestMi = mi;
    }
  }
  return best;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

async function lookupTown(fetchImpl: Fetch, point: CameraPoint) {
  const [town] = await query(fetchImpl, LAYER.towns, point, {
    fields: 'TITLENAME,TOWNNAME,COUNTYNAME',
  });
  if (!town) return { town: null, county: null };
  const county = str(town.attributes.COUNTYNAME);
  return {
    town: townName(town.attributes.TITLENAME, town.attributes.TOWNNAME),
    county: county ? titleCase(county) : null,
  };
}

/** Speed limit and local street names of the camera's road, from VTrans road segments */
async function lookupRoad(fetchImpl: Fetch, point: CameraPoint) {
  if (!point.roadway) return { speedLimitMph: null, localNames: [] as string[] };
  const roads = await query(fetchImpl, LAYER.roads, point, {
    distanceM: 150,
    where: `HWYSIGN='${point.roadway.replace(/'/g, "''")}'`,
    fields: 'SPEEDLIMIT,PRIMARYNAME',
  });
  const limits = roads
    .map((r) => Number(r.attributes.SPEEDLIMIT))
    .filter((n) => Number.isFinite(n) && n > 0);
  const route = routeAddressPattern(point.roadway);
  const localNames = [
    ...new Set(
      roads
        .map((r) => str(r.attributes.PRIMARYNAME))
        .filter((n): n is string => n !== null)
        // "US ROUTE 2" and "INTERSTATE 89 N" are just the route again; ramps aren't streets
        .filter((n) => !/^INTERSTATE\b|\bRAMP\b/.test(n) && !(route && route.test(n))),
    ),
  ];
  return { speedLimitMph: limits.length ? Math.max(...limits) : null, localNames };
}

async function lookupInterstate(fetchImpl: Fetch, point: CameraPoint, code: string) {
  const like = `'${code}%'`;
  const [mileposts, exits] = await Promise.all([
    query(fetchImpl, LAYER.tenthMile, point, {
      distanceM: 300,
      // The main line only ("I089-0000", southbound "I089-0000S"). Ramps
      // ("I089-0000NR014G") carry their own mileage from 0
      where: `TWN_LR IN ('${code}-0000','${code}-0000S')`,
      fields: 'TWN_MM',
      geometry: true,
    }),
    query(fetchImpl, LAYER.interchanges, point, {
      distanceM: 40_000,
      // LR_TWN, not LR_ETE: one I-89 exit is filed under "I098" in LR_ETE
      where: `LR_TWN LIKE ${like}`,
      fields: 'ExitNumber,InterchangeName',
      geometry: true,
    }),
  ]);
  const mp = nearest(point, mileposts);
  const milepost = mp ? Number(mp.attributes.TWN_MM) : NaN;
  const exit = nearest(point, exits);
  let nearestExit: NearestExit | null = null;
  if (exit?.geometry && str(exit.attributes.ExitNumber)) {
    const { x, y } = exit.geometry;
    nearestExit = {
      number: str(exit.attributes.ExitNumber)!,
      name: (str(exit.attributes.InterchangeName) ?? '').replace(/\s+-\s+/g, '–'),
      distanceMi: Math.round(milesBetween(y, x, point.lat, point.lng) * 10) / 10,
      direction: compassDirection(y, x, point.lat, point.lng),
    };
  }
  return { milepost: Number.isFinite(milepost) ? milepost : null, nearestExit };
}

async function lookupAddressBlock(fetchImpl: Fetch, point: CameraPoint, pattern: RegExp) {
  const addresses = await query(fetchImpl, LAYER.addresses, point, {
    distanceM: 400,
    fields: 'PRIMARYADDRESS',
    geometry: true,
  });
  const onRoute = addresses.filter((a) => {
    const address = str(a.attributes.PRIMARYADDRESS);
    return address !== null && addressBlock(address, pattern) !== null;
  });
  const best = nearest(point, onRoute);
  return best ? addressBlock(str(best.attributes.PRIMARYADDRESS)!, pattern) : null;
}

/** Everything VTrans can tell us about where this camera is */
export async function lookupCameraLocation(
  fetchImpl: Fetch,
  point: CameraPoint,
): Promise<CameraLocation> {
  const code = interstateCode(point.roadway);
  const [place, road, interstate] = await Promise.all([
    lookupTown(fetchImpl, point),
    lookupRoad(fetchImpl, point),
    code ? lookupInterstate(fetchImpl, point, code) : null,
  ]);
  // Interstates have mile markers and exits; other roads get an address block
  const pattern = code ? null : streetPattern(point.roadway, road.localNames);
  const block = pattern ? await lookupAddressBlock(fetchImpl, point, pattern) : null;
  return {
    ...place,
    milepost: interstate?.milepost ?? null,
    nearestExit: interstate?.nearestExit ?? null,
    // Interstate segments named otherwise are ramps and median U-turns
    streetName: !code && road.localNames[0] ? titleCase(road.localNames[0]) : null,
    addressBlock: block,
    speedLimitMph: road.speedLimitMph,
  };
}

/**
 * Cached lookups, one per camera, least recently used dropped first. A failed
 * refresh keeps serving the last answer.
 */
export function createCameraLocationService(fetchImpl: Fetch = fetch) {
  const loaders = new Map<string, ReturnType<typeof cachedLoader<CameraLocation>>>();
  return {
    get(id: string, point: CameraPoint): Promise<CameraLocation> {
      let loader = loaders.get(id);
      if (loader) {
        loaders.delete(id);
      } else {
        if (loaders.size >= MAX_CAMERAS) {
          const oldest = loaders.keys().next().value;
          if (oldest !== undefined) loaders.delete(oldest);
        }
        loader = cachedLoader(TTL_MS, () => lookupCameraLocation(fetchImpl, point));
      }
      loaders.set(id, loader);
      return loader.get();
    },
  };
}
