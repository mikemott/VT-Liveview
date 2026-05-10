/**
 * Backcountry Campsites Type Definitions
 * Types for individual campsites, lean-tos, shelters, cabins, and cottages
 */

/** Backcountry campsite */
export interface BackcountrySite {
  id: string;
  siteId: string; // Site identifier/name
  siteType: string; // Tent Site, Lean-to, Cabin, Cottage, Prime Tent Site, Prime Lean-to
  latitude: number;
  longitude: number;
  isAccessible: boolean; // ADA accessible
  hasFirePit: boolean;
  hasPicnicTable: boolean;
  notes: string | null;
  parkId: number | null; // ANR Unit identifier (may be null)
  districtId: number | null; // Park district (may be null)
}

/** Cache entry for backcountry sites */
export interface BackcountrySiteCache {
  sites: BackcountrySite[];
  fetchedAt: string;
}

/** Park boundary polygon */
export interface ParkBoundary {
  id: string;
  anrUnit: number; // Matches campsite parkId
  name: string; // Park/forest name
  unitType: string; // SF=State Forest, SP=State Park, WMA=Wildlife Management Area
  acreage: number;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

/** Cache entry for park boundaries */
export interface ParkBoundaryCache {
  boundaries: ParkBoundary[];
  fetchedAt: string;
}

/** Grouped camping area with sites */
export interface CampingArea {
  id: string;
  name: string; // e.g., "Mount Mansfield State Park"
  type: string; // "state_park", "state_forest", "dispersed"
  siteCount: number;
  sites: BackcountrySite[];
  centroid: {
    latitude: number;
    longitude: number;
  };
  boundary?: {
    type: 'MultiPolygon'; // Always MultiPolygon (Polygons are normalized)
    coordinates: number[][][][]; // GeoJSON MultiPolygon coordinates
  };
}
