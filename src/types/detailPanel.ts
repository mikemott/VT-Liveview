/**
 * DetailPanel content types
 * Defines the different types of content that can be displayed in the detail panel
 */

import type { Incident } from './incidents';
import type { ObservationStation } from './weather';

// Alert feature type (from WeatherMap.tsx)
export interface AlertProperties {
  event: string;
  headline: string;
  severity?: string;
  areaDesc: string;
  description?: string;
  instruction?: string;
  effective?: string;
  expires?: string;
}

export interface AlertFeature {
  type: 'Feature';
  properties: AlertProperties;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  } | null;
}

// Union type for detail panel content
export type DetailPanelContent =
  | { type: 'alert'; data: AlertFeature }
  | { type: 'incident'; data: Incident }
  | { type: 'station'; data: ObservationStation }
  | { type: 'historical'; coordinates: { lat: number; lng: number } }
  | null;
