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
