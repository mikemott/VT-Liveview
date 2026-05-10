/**
 * Backcountry Campsites API Service
 * Handles fetching backcountry campsites from the backend GraphQL API
 */

import { gql } from 'graphql-request';
import { graphqlClient } from './graphqlClient';

// =============================================================================
// GraphQL Response Types
// =============================================================================

/** Backcountry campsite from backend */
export interface BackcountrySite {
  id: string;
  siteId: string;
  siteType: string;
  latitude: number;
  longitude: number;
  isAccessible: boolean;
  hasFirePit: boolean;
  hasPicnicTable: boolean;
  notes: string | null;
  parkId: number | null;
  districtId: number | null;
}

/** GraphQL query response wrapper */
interface BackcountrySitesResponse {
  backcountrySites: BackcountrySite[];
}

// =============================================================================
// Query Definitions
// =============================================================================

export const BACKCOUNTRY_SITES_QUERY = gql`
  query GetBackcountrySites {
    backcountrySites {
      id
      siteId
      siteType
      latitude
      longitude
      isAccessible
      hasFirePit
      hasPicnicTable
      notes
      parkId
      districtId
    }
  }
`;

// =============================================================================
// Fetch Functions
// =============================================================================

/**
 * Fetch backcountry campsites
 * @returns Array of backcountry campsites
 */
export async function fetchBackcountrySites(): Promise<BackcountrySite[]> {
  try {
    const data = await graphqlClient.request<BackcountrySitesResponse>(
      BACKCOUNTRY_SITES_QUERY
    );
    return data.backcountrySites;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Failed to fetch backcountry sites:', error);
    }
    throw new Error('Failed to fetch backcountry campsite data');
  }
}
