/**
 * DetailPanel content types
 * Defines the different types of content that can be displayed in the detail panel
 */

import type { Incident } from './incidents';
import type { ObservationStation } from './weather';

// Alert feature type (from WeatherMap.tsx)
export interface AlertProperties {
  id?: string;
  event: string;
  headline: string | null;
  severity?: string;
  certainty?: string;
  urgency?: string;
  areaDesc: string;
  description?: string;
  instruction?: string | null;
  effective?: string;
  expires?: string;
  // Merged alert properties
  mergedFrom?: string[];
  affectedZoneIds?: string[];
}

// Alert geometry - supports both Polygon and MultiPolygon
export type AlertGeometry = {
  type: 'Polygon';
  coordinates: number[][][];
} | {
  type: 'MultiPolygon';
  coordinates: number[][][][];
};

export interface AlertFeature {
  type: 'Feature';
  properties: AlertProperties;
  geometry: AlertGeometry | null;
}

// Union type for detail panel content
export type DetailPanelContent =
  | { type: 'alert'; data: AlertFeature }
  | { type: 'incident'; data: Incident }
  | { type: 'station'; data: ObservationStation }
  | { type: 'historical'; coordinates: { lat: number; lng: number } }
  | null;
