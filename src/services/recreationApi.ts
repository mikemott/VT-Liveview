/**
 * Recreation Sites API Service
 * Handles fetching camping and beach/swimming sites from the backend GraphQL API
 */

import { gql } from 'graphql-request';
import { graphqlClient } from './graphqlClient';

// =============================================================================
// GraphQL Response Types
// =============================================================================

/** Camping hookups */
export interface CampingHookups {
  electric: number;
  water: number;
  both: number;
}

/** Camping amenities */
export interface CampingAmenities {
  tentSites: number;
  rvSites: number;
  shelters: number;
  hookups: CampingHookups;
  groupCamping: boolean;
  primitiveCamping: boolean;
  winterCamping: boolean;
}

/** Swimming amenities */
export interface SwimmingAmenities {
  lakeSwimming: boolean;
  poolSwimming: boolean;
  riverSwimming: boolean;
  hasBeach: boolean;
  waterBodyName: string | null;
}

/** All amenities */
export interface RecreationAmenities {
  camping: CampingAmenities | null;
  swimming: SwimmingAmenities | null;
  boatRental: boolean;
  picnicArea: boolean;
  playground: boolean;
}

/** Recreation site from backend */
export interface RecreationSite {
  id: string;
  name: string;
  type: 'camping' | 'beach' | 'mixed';
  latitude: number;
  longitude: number;
  address: string | null;
  town: string | null;
  phone: string | null;
  contact: string | null;
  organization: string | null;
  isPublic: boolean;
  acreage: number | null;
  parkingSpaces: number | null;
  amenities: RecreationAmenities;
}

/** GraphQL query response wrapper */
interface RecreationSitesResponse {
  recreationSites: RecreationSite[];
}

// =============================================================================
// Query Definitions
// =============================================================================

export const RECREATION_SITES_QUERY = gql`
  query GetRecreationSites {
    recreationSites {
      id
      name
      type
      latitude
      longitude
      address
      town
      phone
      contact
      organization
      isPublic
      acreage
      parkingSpaces
      amenities {
        camping {
          tentSites
          rvSites
          shelters
          hookups {
            electric
            water
            both
          }
          groupCamping
          primitiveCamping
          winterCamping
        }
        swimming {
          lakeSwimming
          poolSwimming
          riverSwimming
          hasBeach
          waterBodyName
        }
        boatRental
        picnicArea
        playground
      }
    }
  }
`;

// =============================================================================
// Fetch Functions
// =============================================================================

/**
 * Fetch recreation sites (camping and beaches)
 * @returns Array of recreation sites with amenities
 */
export async function fetchRecreationSites(): Promise<RecreationSite[]> {
  try {
    const data = await graphqlClient.request<RecreationSitesResponse>(
      RECREATION_SITES_QUERY
    );
    return data.recreationSites;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Failed to fetch recreation sites:', error);
    }
    throw new Error('Failed to fetch recreation site data');
  }
}
