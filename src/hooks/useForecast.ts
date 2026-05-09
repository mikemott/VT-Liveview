/**
 * useForecast - React Query hook for fetching weather forecast
 */

import { useQuery } from '@tanstack/react-query';
import { graphqlClient } from '../services/graphqlClient';
import { gql } from 'graphql-request';
import type { ForecastPeriod } from '../types/weather';

interface UseForecastParams {
  lat: number;
  lng: number;
  enabled: boolean; // Only fetch when DetailPanel is open
}

interface ForecastResponse {
  forecast: ForecastPeriod[];
}

const FORECAST_QUERY = gql`
  query Forecast($lat: Float!, $lon: Float!) {
    forecast(lat: $lat, lon: $lon) {
      number
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
      probabilityOfPrecipitation {
        value
      }
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
