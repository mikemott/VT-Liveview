/**
 * Historical weather data types
 * Matches backend GraphQL schema for historical data
 */

export interface WeatherDay {
  date: string; // YYYY-MM-DD
  tempMin: number | null;
  tempMax: number | null;
  precipitation: number | null; // inches
  snowfall: number | null; // inches
}

export interface HistoricalData {
  weather: WeatherDay[];
  stationName: string;
  stationDistance: number; // miles
}

export interface HistoricalDataResponse {
  historicalData: HistoricalData;
}
