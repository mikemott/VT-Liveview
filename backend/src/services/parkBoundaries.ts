/**
 * Vermont State Parks Boundaries Service
 * Fetches polygon boundaries for grouping campsites by area
 *
 * Data Source: ANR Lands Dataset Unit
 * API: https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_CADASTRAL_SP_NOCACHE_v2/MapServer/38
 *
 * Coverage: All Vermont State Parks, State Forests, and ANR-managed lands
 */

import type { ParkBoundary, ParkBoundaryCache } from '../types/backcountry.js';

// =============================================================================
// Types
// =============================================================================

/** Raw GeoJSON response from ANR API */
interface ANRGeoJSONFeature {
  type: 'Feature';
  id: number;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  properties: {
    OBJECTID: number;
    NAME: string; // Park/forest name
    ANRUnit: number; // Unit identifier (matches campsite parkId)
    ANRUnitType: string; // SF=State Forest, SP=State Park, WMA=Wildlife Management Area
    ANRDept: string; // FPR=Forests Parks & Recreation
    GISACRES: number; // Acreage
  };
}

interface ANRGeoJSONResponse {
  type: 'FeatureCollection';
  features: ANRGeoJSONFeature[];
}

// =============================================================================
// Constants
// =============================================================================

const API_BASE_URL = 'https://anrmaps.vermont.gov/arcgis/rest/services/Open_Data/OPENDATA_ANR_CADASTRAL_SP_NOCACHE_v2/MapServer/38/query';

// =============================================================================
// Data Parsing
// =============================================================================

/**
 * Parse park boundary from GeoJSON feature
 */
function parseParkBoundary(feature: ANRGeoJSONFeature): ParkBoundary | null {
  const props = feature.properties;

  // Only include FPR (Forests, Parks & Recreation) units
  if (props.ANRDept !== 'FPR') {
    return null;
  }

  // Skip units without names
  if (!props.NAME || props.NAME.trim() === '') {
    return null;
  }

  const boundary: ParkBoundary = {
    id: `park-${props.OBJECTID}`,
    anrUnit: props.ANRUnit,
    name: props.NAME,
    unitType: props.ANRUnitType,
    acreage: props.GISACRES || 0,
    geometry: feature.geometry,
  };

  return boundary;
}

// =============================================================================
// API Fetching
// =============================================================================

/**
 * Fetch park boundaries from Vermont ANR API
 */
async function fetchFromAPI(): Promise<ParkBoundary[]> {
  // Query for FPR-managed lands (State Parks and State Forests)
  const params = new URLSearchParams({
    where: "ANRDept='FPR'",
    outFields: 'OBJECTID,NAME,ANRUnit,ANRUnitType,ANRDept,GISACRES',
    f: 'geojson',
    returnGeometry: 'true',
  });

  const url = `${API_BASE_URL}?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Vermont ANR API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as ANRGeoJSONResponse;

  if (!data.features || data.features.length === 0) {
    throw new Error('No park boundaries returned from API');
  }

  // Parse features
  const boundaries = data.features
    .map(parseParkBoundary)
    .filter((boundary): boundary is ParkBoundary => boundary !== null);

  return boundaries;
}

// =============================================================================
// LRU Cache with 7-day TTL
// =============================================================================

const boundaryCache = new Map<string, ParkBoundaryCache>();
let cacheTimeout: ReturnType<typeof setTimeout> | null = null;

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Fetch park boundaries with caching
 */
export async function fetchParkBoundaries(): Promise<ParkBoundary[]> {
  // Check cache first
  const cached = boundaryCache.get('boundaries');
  if (cached) {
    return cached.boundaries;
  }

  try {
    const boundaries = await fetchFromAPI();

    // Cache with 7-day TTL
    const cacheData: ParkBoundaryCache = {
      boundaries,
      fetchedAt: new Date().toISOString(),
    };
    boundaryCache.set('boundaries', cacheData);

    // Set timeout to clear cache
    if (cacheTimeout) clearTimeout(cacheTimeout);
    cacheTimeout = setTimeout(() => {
      boundaryCache.clear();
    }, CACHE_TTL_MS);

    return boundaries;

  } catch (error) {
    // Log error
    console.error('Park boundaries fetch failed:', error);

    // Return stale cache if available
    const staleCache = boundaryCache.get('boundaries');
    if (staleCache) {
      console.warn('Using stale park boundaries cache');
      return staleCache.boundaries;
    }

    // Last resort: return empty array
    return [];
  }
}

/**
 * Clear the park boundaries cache (for testing/debugging)
 */
export function clearCache(): void {
  boundaryCache.clear();
  if (cacheTimeout) {
    clearTimeout(cacheTimeout);
    cacheTimeout = null;
  }
}
