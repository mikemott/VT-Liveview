/**
 * Vermont Light Pollution Data
 * Point-based light sources for heatmap rendering
 * Intensity values are normalized estimates based on population and lighting
 */

import type { BortleClass } from '../types/stargazing';

// Legacy polygon types (kept for dark sky zones)
export interface LightPollutionFeature {
  type: 'Feature';
  properties: {
    bortleClass: BortleClass;
    name: string;
  };
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

export interface LightPollutionGeoJSON {
  type: 'FeatureCollection';
  features: LightPollutionFeature[];
}

// Point-based light source for heatmap
export interface LightSourcePoint {
  type: 'Feature';
  properties: {
    name: string;
    intensity: number; // 0-1 normalized light output
    population?: number;
    type: 'city' | 'town' | 'village' | 'corridor' | 'facility';
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
}

export interface LightSourceGeoJSON {
  type: 'FeatureCollection';
  features: LightSourcePoint[];
}

/**
 * Vermont Light Sources
 * Intensity scale: 0.1-1.0 based on relative brightness
 * - 1.0: Major city core (Burlington downtown)
 * - 0.7-0.9: City/large town
 * - 0.4-0.6: Small town
 * - 0.2-0.3: Village/corridor point
 * - 0.1: Minor facility
 */
const LIGHT_SOURCES: Array<{
  name: string;
  lng: number;
  lat: number;
  intensity: number;
  population?: number;
  type: 'city' | 'town' | 'village' | 'corridor' | 'facility';
}> = [
  // === BURLINGTON METRO AREA (Chittenden County) ===
  // Burlington is VT's largest city - multiple points for realistic spread
  { name: 'Burlington Downtown', lng: -73.2121, lat: 44.4759, intensity: 1.0, population: 45000, type: 'city' },
  { name: 'Burlington - UVM', lng: -73.1963, lat: 44.4779, intensity: 0.7, type: 'facility' },
  { name: 'Burlington - Airport', lng: -73.1533, lat: 44.4718, intensity: 0.6, type: 'facility' },
  { name: 'South Burlington', lng: -73.1710, lat: 44.4669, intensity: 0.85, population: 20000, type: 'city' },
  { name: 'Williston', lng: -73.0768, lat: 44.4364, intensity: 0.65, population: 10000, type: 'town' },
  { name: 'Essex Junction', lng: -73.1110, lat: 44.4906, intensity: 0.7, population: 11000, type: 'town' },
  { name: 'Essex', lng: -73.0576, lat: 44.5204, intensity: 0.5, population: 22000, type: 'town' },
  { name: 'Colchester', lng: -73.1501, lat: 44.5439, intensity: 0.55, population: 18000, type: 'town' },
  { name: 'Winooski', lng: -73.1857, lat: 44.4914, intensity: 0.6, population: 8000, type: 'town' },
  { name: 'Shelburne', lng: -73.2268, lat: 44.3791, intensity: 0.4, population: 8000, type: 'town' },
  { name: 'Richmond', lng: -72.9984, lat: 44.4073, intensity: 0.25, population: 4000, type: 'village' },
  { name: 'Hinesburg', lng: -73.1107, lat: 44.3289, intensity: 0.25, population: 5000, type: 'village' },

  // === RUTLAND AREA ===
  { name: 'Rutland', lng: -72.9726, lat: 43.6106, intensity: 0.75, population: 15000, type: 'city' },
  { name: 'Rutland Town', lng: -72.9545, lat: 43.6344, intensity: 0.35, population: 4000, type: 'town' },
  { name: 'Fair Haven', lng: -73.2651, lat: 43.5945, intensity: 0.3, population: 2500, type: 'village' },
  { name: 'Poultney', lng: -73.2365, lat: 43.5170, intensity: 0.25, population: 3300, type: 'village' },
  { name: 'Castleton', lng: -73.1798, lat: 43.6106, intensity: 0.25, population: 4300, type: 'village' },
  { name: 'Brandon', lng: -73.0865, lat: 43.7981, intensity: 0.3, population: 4000, type: 'village' },

  // === BARRE-MONTPELIER ===
  { name: 'Montpelier', lng: -72.5754, lat: 44.2601, intensity: 0.65, population: 8000, type: 'city' },
  { name: 'Barre', lng: -72.5015, lat: 44.1970, intensity: 0.6, population: 8500, type: 'city' },
  { name: 'Berlin', lng: -72.5696, lat: 44.2070, intensity: 0.3, population: 3000, type: 'village' },
  { name: 'Northfield', lng: -72.6562, lat: 44.1501, intensity: 0.3, population: 6200, type: 'village' },
  { name: 'Waterbury', lng: -72.7562, lat: 44.3376, intensity: 0.35, population: 5400, type: 'village' },

  // === BENNINGTON AREA ===
  { name: 'Bennington', lng: -73.1968, lat: 42.8781, intensity: 0.6, population: 15000, type: 'town' },
  { name: 'Manchester', lng: -73.0724, lat: 43.1634, intensity: 0.4, population: 4500, type: 'village' },
  { name: 'Arlington', lng: -73.1529, lat: 43.0745, intensity: 0.2, population: 2300, type: 'village' },

  // === BRATTLEBORO / CONNECTICUT RIVER VALLEY ===
  { name: 'Brattleboro', lng: -72.5579, lat: 42.8509, intensity: 0.55, population: 12000, type: 'town' },
  { name: 'Bellows Falls', lng: -72.4440, lat: 43.1334, intensity: 0.35, population: 3000, type: 'village' },
  { name: 'Springfield', lng: -72.4818, lat: 43.2984, intensity: 0.4, population: 9000, type: 'town' },
  { name: 'Windsor', lng: -72.3851, lat: 43.4784, intensity: 0.25, population: 3500, type: 'village' },
  { name: 'White River Junction', lng: -72.3190, lat: 43.6490, intensity: 0.5, population: 2500, type: 'town' },
  { name: 'Hartford', lng: -72.3845, lat: 43.6612, intensity: 0.35, population: 10000, type: 'town' },

  // === NORTHERN VERMONT ===
  { name: 'St. Albans', lng: -73.0840, lat: 44.8109, intensity: 0.5, population: 7000, type: 'town' },
  { name: 'Swanton', lng: -73.1251, lat: 44.9179, intensity: 0.25, population: 6400, type: 'village' },
  { name: 'Enosburg Falls', lng: -72.8068, lat: 44.9065, intensity: 0.2, population: 1300, type: 'village' },

  // === LAMOILLE VALLEY ===
  { name: 'Morrisville', lng: -72.5979, lat: 44.5576, intensity: 0.35, population: 5200, type: 'village' },
  { name: 'Stowe', lng: -72.6874, lat: 44.4654, intensity: 0.4, population: 5200, type: 'village' },
  { name: 'Johnson', lng: -72.6807, lat: 44.6359, intensity: 0.2, population: 3600, type: 'village' },
  { name: 'Hyde Park', lng: -72.6151, lat: 44.5934, intensity: 0.15, population: 3000, type: 'village' },

  // === NORTHEAST KINGDOM ===
  { name: 'St. Johnsbury', lng: -72.0153, lat: 44.4192, intensity: 0.45, population: 7000, type: 'town' },
  { name: 'Lyndonville', lng: -72.0037, lat: 44.5334, intensity: 0.25, population: 5400, type: 'village' },
  { name: 'Newport', lng: -72.2051, lat: 44.9364, intensity: 0.4, population: 4500, type: 'town' },
  { name: 'Derby', lng: -72.1320, lat: 44.9501, intensity: 0.2, population: 4600, type: 'village' },
  { name: 'Hardwick', lng: -72.3682, lat: 44.5051, intensity: 0.2, population: 3000, type: 'village' },
  { name: 'Barton', lng: -72.1751, lat: 44.7501, intensity: 0.15, population: 2800, type: 'village' },
  { name: 'Island Pond', lng: -71.8792, lat: 44.8134, intensity: 0.15, population: 800, type: 'village' },

  // === CHAMPLAIN VALLEY ===
  { name: 'Middlebury', lng: -73.1676, lat: 44.0154, intensity: 0.45, population: 9000, type: 'town' },
  { name: 'Vergennes', lng: -73.2540, lat: 44.1668, intensity: 0.3, population: 2700, type: 'village' },
  { name: 'Bristol', lng: -73.0790, lat: 44.1334, intensity: 0.2, population: 4000, type: 'village' },

  // === MAD RIVER / CENTRAL VERMONT ===
  { name: 'Waitsfield', lng: -72.8262, lat: 44.1862, intensity: 0.2, population: 1700, type: 'village' },
  { name: 'Warren', lng: -72.8576, lat: 44.1168, intensity: 0.15, population: 1700, type: 'village' },
  { name: 'Randolph', lng: -72.6651, lat: 43.9251, intensity: 0.3, population: 4800, type: 'village' },

  // === SKI RESORTS (seasonal high intensity) ===
  { name: 'Killington Resort', lng: -72.8201, lat: 43.6045, intensity: 0.35, type: 'facility' },
  { name: 'Sugarbush', lng: -72.8984, lat: 44.1362, intensity: 0.25, type: 'facility' },
  { name: 'Smugglers Notch Resort', lng: -72.7876, lat: 44.5612, intensity: 0.2, type: 'facility' },
  { name: 'Jay Peak', lng: -72.5051, lat: 44.9276, intensity: 0.25, type: 'facility' },
  { name: 'Mount Snow', lng: -72.9201, lat: 42.9601, intensity: 0.25, type: 'facility' },
  { name: 'Stratton', lng: -72.9084, lat: 43.1134, intensity: 0.2, type: 'facility' },
  { name: 'Okemo', lng: -72.7168, lat: 43.4001, intensity: 0.25, type: 'facility' },

  // === INTERSTATE CORRIDOR POINTS (I-89, I-91) ===
  // These represent highway interchange lighting
  { name: 'I-89 Exit 12', lng: -72.9834, lat: 44.3862, intensity: 0.15, type: 'corridor' },
  { name: 'I-89 Exit 14', lng: -73.0468, lat: 44.4123, intensity: 0.15, type: 'corridor' },
  { name: 'I-89 Exit 14B', lng: -73.0868, lat: 44.4301, intensity: 0.15, type: 'corridor' },
  { name: 'I-91 Exit 1', lng: -72.5401, lat: 42.7701, intensity: 0.15, type: 'corridor' },
  { name: 'I-91 Exit 4', lng: -72.4968, lat: 43.0501, intensity: 0.1, type: 'corridor' },
  { name: 'I-91 Exit 7', lng: -72.4601, lat: 43.2934, intensity: 0.1, type: 'corridor' },
  { name: 'I-91 Exit 11', lng: -72.3501, lat: 43.6334, intensity: 0.1, type: 'corridor' },
  { name: 'I-91 Exit 21', lng: -72.0268, lat: 44.4134, intensity: 0.1, type: 'corridor' },
  { name: 'I-91 Exit 26', lng: -72.0068, lat: 44.7001, intensity: 0.1, type: 'corridor' },
];

// Generate point-based GeoJSON for heatmap rendering
export function generateLightSourcePoints(): LightSourceGeoJSON {
  const features: LightSourcePoint[] = LIGHT_SOURCES.map(source => ({
    type: 'Feature',
    properties: {
      name: source.name,
      intensity: source.intensity,
      ...(source.population !== undefined && { population: source.population }),
      type: source.type,
    },
    geometry: {
      type: 'Point',
      coordinates: [source.lng, source.lat],
    },
  }));

  return {
    type: 'FeatureCollection',
    features,
  };
}

// Export the heatmap data
export const LIGHT_POLLUTION_HEATMAP = generateLightSourcePoints();

// Legacy polygon data (kept for backward compatibility)
// Helper to create a circular polygon approximation
function createCircle(centerLng: number, centerLat: number, radiusKm: number, points: number = 32): number[][] {
  const coords: number[][] = [];
  const distanceX = radiusKm / (111.32 * Math.cos(centerLat * Math.PI / 180));
  const distanceY = radiusKm / 110.574;

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const lng = centerLng + distanceX * Math.cos(angle);
    const lat = centerLat + distanceY * Math.sin(angle);
    coords.push([lng, lat]);
  }

  return coords;
}

// Legacy polygon generation (simplified, not used by heatmap)
const LEGACY_LIGHT_SOURCES = [
  { name: 'Burlington', lng: -73.2121, lat: 44.4759, radius: 25, bortle: 6 as BortleClass },
  { name: 'Rutland', lng: -72.9726, lat: 43.6106, radius: 12, bortle: 5 as BortleClass },
  { name: 'Barre-Montpelier', lng: -72.5754, lat: 44.2601, radius: 10, bortle: 5 as BortleClass },
];

export const LIGHT_POLLUTION_DATA: LightPollutionGeoJSON = {
  type: 'FeatureCollection',
  features: LEGACY_LIGHT_SOURCES.map(source => ({
    type: 'Feature',
    properties: {
      bortleClass: source.bortle,
      name: source.name,
    },
    geometry: {
      type: 'Polygon',
      coordinates: [createCircle(source.lng, source.lat, source.radius)],
    },
  })),
};

/**
 * Vermont Dark Sky Zones
 * More realistic boundaries following terrain and forest boundaries
 * These overlay as semi-transparent dark zones to show prime stargazing areas
 */
export const VERMONT_DARK_SKY_ZONES: LightPollutionGeoJSON = {
  type: 'FeatureCollection',
  features: [
    // Northeast Kingdom Core - Bortle 2 (darkest in Vermont)
    // Follows the remote interior between Island Pond and Victory
    {
      type: 'Feature',
      properties: {
        bortleClass: 2,
        name: 'Northeast Kingdom Core',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-71.55, 44.55],   // Near Maidstone
          [-71.75, 44.45],   // Victory area
          [-72.05, 44.50],   // West of Lyndon
          [-72.20, 44.65],   // South of Barton
          [-72.25, 44.85],   // West of Derby
          [-72.10, 44.98],   // Canadian border
          [-71.55, 44.98],   // NE corner
          [-71.55, 44.55],   // Close
        ]],
      },
    },
    // Willoughby / Northern NEK - Bortle 2-3
    {
      type: 'Feature',
      properties: {
        bortleClass: 2,
        name: 'Willoughby Highlands',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-71.95, 44.70],   // Lake Willoughby south
          [-72.15, 44.68],   // West of Willoughby
          [-72.15, 44.85],   // North
          [-71.95, 44.88],   // East
          [-71.95, 44.70],   // Close
        ]],
      },
    },

    // Green Mountain National Forest - Southern Section
    // Follows the ridgeline more accurately
    {
      type: 'Feature',
      properties: {
        bortleClass: 3,
        name: 'Green Mountain NF South',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-73.05, 42.85],   // Bennington area edge
          [-72.95, 42.82],   // Southern tip
          [-72.75, 42.85],   // SE corner
          [-72.70, 43.05],   // East side
          [-72.72, 43.25],   // East of Peru
          [-72.78, 43.40],   // East of Danby
          [-73.00, 43.45],   // North of Danby Mtn
          [-73.10, 43.30],   // West side
          [-73.12, 43.05],   // Glastenbury area
          [-73.05, 42.85],   // Close
        ]],
      },
    },

    // Green Mountain National Forest - Northern Section (Bread Loaf)
    {
      type: 'Feature',
      properties: {
        bortleClass: 3,
        name: 'Green Mountain NF North',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-73.10, 43.85],   // SW near Brandon Gap
          [-72.88, 43.82],   // SE
          [-72.80, 43.95],   // East of Ripton
          [-72.75, 44.10],   // East of Lincoln
          [-72.82, 44.28],   // Near Huntington
          [-72.98, 44.32],   // NW near Starksboro
          [-73.12, 44.18],   // West side
          [-73.15, 43.98],   // Bristol area edge
          [-73.10, 43.85],   // Close
        ]],
      },
    },

    // Groton State Forest area - Bortle 3
    {
      type: 'Feature',
      properties: {
        bortleClass: 3,
        name: 'Groton State Forest',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-72.35, 44.20],   // SW
          [-72.18, 44.18],   // SE
          [-72.12, 44.35],   // East
          [-72.20, 44.42],   // NE
          [-72.38, 44.40],   // NW
          [-72.35, 44.20],   // Close
        ]],
      },
    },

    // Southern Vermont wilderness (Glastenbury/Somerset)
    {
      type: 'Feature',
      properties: {
        bortleClass: 3,
        name: 'Somerset Wilderness',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-73.05, 42.95],   // West
          [-72.88, 42.92],   // South
          [-72.82, 43.08],   // East
          [-72.90, 43.18],   // NE
          [-73.02, 43.15],   // North
          [-73.05, 42.95],   // Close
        ]],
      },
    },

    // Victory Basin / Granby area (very remote)
    {
      type: 'Feature',
      properties: {
        bortleClass: 2,
        name: 'Victory Basin',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-71.68, 44.42],   // SW
          [-71.55, 44.40],   // SE
          [-71.52, 44.58],   // East
          [-71.65, 44.62],   // NE
          [-71.78, 44.55],   // NW
          [-71.68, 44.42],   // Close
        ]],
      },
    },
  ],
};
