/**
 * Weather-related type definitions
 * Based on NOAA Weather API responses
 */

/** Temperature unit */
export type TemperatureUnit = 'F' | 'C';

/** Wind speed unit */
export type WindSpeedUnit = 'mph' | 'km/h';

/** Weather conditions from current observations */
export interface WeatherConditions {
  temperature: number;
  temperatureUnit: TemperatureUnit;
  humidity: number | null;
  windSpeed: string | null;
  windDirection: string | null;
  textDescription: string;
  icon: string | null;
  timestamp: string;
}

/** Forecast period from NOAA API */
export interface ForecastPeriod {
  number: number;
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: TemperatureUnit;
  temperatureTrend: string | null;
  probabilityOfPrecipitation: {
    unitCode: string;
    value: number | null;
  };
  windSpeed: string;
  windDirection: string;
  icon: string;
  shortForecast: string;
  detailedForecast: string;
}

/** Weather alert from NOAA API */
export interface WeatherAlert {
  id: string;
  areaDesc: string;
  geocode: {
    SAME: string[];
    UGC: string[];
  };
  affectedZones: string[];
  references: Array<{
    '@id': string;
    identifier: string;
    sender: string;
    sent: string;
  }>;
  sent: string;
  effective: string;
  onset: string | null;
  expires: string;
  ends: string | null;
  status: 'Actual' | 'Exercise' | 'System' | 'Test' | 'Draft';
  messageType: 'Alert' | 'Update' | 'Cancel' | 'Ack' | 'Error';
  category: string;
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
  certainty: 'Observed' | 'Likely' | 'Possible' | 'Unlikely' | 'Unknown';
  urgency: 'Immediate' | 'Expected' | 'Future' | 'Past' | 'Unknown';
  event: string;
  sender: string;
  senderName: string;
  headline: string | null;
  description: string;
  instruction: string | null;
  response: string;
  parameters: Record<string, string[]>;
}

/** Weather observation station */
export interface ObservationStation {
  id: string;
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: {
    '@id': string;
    '@type': 'wx:ObservationStation';
    elevation: {
      unitCode: string;
      value: number;
    };
    stationIdentifier: string;
    name: string;
    timeZone: string;
    forecast: string;
    county: string;
    fireWeatherZone: string;
  };
}

/** Sunrise/sunset data for theme switching */
export interface SunTimes {
  sunrise: Date;
  sunset: Date;
}

/** GraphQL weather response */
export interface WeatherResponse {
  currentConditions: WeatherConditions | null;
  forecast: ForecastPeriod[];
  alerts: WeatherAlert[];
}
