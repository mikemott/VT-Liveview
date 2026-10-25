/**
 * useForecast - React Query hook for fetching weather forecast
 */

import { useQuery } from '@tanstack/react-query';
import { graphqlClient } from '../services/graphqlClient';
import { gql } from 'graphql-request';

interface UseForecastParams {
  lat: number;
  lng: number;
  enabled: boolean; // Only fetch when DetailPanel is open
}

/** A forecast period as the backend's GraphQL schema serves it */
export interface PointForecastPeriod {
  name: string;
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string | null;
  windDirection: string | null;
  icon: string | null;
  shortForecast: string;
  detailedForecast: string;
  /** Chance of precipitation, 0–100 */
  precipChance: number | null;
}

interface ForecastResponse {
  forecast: PointForecastPeriod[];
}

// Only fields the schema has: asking for one it doesn't (e.g. `number`)
// fails validation and the whole request with it (VTL-65)
const FORECAST_QUERY = gql`
  query Forecast($lat: Float!, $lon: Float!) {
    forecast(lat: $lat, lon: $lon) {
      name
      startTime
      endTime
      isDaytime
      temperature
      temperatureUnit
      windSpeed
      windDirection
      icon
      shortForecast
      detailedForecast
      precipChance
    }
  }
`;

export function useForecast({ lat, lng, enabled }: UseForecastParams) {
  return useQuery({
    queryKey: ['forecast', lat.toFixed(3), lng.toFixed(3)],
    queryFn: async (): Promise<ForecastResponse> => {
      // GraphQL schema uses 'lon' not 'lng'
      return await graphqlClient.request(FORECAST_QUERY, { lat, lon: lng });
    },
    enabled,
    staleTime: 30 * 60 * 1000, // 30 minutes (forecasts update frequently)
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
