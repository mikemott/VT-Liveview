/**
 * useHistoricalData - React Query hook for fetching historical weather data
 */

import { useQuery } from '@tanstack/react-query';
import { graphqlClient } from '../services/graphqlClient';
import { gql } from 'graphql-request';
import type { HistoricalDataResponse } from '../types';

interface UseHistoricalDataParams {
  lat: number;
  lng: number;
  enabled: boolean; // Only fetch when DetailPanel is open
}

const HISTORICAL_DATA_QUERY = gql`
  query HistoricalData($lat: Float!, $lng: Float!) {
    historicalData(lat: $lat, lng: $lng) {
      weather {
        date
        tempMin
        tempMax
        precipitation
        snowfall
      }
      stationName
      stationDistance
    }
  }
`;

export function useHistoricalData({ lat, lng, enabled }: UseHistoricalDataParams) {
  return useQuery({
    queryKey: ['historical-data', lat.toFixed(3), lng.toFixed(3)],
    queryFn: async (): Promise<HistoricalDataResponse> => {
      return await graphqlClient.request(HISTORICAL_DATA_QUERY, { lat, lng });
    },
    enabled,
    staleTime: 60 * 60 * 1000, // 1 hour (matches backend cache)
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
