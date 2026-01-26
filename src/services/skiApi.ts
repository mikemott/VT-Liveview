/**
 * Ski Resort API Service
 * Handles fetching ski resort conditions from the backend GraphQL API
 */

import { gql } from 'graphql-request';
import { graphqlClient } from './graphqlClient';

// =============================================================================
// GraphQL Response Types
// =============================================================================

/** Ski resort conditions from backend */
export interface SkiResort {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  logoUrl: string | null;
  snowfall24hr: number | null;
  snowfallCumulative: number | null;
  liftsOpen: number;
  liftsTotal: number;
  trailsOpen: number;
  trailsTotal: number;
  tempCurrent: number | null;
  tempHigh: number | null;
  tempLow: number | null;
  baseDepth: number | null;
  lastUpdated: string;
  status: string;
  color: string;
}

/** GraphQL query response wrapper */
interface SkiResortsResponse {
  skiResorts: SkiResort[];
}

// =============================================================================
// Query Definitions
// =============================================================================

export const SKI_RESORTS_QUERY = gql`
  query GetSkiResorts {
    skiResorts {
      id
      name
      latitude
      longitude
      logoUrl
      snowfall24hr
      snowfallCumulative
      liftsOpen
      liftsTotal
      trailsOpen
      trailsTotal
      tempCurrent
      tempHigh
      tempLow
      baseDepth
      lastUpdated
      status
      color
    }
  }
`;

// =============================================================================
// Fetch Functions
// =============================================================================

/**
 * Fetch ski resort conditions
 * @returns Array of ski resorts with current conditions
 */
export async function fetchSkiResorts(): Promise<SkiResort[]> {
  try {
    const data = await graphqlClient.request<SkiResortsResponse>(
      SKI_RESORTS_QUERY
    );
    return data.skiResorts;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Failed to fetch ski resorts:', error);
    }
    throw new Error('Failed to fetch ski resort data');
  }
}
