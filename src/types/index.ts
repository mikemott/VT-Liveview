/**
 * Central type exports for VT-LiveView
 * Import types from here for convenience
 */

// Weather types
export type {
  TemperatureUnit,
  WindSpeedUnit,
  WeatherConditions,
  ForecastPeriod,
  WeatherAlert,
  ObservationStation,
  SunTimes,
  WeatherResponse,
} from './weather';

// Incident types
export type {
  IncidentType,
  IncidentSeverity,
  IncidentSource,
  IncidentColor,
  IncidentColorMap,
  Incident,
  VT511Incident,
  USGSGauge,
  IncidentFeature,
  IncidentFeatureCollection,
  IncidentFilters,
} from './incidents';
export { DEFAULT_INCIDENT_FILTERS } from './incidents';

// Radar types
export type {
  RadarFrame,
  RadarAnimationState,
  RadarControls,
  UseRadarAnimationReturn,
  RadarConfig,
} from './radar';

// Historical data types
export type {
  WeatherDay,
  HistoricalData,
  HistoricalDataResponse,
} from './historical';

// Detail panel types
export type {
  AlertProperties,
  AlertFeature,
  DetailPanelContent,
} from './detailPanel';

// Map types
export type {
  MapLibreMap,
  Marker,
  Popup,
  LngLatLike,
  LngLatBoundsLike,
  StyleSpecification,
  LayerSpecification,
  SourceSpecification,
  GeoJSONSource,
  MapCenter,
  MapBounds,
  MapConfig,
  VermontConfig,
  ThemeMode,
  MapStyleProps,
  LayerVisibility,
  MapRef,
  MapInitState,
} from './map';
export { DEFAULT_LAYER_VISIBILITY } from './map';

// Environment types
export type { Env } from './env';
export { envSchema, getEnv, isDev, isProd } from './env';
