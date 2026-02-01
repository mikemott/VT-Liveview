/**
 * Creemee Stands API Client
 *
 * GraphQL client for fetching Vermont creemee stand data.
 */

import { graphqlClient } from './graphqlClient';
import { gql } from 'graphql-request';

export interface CreemeeStand {
  id: string;
  name: string;
  town: string;
  latitude: number;
  longitude: number;
  description?: string;
  specialties?: string[];
  featured: boolean;
}

const CREEMEE_STANDS_QUERY = gql`
  query CreemeeStands {
    creemeeStands {
      id
      name
      town
      latitude
      longitude
      description
      specialties
      featured
    }
  }
`;

/**
 * Fetch all creemee stands
 */
export async function fetchCreemeeStands(): Promise<CreemeeStand[]> {
  try {
    const data = await graphqlClient.request<{ creemeeStands: CreemeeStand[] }>(
      CREEMEE_STANDS_QUERY
    );
    return data.creemeeStands;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('GraphQL error fetching creemee stands:', error);
    }
    throw new Error('Failed to fetch creemee stands');
  }
}
