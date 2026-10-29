/**
 * Vermont fire danger ratings (FPR) via the backend (VTL-81).
 */
import type { Polygon, MultiPolygon } from 'geojson';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export interface FireDangerArea {
  /** Fire Danger Rating Area number, 1-5 */
  id: string;
  name: string;
  description: string;
  /** 1 Low … 5 Extreme; null when not rated */
  rating: number | null;
  labelLat: number;
  labelLng: number;
  geometry: Polygon | MultiPolygon;
}

export interface FireDanger {
  areas: FireDangerArea[];
  notes: string | null;
  preparedness: number | null;
  /** ISO time of FPR's newest edit */
  updatedAt: string | null;
}

export async function fetchFireDanger(): Promise<FireDanger> {
  const res = await fetch(`${BACKEND_URL}/api/fire-danger`);
  if (!res.ok) throw new Error(`Fire danger unavailable (HTTP ${res.status})`);
  return (await res.json()) as FireDanger;
}

/** What the side panel shows: an area plus the day's statewide details */
export type FireDangerAreaView = FireDangerArea &
  Pick<FireDanger, 'notes' | 'preparedness' | 'updatedAt'>;

export const areaView = (area: FireDangerArea, danger: FireDanger): FireDangerAreaView => ({
  ...area,
  notes: danger.notes,
  preparedness: danger.preparedness,
  updatedAt: danger.updatedAt,
});
