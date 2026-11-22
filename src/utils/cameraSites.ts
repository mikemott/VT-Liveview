/**
 * Traffic camera sites (VTL-99).
 *
 * VTrans lists each view of a camera site as its own camera: most road
 * weather sites have one looking each way, 40–90 m apart, and I-89 Exit 14
 * has four at the very same point. Drawn one marker per view, they sit on top
 * of each other and people only ever open one. Views close together are
 * grouped into one site: one marker on the map, with the views to switch
 * between in the camera window.
 */
import type { TrafficCamera } from '../services/cameraApi';

/** Views closer than this belong to the same site */
export const SITE_RADIUS_M = 100;

export interface CameraView {
  camera: TrafficCamera;
  /** Button label: "North", "South"… or "View 1", "View 2"… */
  label: string;
}

export interface CameraSite {
  /** The view a click on the site's marker opens: the first online one */
  primary: TrafficCamera;
  /** Every view at the site, in display order (one entry for most sites) */
  views: CameraView[];
}

const DIRECTIONS = ['North', 'South', 'East', 'West'] as const;

function asDirection(word: string | null | undefined): string | null {
  if (!word) return null;
  const w = word.trim().toLowerCase();
  return DIRECTIONS.find((d) => d.toLowerCase() === w) ?? null;
}

/**
 * Which way a view looks. Camera names end with it ("BOLTON I-89 South",
 * "BOLTON I-89 SB RT2 North"), which is more reliable than the feed's
 * direction field (all four Exit 14 views say "North").
 */
export function viewDirection(camera: TrafficCamera): string | null {
  const lastWord = camera.name.trim().split(/\s+/).pop();
  return asDirection(lastWord) ?? asDirection(camera.direction);
}

/** Approximate distance in metres; fine at Vermont's scale */
function distanceM(a: TrafficCamera, b: TrafficCamera): number {
  const mPerDegLat = 111_320;
  const mPerDegLng = mPerDegLat * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot((a.lat - b.lat) * mPerDegLat, (a.lng - b.lng) * mPerDegLng);
}

function labelViews(cameras: TrafficCamera[]): CameraView[] {
  if (cameras.length === 1) {
    const [only] = cameras as [TrafficCamera];
    return [{ camera: only, label: viewDirection(only) ?? 'View 1' }];
  }
  const directions = cameras.map(viewDirection);
  const distinct = new Set(directions);
  if (!directions.includes(null) && distinct.size === cameras.length) {
    return cameras
      .map((camera, i) => ({ camera, label: directions[i] as string }))
      .sort(
        (a, b) =>
          DIRECTIONS.indexOf(a.label as (typeof DIRECTIONS)[number]) -
          DIRECTIONS.indexOf(b.label as (typeof DIRECTIONS)[number]),
      );
  }
  // No usable directions: number them in the feed's own order (CCTV-1, -2…)
  return [...cameras]
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
    .map((camera, i) => ({ camera, label: `View ${i + 1}` }));
}

/** Group cameras into sites. Order follows the first view of each site. */
export function groupCameraSites(cameras: readonly TrafficCamera[]): CameraSite[] {
  // Union-find over pairs closer than SITE_RADIUS_M (~90 cameras, so n² is fine)
  const parent = cameras.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i] as number] as number;
      i = parent[i] as number;
    }
    return i;
  };
  for (let i = 0; i < cameras.length; i++) {
    for (let j = i + 1; j < cameras.length; j++) {
      if (distanceM(cameras[i] as TrafficCamera, cameras[j] as TrafficCamera) < SITE_RADIUS_M) {
        parent[find(j)] = find(i);
      }
    }
  }

  const groups = new Map<number, TrafficCamera[]>();
  cameras.forEach((camera, i) => {
    const root = find(i);
    const group = groups.get(root);
    if (group) group.push(camera);
    else groups.set(root, [camera]);
  });

  return [...groups.values()].flatMap((group) => {
    const views = labelViews(group);
    const primary = views.find((v) => v.camera.online)?.camera ?? views[0]?.camera;
    return primary ? [{ primary, views }] : [];
  });
}

/** Every view at the given camera's site, or [] if it has only the one */
export function siteViewsFor(
  camera: TrafficCamera,
  cameras: readonly TrafficCamera[],
): CameraView[] {
  const site = groupCameraSites(cameras).find((s) =>
    s.views.some((v) => v.camera.id === camera.id),
  );
  return site && site.views.length > 1 ? site.views : [];
}
