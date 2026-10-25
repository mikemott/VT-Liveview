/**
 * What's around a point, for the "What's here?" panel (VTL-65).
 */
import type { AlertFeature, LocationContext, NearbyItem } from '../types/detailPanel';
import type { RoadWeatherStation } from '../services/roadWeatherApi';
import type { TrafficCamera } from '../services/cameraApi';
import type { TravelIncident } from '../services/travelApi';
import { distanceMiles, pointInGeometry } from './geo';
import { isFullClosure } from './seasonalRoads';

/** Road temps and cameras farther than this aren't "near" */
export const NEARBY_MI = 15;
/** Closures and accidents worth mentioning */
export const INCIDENT_MI = 10;
const MAX_INCIDENTS = 3;

interface Sources {
  alerts: readonly AlertFeature[];
  roadWeather: readonly RoadWeatherStation[];
  cameras: readonly TrafficCamera[];
  incidents: readonly TravelIncident[];
}

function nearest<T>(
  items: readonly T[],
  at: (item: T) => [number, number],
  lat: number,
  lng: number,
): { item: T; d: number } | null {
  let best: { item: T; d: number } | null = null;
  for (const item of items) {
    const [iLat, iLng] = at(item);
    const d = distanceMiles(lat, lng, iLat, iLng);
    if (!best || d < best.d) best = { item, d };
  }
  return best;
}

export function buildLocationContext(lat: number, lng: number, src: Sources): LocationContext {
  const alerts = src.alerts.filter((a) => pointInGeometry([lng, lat], a.geometry));

  const nearby: NearbyItem[] = [];
  const rw = nearest(src.roadWeather, (s) => [s.lat, s.lng], lat, lng);
  if (rw && rw.d <= NEARBY_MI)
    nearby.push({ kind: 'roadWeather', distanceMi: rw.d, data: rw.item });
  const cam = nearest(
    src.cameras.filter((c) => c.online),
    (c) => [c.lat, c.lng],
    lat,
    lng,
  );
  if (cam && cam.d <= NEARBY_MI) nearby.push({ kind: 'camera', distanceMi: cam.d, data: cam.item });

  const incidents = src.incidents
    .filter((i) => i.type === 'ACCIDENT' || (i.type !== 'FLOODING' && isFullClosure(i)))
    .filter((i) => i.location?.lat && i.location?.lng)
    .map((i) => ({ i, d: distanceMiles(lat, lng, i.location.lat, i.location.lng) }))
    .filter(({ d }) => d <= INCIDENT_MI)
    .sort((a, b) => a.d - b.d)
    .slice(0, MAX_INCIDENTS);
  for (const { i, d } of incidents) nearby.push({ kind: 'incident', distanceMi: d, data: i });

  return { alerts, nearby };
}

/** "0.4 mi", "3 mi", "12 mi" */
export function formatMiles(d: number): string {
  return d < 1 ? `${d.toFixed(1)} mi` : `${Math.round(d)} mi`;
}
