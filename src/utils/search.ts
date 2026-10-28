/**
 * Place search over towns and the map's loaded features (VTL-53).
 * Small and dependency-free: a few hundred items, ranked by match quality.
 */

import type { LayerStyleKey } from '../config/layers';

export type SearchKind =
  | 'town'
  | 'ski'
  | 'beach'
  | 'creemee'
  | 'campground'
  | 'station'
  | 'camera'
  | 'roadWeather'
  | 'airQuality'
  | 'river'
  | 'evCharger'
  | 'road'
  | 'incident';

export interface SearchItem {
  id: string;
  kind: SearchKind;
  /** Main text shown and matched. */
  name: string;
  /** Secondary line, e.g. county or town. Also matched, with lower weight. */
  detail?: string;
  /** Extra text that is matched but not shown (e.g. an incident's road). */
  keywords?: string;
  lat: number;
  lng: number;
  /** [west, south, east, north] to fit instead of flying to the point. */
  bounds?: [number, number, number, number];
  /** Map layer this result belongs to, when it isn't implied by `kind` (incident type) */
  layer?: LayerStyleKey;
}

/** Lower-case, strip accents and punctuation, expand St./Mt. abbreviations. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bst\b/g, 'saint')
    .replace(/\bmt\b/g, 'mount')
    .trim();
}

/** Tie-break order when scores are equal: towns first, incidents last. */
const KIND_ORDER: Record<SearchKind, number> = {
  town: 0,
  ski: 1,
  station: 2,
  camera: 3,
  roadWeather: 4,
  airQuality: 5,
  river: 6,
  road: 7,
  evCharger: 8,
  campground: 9,
  beach: 10,
  creemee: 11,
  incident: 12,
};

function scoreText(text: string, query: string, tokens: string[]): number {
  if (!text) return 0;
  if (text === query) return 100;
  if (text.startsWith(query)) return 80;
  const words = text.split(' ');
  if (words.some((w) => w.startsWith(query))) return 60;
  // Every query token starts some word (e.g. "burl so" → "South Burlington")
  if (tokens.length > 1 && tokens.every((t) => words.some((w) => w.startsWith(t)))) return 50;
  if (text.includes(query)) return 30;
  return 0;
}

export function searchPlaces(
  items: readonly SearchItem[],
  rawQuery: string,
  limit = 8,
): SearchItem[] {
  const query = normalize(rawQuery);
  if (query.length < 2) return [];
  const tokens = query.split(' ');

  const scored: { item: SearchItem; score: number }[] = [];
  for (const item of items) {
    const score = Math.max(
      scoreText(normalize(item.name), query, tokens),
      scoreText(normalize(item.keywords ?? ''), query, tokens) * 0.9,
      scoreText(normalize(item.detail ?? ''), query, tokens) * 0.5,
    );
    if (score > 0) scored.push({ item, score });
  }

  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        KIND_ORDER[a.item.kind] - KIND_ORDER[b.item.kind] ||
        a.item.name.localeCompare(b.item.name),
    )
    .slice(0, limit)
    .map((s) => s.item);
}
