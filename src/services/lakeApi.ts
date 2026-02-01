/**
 * Lake Temperature API Service
 * Handles fetching lake temperature data from the backend GraphQL API
 */

import { gql } from 'graphql-request';
import { graphqlClient } from './graphqlClient';

// =============================================================================
// GraphQL Response Types
// =============================================================================

/** Lake temperature data from backend */
export interface LakeTemperature {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  temperatureFahrenheit: number | null;
  comfortLevel: 'cold' | 'comfortable' | 'warm' | 'unknown';
  timestamp: string;
  usgsGaugeId: string | null;
  description: string | null;
}

/** GraphQL query response wrapper */
interface LakeTemperaturesResponse {
  lakeTemperatures: LakeTemperature[];
}

// =============================================================================
// Query Definitions
// =============================================================================

export const LAKE_TEMPERATURES_QUERY = gql`
  query GetLakeTemperatures {
    lakeTemperatures {
      id
      name
      latitude
      longitude
      temperatureFahrenheit
      comfortLevel
      timestamp
      usgsGaugeId
      description
    }
  }
`;

// =============================================================================
// Fetch Functions
// =============================================================================

/**
 * Fetch lake temperature data
 * @returns Array of lakes with current temperature data
 */
export async function fetchLakeTemperatures(): Promise<LakeTemperature[]> {
  try {
    const data = await graphqlClient.request<LakeTemperaturesResponse>(
      LAKE_TEMPERATURES_QUERY
    );
    return data.lakeTemperatures;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Failed to fetch lake temperatures:', error);
    }
    throw new Error('Failed to fetch lake temperature data');
  }
}
