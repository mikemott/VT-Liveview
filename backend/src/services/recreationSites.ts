/**
 * Vermont Recreation Sites Service
 * Fetches camping and beach/swimming data from Vermont ANR Open Data API
 *
 * Data Source: Vermont Outdoor Recreation Sites Inventory
 * API: https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_TOURISM_SP_NOCACHE_v2/MapServer/166
 */

import type { RecreationSite, RecreationSiteCache } from '../types/recreation.js';

// =============================================================================
// Types
// =============================================================================

/** Raw API response from ArcGIS REST service */
interface ArcGISFeature {
  attributes: {
    OBJECTID: number;
    SITE_NAME: string;
    S_ADDRESS?: string;
    S_TOWN?: string;
    S_PHONE?: string;
    CONTACT?: string;
    ORGANIZ?: string;
    PUBLIC_PRI?: number; // 1=public, 2=private
    F_CAMP?: string; // 'Y' if camping available
    N_TENTS?: number;
    N_SHELTER?: number;
    N_VEHICLE?: number;
    N_ELECTRY?: number;
    N_WATER?: number;
    N_BOTH?: number; // Sites with both electric & water
    Q_GROUP?: string; // Group camping
    Q_PRIM?: string; // Primitive camping
    Q_WINCAMP?: string; // Winter camping
    AC_SWIMLAK?: string; // Lake swimming
    AB_SWIMPOO?: string; // Pool swimming
    AD_SWIMRIV?: string; // River swimming
    F_BEACH?: number;
    WATER_NM?: string; // Water body name
    Q_BOATRENT?: string; // Boat rental
    Q_PICNIC?: string;
    PLYGND?: string; // Playground
    ACREAGE?: number;
    N_PARKSUM?: number; // Summer parking spaces
  };
  geometry: {
    x: number; // State Plane coordinates
    y: number;
  };
}

interface ArcGISResponse {
  features: ArcGISFeature[];
  exceededTransferLimit?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const API_BASE_URL = 'https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_TOURISM_SP_NOCACHE_v2/MapServer/166/query';

// Vermont State Plane coordinates (EPSG:32145) to WGS84 conversion constants
const STATE_PLANE_TO_WGS84 = {
  // Approximate conversion - for precise conversion would use proj4
  // Vermont State Plane NAD83 (EPSG:32145) offset
  falseEasting: 500000,
  falseNorthing: 0,
  centralMeridian: -72.5,
  latitudeOrigin: 42.5,
  scaleFactor: 0.999964286,
};

// =============================================================================
// Coordinate Conversion
// =============================================================================

/**
 * Convert Vermont State Plane (EPSG:32145) coordinates to WGS84 lat/lng
 * This is a simplified conversion - for production, use proj4 library
 */
function statePlaneToWGS84(x: number, y: number): { lat: number; lng: number } {
  // For Vermont, approximate conversion
  // More accurate conversion would use proj4 or similar library

  // Rough linear approximation for Vermont (good enough for display)
  const lng = STATE_PLANE_TO_WGS84.centralMeridian + (x - STATE_PLANE_TO_WGS84.falseEasting) / 111000 / Math.cos(44.5 * Math.PI / 180);
  const lat = STATE_PLANE_TO_WGS84.latitudeOrigin + y / 111000;

  return { lat, lng };
}

// =============================================================================
// Data Parsing
// =============================================================================

/**
 * Determine site type based on amenities
 */
function determineSiteType(attrs: ArcGISFeature['attributes']): 'camping' | 'beach' | 'mixed' {
  const hasCamping = attrs.F_CAMP === 'Y' || (attrs.N_TENTS ?? 0) > 0 || (attrs.N_VEHICLE ?? 0) > 0;
  const hasSwimming = attrs.AC_SWIMLAK === 'Y' || attrs.AB_SWIMPOO === 'Y' || attrs.AD_SWIMRIV === 'Y' || (attrs.F_BEACH ?? 0) > 0;

  if (hasCamping && hasSwimming) return 'mixed';
  if (hasSwimming) return 'beach';
  return 'camping';
}

/**
 * Parse single recreation site from API feature
 */
function parseRecreationSite(feature: ArcGISFeature): RecreationSite | null {
  const { attributes: a, geometry } = feature;

  // Skip sites without name or coordinates
  if (!a.SITE_NAME || !geometry.x || !geometry.y) {
    return null;
  }

  // Convert State Plane coordinates to WGS84
  const { lat, lng } = statePlaneToWGS84(geometry.x, geometry.y);

  // Validate coordinates are within Vermont bounds
  if (lat < 42.5 || lat > 45.5 || lng < -73.5 || lng > -71.5) {
    return null;
  }

  const siteType = determineSiteType(a);

  // Build amenities object
  const camping = a.F_CAMP === 'Y' ? {
    tentSites: a.N_TENTS ?? 0,
    rvSites: a.N_VEHICLE ?? 0,
    shelters: a.N_SHELTER ?? 0,
    hookups: {
      electric: a.N_ELECTRY ?? 0,
      water: a.N_WATER ?? 0,
      both: a.N_BOTH ?? 0,
    },
    groupCamping: a.Q_GROUP === 'Y',
    primitiveCamping: a.Q_PRIM === 'Y',
    winterCamping: a.Q_WINCAMP === 'Y',
  } : null;

  const swimming = (a.AC_SWIMLAK === 'Y' || a.AB_SWIMPOO === 'Y' || a.AD_SWIMRIV === 'Y' || (a.F_BEACH ?? 0) > 0) ? {
    lakeSwimming: a.AC_SWIMLAK === 'Y',
    poolSwimming: a.AB_SWIMPOO === 'Y',
    riverSwimming: a.AD_SWIMRIV === 'Y',
    hasBeach: (a.F_BEACH ?? 0) > 0,
    waterBodyName: a.WATER_NM ?? null,
  } : null;

  const site: RecreationSite = {
    id: `rec-${a.OBJECTID}`,
    name: a.SITE_NAME,
    type: siteType,
    latitude: lat,
    longitude: lng,
    address: a.S_ADDRESS ?? null,
    town: a.S_TOWN ?? null,
    phone: a.S_PHONE ?? null,
    contact: a.CONTACT ?? null,
    organization: a.ORGANIZ ?? null,
    isPublic: a.PUBLIC_PRI === 1,
    acreage: a.ACREAGE ?? null,
    parkingSpaces: a.N_PARKSUM ?? null,
    amenities: {
      camping,
      swimming,
      boatRental: a.Q_BOATRENT === 'Y',
      picnicArea: a.Q_PICNIC === 'Y',
      playground: a.PLYGND === 'Y',
    },
  };

  return site;
}

// =============================================================================
// API Fetching
// =============================================================================

/**
 * Fetch recreation sites from Vermont ANR API
 */
async function fetchFromAPI(): Promise<RecreationSite[]> {
  // Query for all sites with camping OR swimming
  const params = new URLSearchParams({
    where: "F_CAMP='Y' OR AC_SWIMLAK='Y' OR AB_SWIMPOO='Y' OR AD_SWIMRIV='Y' OR F_BEACH > 0",
    outFields: '*',
    f: 'json',
    returnGeometry: 'true',
  });

  const url = `${API_BASE_URL}?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Vermont ANR API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as ArcGISResponse;

  if (!data.features || data.features.length === 0) {
    throw new Error('No recreation sites returned from API');
  }

  // Check if response was truncated
  if (data.exceededTransferLimit) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`WARNING: Vermont ANR API exceeded transfer limit. Data may be incomplete (received ${data.features.length} features)`);
    }
    // Note: For now we accept partial data. Could implement pagination in the future.
  }

  // Parse features
  const sites = data.features
    .map(parseRecreationSite)
    .filter((site): site is RecreationSite => site !== null);

  // Validate minimum expected sites
  if (sites.length < 20) {
    throw new Error(`Only parsed ${sites.length} sites - expected at least 20`);
  }

  return sites;
}

// =============================================================================
// LRU Cache with 24-hour TTL
// =============================================================================

const recreationCache = new Map<string, RecreationSiteCache>();
let cacheTimeout: ReturnType<typeof setTimeout> | null = null;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch recreation sites with caching
 */
export async function fetchRecreationSites(): Promise<RecreationSite[]> {
  // Check cache first
  const cached = recreationCache.get('sites');
  if (cached) {
    return cached.sites;
  }

  try {
    const sites = await fetchFromAPI();

    // Cache with 24-hour TTL
    const cacheData: RecreationSiteCache = {
      sites,
      fetchedAt: new Date().toISOString(),
    };
    recreationCache.set('sites', cacheData);

    // Set timeout to clear cache
    if (cacheTimeout) clearTimeout(cacheTimeout);
    cacheTimeout = setTimeout(() => {
      recreationCache.clear();
    }, CACHE_TTL_MS);

    return sites;

  } catch (error) {
    // Log error
    if (process.env.NODE_ENV !== 'production') {
      console.error('Recreation sites fetch failed:', error);
    }

    // Return stale cache if available
    const staleCache = recreationCache.get('sites');
    if (staleCache) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Using stale recreation sites cache');
      }
      return staleCache.sites;
    }

    // Last resort: return empty array
    return [];
  }
}

/**
 * Clear the recreation sites cache (for testing/debugging)
 */
export function clearCache(): void {
  recreationCache.clear();
  if (cacheTimeout) {
    clearTimeout(cacheTimeout);
    cacheTimeout = null;
  }
}
