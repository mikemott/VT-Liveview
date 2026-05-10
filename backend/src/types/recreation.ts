/**
 * Recreation Sites Type Definitions
 * Types for camping sites, beaches, and other recreation facilities
 */

/** Recreation site type */
export type RecreationSiteType = 'camping' | 'beach' | 'mixed';

/** Camping amenities */
export interface CampingAmenities {
  tentSites: number;
  rvSites: number;
  shelters: number;
  hookups: {
    electric: number;
    water: number;
    both: number;
  };
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

/** Recreation site */
export interface RecreationSite {
  id: string;
  name: string;
  type: RecreationSiteType;
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

/** Cache entry for recreation sites */
export interface RecreationSiteCache {
  sites: RecreationSite[];
  fetchedAt: string;
}
