/**
 * TypeScript types for NOAA Weather API responses and internal data structures.
 * Derived from schema.graphql and NOAA API documentation.
 */

// ============================================================================
// GraphQL Response Types (what we return to clients)
// ============================================================================

export interface WeatherConditions {
  temperature: number | null;
  temperatureUnit: string;
  description: string;
  windSpeed: string | null;
  windDirection: string | null;
  humidity: number | null;
  timestamp: string;
  stationName: string | null;
  icon: string | null;
}

export interface ForecastPeriod {
  name: string;
  temperature: number;
  temperatureUnit: string;
  shortForecast: string;
  detailedForecast: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  icon: string | null;
  windSpeed: string | null;
  windDirection: string | null;
}

export interface Alert {
  id: string;
  event: string;
  headline: string | null;
  severity: string;
  certainty: string;
  urgency: string;
  description: string;
  instruction: string | null;
  areaDesc: string;
  effective: string;
  expires: string;
  geometry: AlertGeometry | null;
}

export interface AlertGeometry {
  type: string;
  coordinates: number[][][][];
}

export interface Location {
  lat: number;
  lng: number;
}

export interface StationWeather {
  temperature: number;
  temperatureUnit: string;
  description: string;
  windSpeed: string | null;
  windDirection: string | null;
  humidity: number | null;
  dewpoint: number | null;
  pressure: number | null;
  timestamp: string;
}

export interface ObservationStation {
  id: string;
  name: string;
  location: Location;
  elevation: number | null;
  weather: StationWeather;
}

export interface RadarTimestamp {
  time: string;
  path: string;
}

export interface RadarInfo {
  baseUrl: string;
  timestamps: RadarTimestamp[];
  tilePattern: string;
}

// ============================================================================
// NOAA API Response Types (raw API responses)
// ============================================================================

export interface NOAAPointsResponse {
  properties: NOAAGridPointProperties;
}

export interface NOAAGridPointProperties {
  gridId: string;
  gridX: number;
  gridY: number;
  forecast: string;
  forecastHourly: string;
  observationStations: string;
  relativeLocation: {
    properties: {
      city: string;
      state: string;
    };
  };
}

export interface NOAAStationsResponse {
  features: NOAAStationFeature[];
}

export interface NOAAStationFeature {
  properties: {
    stationIdentifier: string;
    name: string;
    elevation?: {
      value: number | null;
      unitCode: string;
    };
  };
  geometry: {
    type: string;
    coordinates: [number, number]; // [lon, lat]
  };
}

export interface NOAAObservationResponse {
  properties: NOAAObservationProperties;
}

export interface NOAAObservationProperties {
  timestamp: string | null;
  textDescription: string | null;
  icon: string | null;
  temperature: NOAAQuantitativeValue | null;
  dewpoint: NOAAQuantitativeValue | null;
  windDirection: NOAAQuantitativeValue | null;
  windSpeed: NOAAQuantitativeValue | null;
  barometricPressure: NOAAQuantitativeValue | null;
  relativeHumidity: NOAAQuantitativeValue | null;
}

export interface NOAAQuantitativeValue {
  value: number | null;
  unitCode: string;
  qualityControl?: string;
}

export interface NOAAForecastResponse {
  properties: {
    periods: NOAAForecastPeriod[];
  };
}

export interface NOAAForecastPeriod {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  temperatureTrend: string | null;
  windSpeed: string;
  windDirection: string;
  icon: string;
  shortForecast: string;
  detailedForecast: string;
}

export interface NOAAAlertsResponse {
  features: NOAAAlertFeature[];
}

export interface NOAAAlertFeature {
  properties: {
    id: string;
    event: string;
    headline: string | null;
    severity: string;
    certainty: string;
    urgency: string;
    description: string;
    instruction: string | null;
    areaDesc: string;
    effective: string;
    expires: string;
    affectedZones: string[];  // URLs to zone endpoints (e.g., "https://api.weather.gov/zones/forecast/VTZ001")
  };
  geometry: {
    type: string;
    coordinates: number[][][][];
  } | null;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface StationsCache {
  data: ObservationStation[] | null;
  timestamp: number | null;
  ttl: number;
}

export interface ClearCacheResult {
  cleared: boolean;
  timestamp: string;
}

// ============================================================================
// Zone Boundary Types (for alert zone polygon fetching)
// ============================================================================

export interface ZoneBoundary {
  id: string;           // e.g., "VTZ001"
  name: string;         // e.g., "Grand Isle"
  state: string;        // e.g., "VT"
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

export interface ZoneCacheEntry {
  boundary: ZoneBoundary;
  timestamp: number;
}

// ============================================================================
// Merged Alert Types (for combined alerts by event type)
// ============================================================================

export interface MergedAlert {
  id: string;                    // Composite ID (e.g., "merged-extreme-cold-watch")
  event: string;                 // Event type (e.g., "Extreme Cold Watch")
  headline: string | null;       // From most severe alert
  severity: string;              // Highest severity in group
  certainty: string;             // Highest certainty in group
  urgency: string;               // Highest urgency in group
  description: string;           // From most severe alert
  instruction: string | null;    // From most severe alert
  areaDesc: string;              // Combined area descriptions
  effective: string;             // Earliest effective time
  expires: string;               // Latest expires time
  geometry: MergedAlertGeometry;
  mergedFrom: string[];          // Original alert IDs
  affectedZoneIds: string[];     // List of VT zone IDs (e.g., ["VTZ001", "VTZ002"])
}

export interface MergedAlertGeometry {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}
