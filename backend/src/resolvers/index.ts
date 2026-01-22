/**
 * GraphQL Resolvers
 * Maps GraphQL queries to service functions.
 */

import {
  getCurrentWeather,
  getForecast,
  getAlerts,
  getMergedAlerts,
  getObservationStations,
} from '../services/noaa.js';
import { getRadarInfo } from '../services/radar.js';
import { getHistoricalWeather } from '../services/noaaCDO.js';
import type {
  WeatherConditions,
  ForecastPeriod,
  Alert,
  MergedAlert,
  RadarInfo,
  ObservationStation,
} from '../types/index.js';

/**
 * GraphQL resolver arguments
 */
interface CurrentWeatherArgs {
  lat: number;
  lon: number;
}

interface ForecastArgs {
  lat: number;
  lon: number;
}

interface AlertsArgs {
  state: string;
}

interface HistoricalDataArgs {
  lat: number;
  lng: number;
}

/**
 * GraphQL resolvers matching schema.graphql
 */
export const resolvers = {
  Query: {
    currentWeather: async (
      _parent: unknown,
      { lat, lon }: CurrentWeatherArgs
    ): Promise<WeatherConditions> => {
      return await getCurrentWeather(lat, lon);
    },

    forecast: async (
      _parent: unknown,
      { lat, lon }: ForecastArgs
    ): Promise<ForecastPeriod[]> => {
      return await getForecast(lat, lon);
    },

    alerts: async (_parent: unknown, { state }: AlertsArgs): Promise<Alert[]> => {
      return await getAlerts(state);
    },

    mergedAlerts: async (_parent: unknown, { state }: AlertsArgs): Promise<MergedAlert[]> => {
      return await getMergedAlerts(state);
    },

    radarInfo: async (): Promise<RadarInfo> => {
      return await getRadarInfo();
    },

    observationStations: async (): Promise<ObservationStation[]> => {
      return await getObservationStations();
    },

    historicalData: async (_parent: unknown, { lat, lng }: HistoricalDataArgs) => {
      return await getHistoricalWeather(lat, lng);
    },
  },
};
