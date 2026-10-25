/**
 * Shareable map state in the URL hash (VTL-52).
 *
 *   #map=9.25/44.2601/-72.5754&layers=stations,traffic,ski&sel=station:KBTV
 *
 * - map:    zoom/lat/lng
 * - layers: the map layers that are on (anything not listed is off)
 * - sel:    what the detail panel shows: station:<id>, camera:<id>, alert:<id>,
 *           road:<id> (seasonal road), roadwx:<id> (road weather station)
 *           or pt:<lat>,<lng>
 *
 * The hash (not the query string) keeps it client-only: no server round trip,
 * nothing extra in Cloudflare's cache key. Shared links are the exception:
 * they carry the same params in the query so link previews can describe the
 * view (VTL-70, src/utils/sharePreview.ts); main.tsx moves them back here.
 */

/** URL key → app layer id. Short keys keep shared links readable. */
export const LAYER_KEYS = {
  stations: 'weatherStations',
  traffic: 'trafficFlow',
  ski: 'skiResorts',
  creemee: 'creemeeStands',
  camping: 'campingSites',
  beaches: 'beachSites',
  stargazing: 'stargazing',
  cameras: 'trafficCameras',
  seasonal: 'seasonalRoads',
  roadwx: 'roadWeather',
} as const;

export type LayerKey = keyof typeof LAYER_KEYS;
export type LayerId = (typeof LAYER_KEYS)[LayerKey];

export interface MapView {
  zoom: number;
  lat: number;
  lng: number;
}

export type Selection =
  | { type: 'station'; id: string }
  | { type: 'camera'; id: string }
  | { type: 'alert'; id: string }
  | { type: 'road'; id: string }
  | { type: 'roadwx'; id: string }
  | { type: 'poi'; kind: PoiKind; id: string }
  | { type: 'location'; lat: number; lng: number };

/** Points of interest from the side-panel layers (VTL-64): sel=<kind>:<id> */
export const POI_KINDS = ['ski', 'beach', 'creemee', 'camp', 'park', 'darksky'] as const;
export type PoiKind = (typeof POI_KINDS)[number];
const isPoiKind = (k: string): k is PoiKind => (POI_KINDS as readonly string[]).includes(k);

export interface UrlState {
  view?: MapView;
  /** Layer ids that are on. Undefined = not specified (use app defaults). */
  layers?: Set<LayerId>;
  selection?: Selection;
}

// Same limits as the map (minZoom/maxZoom/maxBounds in WeatherMap.tsx)
const ZOOM_RANGE: [number, number] = [5.5, 18];
const LAT_RANGE: [number, number] = [40.5, 47.5];
const LNG_RANGE: [number, number] = [-77.5, -68.5];

const inRange = (n: number, [min, max]: [number, number]): boolean =>
  Number.isFinite(n) && n >= min && n <= max;

/** Ids from upstream feeds; keep them to a safe, URL-friendly character set. */
const SAFE_ID = /^[A-Za-z0-9._:-]{1,200}$/;
/** Camera and point-of-interest ids can be human names ("I-89 SB BERLIN", "A & B"): also allow spaces, & ' ( ) /. */
const SAFE_CAMERA_ID = /^[A-Za-z0-9._:\-&'()/ ]{1,200}$/;

function parseLatLng(text: string, separator: string): { lat: number; lng: number } | null {
  const parts = text.split(separator);
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  return inRange(lat, LAT_RANGE) && inRange(lng, LNG_RANGE) ? { lat, lng } : null;
}

/** Parse a location.hash. Invalid or out-of-range parts are ignored, not thrown. */
export function parseUrlState(hash: string): UrlState {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const state: UrlState = {};

  const map = params.get('map');
  if (map) {
    const [z, ...rest] = map.split('/');
    const zoom = Number(z);
    const point = parseLatLng(rest.join('/'), '/');
    if (inRange(zoom, ZOOM_RANGE) && point) state.view = { zoom, ...point };
  }

  const layers = params.get('layers');
  if (layers !== null) {
    state.layers = new Set(
      layers
        .split(',')
        // Own keys only: 'constructor' or 'toString' must not resolve via the prototype
        .filter((key): key is LayerKey => Object.prototype.hasOwnProperty.call(LAYER_KEYS, key))
        .map((key) => LAYER_KEYS[key]),
    );
  }

  const sel = params.get('sel');
  if (sel) {
    const colon = sel.indexOf(':');
    const kind = sel.slice(0, colon);
    const value = sel.slice(colon + 1);
    if (
      (kind === 'station' || kind === 'alert' || kind === 'road' || kind === 'roadwx') &&
      SAFE_ID.test(value)
    ) {
      state.selection = { type: kind, id: value };
    } else if (kind === 'camera' && SAFE_CAMERA_ID.test(value)) {
      state.selection = { type: 'camera', id: value };
    } else if (isPoiKind(kind) && SAFE_CAMERA_ID.test(value)) {
      state.selection = { type: 'poi', kind, id: value };
    } else if (kind === 'pt') {
      const point = parseLatLng(value, ',');
      if (point) state.selection = { type: 'location', ...point };
    }
  }

  return state;
}

/** Build a hash string (with leading '#') from the current state. */
export function buildUrlHash(state: {
  view: MapView;
  layers: ReadonlySet<LayerId>;
  selection?: Selection | undefined;
}): string {
  const { view, layers, selection } = state;
  const parts = [
    `map=${round(view.zoom, 2)}/${round(view.lat, 4)}/${round(view.lng, 4)}`,
    `layers=${(Object.keys(LAYER_KEYS) as LayerKey[])
      .filter((key) => layers.has(LAYER_KEYS[key]))
      .join(',')}`,
  ];
  if (selection) {
    if (selection.type === 'location') {
      parts.push(`sel=pt:${round(selection.lat, 5)},${round(selection.lng, 5)}`);
    } else if (selection.type === 'poi') {
      if (SAFE_CAMERA_ID.test(selection.id)) {
        parts.push(`sel=${selection.kind}:${encodeURIComponent(selection.id)}`);
      }
    } else if ((selection.type === 'camera' ? SAFE_CAMERA_ID : SAFE_ID).test(selection.id)) {
      parts.push(`sel=${selection.type}:${encodeURIComponent(selection.id)}`);
    }
  }
  return `#${parts.join('&')}`;
}

function round(n: number, digits: number): string {
  return String(Number(n.toFixed(digits)));
}
