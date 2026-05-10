/**
 * Vermont Backcountry Campsites Service
 * Fetches individual campsites from Vermont State Parks
 *
 * Data Source: Vermont State Parks Infrastructure - CAMPSITES
 * API: https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_TOURISM_SP_NOCACHE_v2/MapServer/175
 *
 * Coverage: ~1,400 individual campsites including tent sites, lean-tos, shelters, cabins, and cottages
 */

import type { BackcountrySite, BackcountrySiteCache } from '../types/backcountry.js';

// =============================================================================
// Types
// =============================================================================

/** Raw API response from ArcGIS REST service */
interface ArcGISFeature {
  attributes: {
    OBJECTID: number;
    Site: string; // Site identifier/name
    Type: number; // 1=Lean-to, 2=Cabin, 3=Cottage, 4=Tentsite, 5=Prime Lean-to, 6=Prime Tentsite
    Surface: number; // Surface type code
    ADA: number; // 0=No, 1=Yes
    FireType: number; // Fire pit type code
    Table_: number; // Picnic table (0=No, 1=Yes, 2=Yes)
    ANRUnit: number; // Park identifier
    ParkDistrict: number; // District code
    Notes: string | null; // Site notes
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

const API_BASE_URL = 'https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_TOURISM_SP_NOCACHE_v2/MapServer/175/query';

// Vermont State Plane coordinates (EPSG:32145) to WGS84 conversion constants
const STATE_PLANE_TO_WGS84 = {
  falseEasting: 500000,
  falseNorthing: 0,
  centralMeridian: -72.5,
  latitudeOrigin: 42.5,
};

// Type code mappings
const SITE_TYPE_MAP: Record<number, string> = {
  1: 'Lean-to',
  2: 'Cabin',
  3: 'Cottage',
  4: 'Tent Site',
  5: 'Prime Lean-to',
  6: 'Prime Tent Site',
};

// =============================================================================
// Coordinate Conversion
// =============================================================================

/**
 * Convert Vermont State Plane (EPSG:32145) coordinates to WGS84 lat/lng
 */
function statePlaneToWGS84(x: number, y: number): { lat: number; lng: number } {
  // Rough linear approximation for Vermont (good enough for display)
  const lng = STATE_PLANE_TO_WGS84.centralMeridian + (x - STATE_PLANE_TO_WGS84.falseEasting) / 111000 / Math.cos(44.5 * Math.PI / 180);
  const lat = STATE_PLANE_TO_WGS84.latitudeOrigin + y / 111000;

  return { lat, lng };
}

// =============================================================================
// Data Parsing
// =============================================================================

/**
 * Parse single backcountry site from API feature
 */
function parseBackcountrySite(feature: ArcGISFeature): BackcountrySite | null {
  const { attributes: a, geometry } = feature;

  // Skip sites without coordinates
  if (!geometry.x || !geometry.y) {
    return null;
  }

  // Convert State Plane coordinates to WGS84
  const { lat, lng } = statePlaneToWGS84(geometry.x, geometry.y);

  // Validate coordinates are within Vermont bounds (relaxed slightly)
  if (lat < 42.0 || lat > 46.0 || lng < -74.0 || lng > -71.0) {
    // Log first few invalid coordinates for debugging
    if (process.env.NODE_ENV !== 'production' && Math.random() < 0.01) { // 1% sample
      console.warn(`Invalid coordinates for site ${a.OBJECTID}: lat=${lat}, lng=${lng} (x=${geometry.x}, y=${geometry.y})`);
    }
    return null;
  }

  const site: BackcountrySite = {
    id: `bc-${a.OBJECTID}`,
    siteId: a.Site || `Site ${a.OBJECTID}`,
    siteType: SITE_TYPE_MAP[a.Type] || 'Unknown',
    latitude: lat,
    longitude: lng,
    isAccessible: a.ADA === 1,
    hasFirePit: a.FireType > 0,
    hasPicnicTable: a.Table_ > 0,
    notes: a.Notes || null,
    parkId: a.ANRUnit || null,
    districtId: a.ParkDistrict || null,
  };

  return site;
}

// =============================================================================
// API Fetching
// =============================================================================

/**
 * Fetch backcountry sites from Vermont ANR API
 */
async function fetchFromAPI(): Promise<BackcountrySite[]> {
  // Query for all campsites (tent sites, lean-tos, cabins, cottages)
  const params = new URLSearchParams({
    where: 'Type IN (1, 2, 3, 4, 5, 6)', // All site types
    outFields: 'OBJECTID,Site,Type,Surface,ADA,FireType,Table_,ANRUnit,ParkDistrict,Notes',
    f: 'json',
    returnGeometry: 'true',
  });

  const url = `${API_BASE_URL}?${params.toString()}`;

  if (process.env.NODE_ENV !== 'production') {
    console.log('Fetching backcountry sites from:', url);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Vermont ANR API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as ArcGISResponse;

  if (!data.features || data.features.length === 0) {
    throw new Error('No backcountry sites returned from API');
  }

  // Check if response was truncated
  if (data.exceededTransferLimit) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`WARNING: Vermont ANR API exceeded transfer limit. Data may be incomplete (received ${data.features.length} features)`);
    }
    // Note: For now we accept partial data. Could implement pagination in the future.
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`Received ${data.features.length} features from API`);
  }

  // Parse features
  const sites = data.features
    .map(parseBackcountrySite)
    .filter((site): site is BackcountrySite => site !== null);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`Parsed ${sites.length} valid backcountry sites (filtered ${data.features.length - sites.length} invalid)`);
  }

  // Validate minimum expected sites - relaxed to 50 since it's backcountry only
  if (sites.length < 50) {
    throw new Error(`Only parsed ${sites.length} sites - expected at least 50`);
  }

  return sites;
}

// =============================================================================
// LRU Cache with 24-hour TTL
// =============================================================================

const backcountryCache = new Map<string, BackcountrySiteCache>();
let cacheTimeout: ReturnType<typeof setTimeout> | null = null;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetch backcountry sites with caching
 */
export async function fetchBackcountrySites(): Promise<BackcountrySite[]> {
  // Check cache first
  const cached = backcountryCache.get('sites');
  if (cached) {
    return cached.sites;
  }

  try {
    const sites = await fetchFromAPI();

    // Cache with 24-hour TTL
    const cacheData: BackcountrySiteCache = {
      sites,
      fetchedAt: new Date().toISOString(),
    };
    backcountryCache.set('sites', cacheData);

    // Set timeout to clear cache
    if (cacheTimeout) clearTimeout(cacheTimeout);
    cacheTimeout = setTimeout(() => {
      backcountryCache.clear();
    }, CACHE_TTL_MS);

    return sites;

  } catch (error) {
    // Log error
    if (process.env.NODE_ENV !== 'production') {
      console.error('Backcountry sites fetch failed:', error);
    }

    // Return stale cache if available
    const staleCache = backcountryCache.get('sites');
    if (staleCache) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Using stale backcountry sites cache');
      }
      return staleCache.sites;
    }

    // Last resort: return empty array
    return [];
  }
}

/**
 * Clear the backcountry sites cache (for testing/debugging)
 */
export function clearCache(): void {
  backcountryCache.clear();
  if (cacheTimeout) {
    clearTimeout(cacheTimeout);
    cacheTimeout = null;
  }
}
