/**
 * Camping Areas API Client
 * Fetches grouped camping areas from the backend GraphQL API
 */

import { graphqlClient } from './graphqlClient';
import { gql } from 'graphql-request';

/**
 * Camping area type (grouped sites)
 */
export interface CampingArea {
  id: string;
  name: string;
  type: string; // "state_park", "state_forest", "wildlife_management_area", "other"
  siteCount: number;
  sites: BackcountrySite[];
  centroid: {
    latitude: number;
    longitude: number;
  };
  boundary?: {
    type: string;
    coordinates: number[][][][];
  };
}

/**
 * Individual backcountry site
 */
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

/**
 * GraphQL query for camping areas (without boundaries)
 * Boundaries are huge and not needed for marker placement
 */
const CAMPING_AREAS_QUERY = gql`
  query CampingAreas($minSites: Int, $types: [String!]) {
    campingAreas(minSites: $minSites, types: $types) {
      id
      name
      type
      siteCount
      centroid {
        latitude
        longitude
      }
    }
  }
`;

/**
 * GraphQL query for camping areas with boundaries
 * Only use when boundaries are needed (zoom 10+)
 */
const CAMPING_AREAS_WITH_BOUNDARIES_QUERY = gql`
  query CampingAreasWithBoundaries($minSites: Int, $types: [String!]) {
    campingAreas(minSites: $minSites, types: $types) {
      id
      name
      type
      siteCount
      centroid {
        latitude
        longitude
      }
      boundary {
        type
        coordinates
      }
    }
  }
`;

/**
 * Fetch camping areas with optional filtering
 */
export async function fetchCampingAreas(options?: {
  minSites?: number;
  types?: string[];
  includeBoundaries?: boolean;
}): Promise<CampingArea[]> {
  try {
    const query = options?.includeBoundaries
      ? CAMPING_AREAS_WITH_BOUNDARIES_QUERY
      : CAMPING_AREAS_QUERY;

    const data = await graphqlClient.request<{ campingAreas: CampingArea[] }>(
      query,
      {
        minSites: options?.minSites,
        types: options?.types,
      }
    );

    return data.campingAreas;
  } catch (error) {
    console.error('Error fetching camping areas:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch camping areas');
  }
}
