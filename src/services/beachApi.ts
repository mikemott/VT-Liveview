import { graphqlClient } from './graphqlClient';
import { gql } from 'graphql-request';

export interface Beach {
  id: string;
  name: string;
  town: string;
  latitude: number;
  longitude: number;
  parkType: string;
  amenities: string[];
  waterQualityGrade: string | null;
  waterTemp: number | null;
  eColiLevel: number | null;
  cyanobacteriaCategory: number | null;
  lastTested: string | null;
  advisory: string | null;
  status: 'open' | 'alert' | 'closed' | 'unknown';
  color: 'green' | 'yellow' | 'red';
  lastUpdated: string;
}

const BEACHES_QUERY = gql`
  query Beaches {
    beaches {
      id
      name
      town
      latitude
      longitude
      parkType
      amenities
      waterQualityGrade
      waterTemp
      eColiLevel
      cyanobacteriaCategory
      lastTested
      advisory
      status
      color
      lastUpdated
    }
  }
`;

export async function fetchBeaches(): Promise<Beach[]> {
  const data = await graphqlClient.request(BEACHES_QUERY);
  return data.beaches;
}
