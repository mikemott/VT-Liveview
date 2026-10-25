/**
 * Camping area helpers (VTL-64).
 */
import type { CampingArea } from '../services/campingApi';

export const PARK_TYPE_LABELS: Record<string, string> = {
  state_park: 'State park',
  state_forest: 'State forest',
  wildlife_management_area: 'Wildlife management area',
};

/** vtstateparks.com/<slug> for state parks */
export function stateParkUrl(area: Pick<CampingArea, 'name' | 'type'>): string | null {
  if (area.type !== 'state_park') return null;
  const slug = area.name
    .toLowerCase()
    .replace(/\s+state\s+park$/i, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return slug ? `https://vtstateparks.com/${slug}` : null;
}
