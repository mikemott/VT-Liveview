/**
 * GraphQL Resolvers
 * Maps GraphQL queries to service functions.
 */

import {
  getCurrentWeather,
  getForecast,
  getAlerts,
  getObservationStations,
} from '../services/noaa.js';
import { getRadarInfo } from '../services/radar.js';
import type {
  WeatherConditions,
  ForecastPeriod,
  Alert,
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

    radarInfo: async (): Promise<RadarInfo> => {
      return await getRadarInfo();
    },

    observationStations: async (): Promise<ObservationStation[]> => {
      return await getObservationStations();
    },
  },
};
