/**
 * Camping Areas Grouping Service
 * Groups individual campsites by park boundaries for better map display
 */

import { fetchBackcountrySites } from './backcountrySites.js';
import { fetchParkBoundaries } from './parkBoundaries.js';
import type { BackcountrySite, ParkBoundary, CampingArea } from '../types/backcountry.js';

// =============================================================================
// Grouping Logic
// =============================================================================

/**
 * Calculate centroid (average position) from array of campsites
 */
function calculateCentroid(sites: BackcountrySite[]): { latitude: number; longitude: number } {
  const sum = sites.reduce(
    (acc, site) => ({
      lat: acc.lat + site.latitude,
      lng: acc.lng + site.longitude,
    }),
    { lat: 0, lng: 0 }
  );

  return {
    latitude: sum.lat / sites.length,
    longitude: sum.lng / sites.length,
  };
}

/**
 * Determine park type from unit type code
 */
function determineParkType(unitType: string): string {
  if (unitType === 'SP') return 'state_park';
  if (unitType === 'SF') return 'state_forest';
  if (unitType === 'WMA') return 'wildlife_management_area';
  return 'other';
}

/**
 * Normalize geometry to MultiPolygon format
 * GraphQL schema expects MultiPolygon, so convert Polygon to MultiPolygon
 */
function normalizeGeometryToMultiPolygon(geometry: {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
}): {
  type: 'MultiPolygon';
  coordinates: number[][][][];
} {
  if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates as number[][][][],
    };
  }

  // Convert Polygon to MultiPolygon by wrapping in an array
  return {
    type: 'MultiPolygon',
    coordinates: [geometry.coordinates as number[][][]],
  };
}

/**
 * Group campsites by park boundaries using ANRUnit matching
 */
export async function groupCampsitesByArea(): Promise<CampingArea[]> {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[campingAreas] Grouping campsites by area...');
  }

  // Fetch both datasets in parallel
  const [sites, boundaries] = await Promise.all([
    fetchBackcountrySites(),
    fetchParkBoundaries(),
  ]);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[campingAreas] Fetched ${sites.length} sites and ${boundaries.length} park boundaries`);
  }

  // Create a map of ANRUnit -> ParkBoundary for fast lookup
  const boundaryMap = new Map<number, ParkBoundary>();
  for (const boundary of boundaries) {
    boundaryMap.set(boundary.anrUnit, boundary);
  }

  // Group sites by parkId (ANRUnit)
  const groupedSites = new Map<number | null, BackcountrySite[]>();

  for (const site of sites) {
    const parkId = site.parkId;
    if (!groupedSites.has(parkId)) {
      groupedSites.set(parkId, []);
    }
    groupedSites.get(parkId)!.push(site);
  }

  // Convert to CampingArea objects
  const areas: CampingArea[] = [];

  for (const [parkId, sitesInPark] of groupedSites.entries()) {
    if (parkId === null || sitesInPark.length === 0) {
      continue;
    }

    const boundary = boundaryMap.get(parkId);

    if (boundary) {
      // Sites with a matching boundary
      const area: CampingArea = {
        id: `area-${parkId}`,
        name: boundary.name,
        type: determineParkType(boundary.unitType),
        siteCount: sitesInPark.length,
        sites: sitesInPark,
        centroid: calculateCentroid(sitesInPark),
        boundary: normalizeGeometryToMultiPolygon(boundary.geometry),
      };
      areas.push(area);
    } else {
      // Sites without a boundary (shouldn't happen often)
      const area: CampingArea = {
        id: `area-unknown-${parkId}`,
        name: `Park Unit ${parkId}`,
        type: 'other',
        siteCount: sitesInPark.length,
        sites: sitesInPark,
        centroid: calculateCentroid(sitesInPark),
      };
      areas.push(area);
    }
  }

  // Sort by site count (descending)
  areas.sort((a, b) => b.siteCount - a.siteCount);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[campingAreas] Created ${areas.length} camping areas`);
    if (areas.length > 0) {
      console.log(`[campingAreas] Top 3 areas by site count:`, areas.slice(0, 3).map(a => `${a.name} (${a.siteCount} sites)`));
    }
  }

  return areas;
}

/**
 * Get camping areas with optional filtering
 */
export async function getCampingAreas(options?: {
  minSites?: number;
  types?: string[];
}): Promise<CampingArea[]> {
  let areas = await groupCampsitesByArea();

  // Apply filters
  if (options?.minSites !== undefined) {
    const minSites = options.minSites;
    areas = areas.filter(area => area.siteCount >= minSites);
  }

  if (options?.types && options.types.length > 0) {
    areas = areas.filter(area => options.types!.includes(area.type));
  }

  return areas;
}
