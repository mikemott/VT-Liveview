/**
 * Map configuration and MapLibre type definitions
 */

import type { Map as MapLibreMap, LngLatBoundsLike } from 'maplibre-gl';

/** Re-export MapLibre types for convenience */
export type {
  Map as MapLibreMap,
  Marker,
  Popup,
  LngLatLike,
  LngLatBoundsLike,
  StyleSpecification,
  LayerSpecification,
  SourceSpecification,
  GeoJSONSource,
} from 'maplibre-gl';

/** Map center coordinates */
export interface MapCenter {
  latitude: number;
  longitude: number;
  zoom: number;
}

/** Map bounds configuration */
export interface MapBounds {
  southwest: [number, number]; // [lng, lat]
  northeast: [number, number]; // [lng, lat]
}

/** Map configuration from constants */
export interface MapConfig {
  minZoom: number;
  maxZoom: number;
  bounds: LngLatBoundsLike;
}

/** Vermont-specific map defaults */
export interface VermontConfig {
  centerLat: number;
  centerLng: number;
  centerZoom: number;
  defaultLat: number;
  defaultLon: number;
  lat: number;
  lng: number;
}

/** Theme mode for map styling */
export type ThemeMode = 'light' | 'dark' | 'auto';

/** Props for map style generation */
export interface MapStyleProps {
  isDark: boolean;
  apiKey: string;
}

/** Map layer visibility state */
export interface LayerVisibility {
  radar: boolean;
  incidents: boolean;
  weatherStations: boolean;
  alerts: boolean;
}

/** Default layer visibility */
export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  radar: true,
  incidents: true,
  weatherStations: false,
  alerts: true,
} as const;

/** Map ref type for components */
export type MapRef = React.MutableRefObject<MapLibreMap | null>;

/** Map initialization state */
export interface MapInitState {
  isLoaded: boolean;
  isStyleLoaded: boolean;
  error: string | null;
}
