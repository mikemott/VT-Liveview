/**
 * Vermont Light Pollution Data
 * Simplified Bortle zones based on population centers
 * In production, this would come from VIIRS satellite data
 */

import type { BortleClass } from '../types/stargazing';

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

// Helper to create a circular polygon approximation
function createCircle(centerLng: number, centerLat: number, radiusKm: number, points: number = 32): number[][] {
  const coords: number[][] = [];
  const km = radiusKm;
  const distanceX = km / (111.32 * Math.cos(centerLat * Math.PI / 180));
  const distanceY = km / 110.574;

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const lng = centerLng + distanceX * Math.cos(angle);
    const lat = centerLat + distanceY * Math.sin(angle);
    coords.push([lng, lat]);
  }

  return coords;
}

// Vermont population centers and their light pollution zones
// Zones are layered - larger (darker) zones contain smaller (brighter) zones
const LIGHT_SOURCES: Array<{
  name: string;
  lng: number;
  lat: number;
  zones: Array<{ radius: number; bortle: BortleClass }>;
}> = [
  // Burlington metro area - largest light source
  {
    name: 'Burlington',
    lng: -73.2121,
    lat: 44.4759,
    zones: [
      { radius: 5, bortle: 7 },    // City core
      { radius: 12, bortle: 6 },   // Suburbs
      { radius: 25, bortle: 5 },   // Outer suburbs
      { radius: 40, bortle: 4 },   // Rural transition
    ]
  },
  // Rutland
  {
    name: 'Rutland',
    lng: -72.9726,
    lat: 43.6106,
    zones: [
      { radius: 3, bortle: 6 },
      { radius: 8, bortle: 5 },
      { radius: 15, bortle: 4 },
    ]
  },
  // Barre-Montpelier
  {
    name: 'Barre-Montpelier',
    lng: -72.5754,
    lat: 44.2601,
    zones: [
      { radius: 4, bortle: 6 },
      { radius: 10, bortle: 5 },
      { radius: 18, bortle: 4 },
    ]
  },
  // Bennington
  {
    name: 'Bennington',
    lng: -73.1968,
    lat: 42.8781,
    zones: [
      { radius: 3, bortle: 6 },
      { radius: 8, bortle: 5 },
      { radius: 15, bortle: 4 },
    ]
  },
  // Brattleboro
  {
    name: 'Brattleboro',
    lng: -72.5579,
    lat: 42.8509,
    zones: [
      { radius: 3, bortle: 6 },
      { radius: 7, bortle: 5 },
      { radius: 12, bortle: 4 },
    ]
  },
  // St. Albans
  {
    name: 'St. Albans',
    lng: -73.0840,
    lat: 44.8109,
    zones: [
      { radius: 2, bortle: 5 },
      { radius: 6, bortle: 4 },
    ]
  },
  // St. Johnsbury
  {
    name: 'St. Johnsbury',
    lng: -72.0153,
    lat: 44.4192,
    zones: [
      { radius: 2, bortle: 5 },
      { radius: 5, bortle: 4 },
    ]
  },
  // Newport
  {
    name: 'Newport',
    lng: -72.2051,
    lat: 44.9364,
    zones: [
      { radius: 2, bortle: 5 },
      { radius: 5, bortle: 4 },
    ]
  },
  // Middlebury
  {
    name: 'Middlebury',
    lng: -73.1676,
    lat: 44.0154,
    zones: [
      { radius: 2, bortle: 5 },
      { radius: 5, bortle: 4 },
    ]
  },
  // Springfield
  {
    name: 'Springfield',
    lng: -72.4818,
    lat: 43.2984,
    zones: [
      { radius: 2, bortle: 5 },
      { radius: 5, bortle: 4 },
    ]
  },
  // Stowe (ski resort lighting)
  {
    name: 'Stowe',
    lng: -72.6874,
    lat: 44.4654,
    zones: [
      { radius: 2, bortle: 5 },
      { radius: 4, bortle: 4 },
    ]
  },
  // Killington (ski resort)
  {
    name: 'Killington',
    lng: -72.8201,
    lat: 43.6045,
    zones: [
      { radius: 2, bortle: 5 },
      { radius: 4, bortle: 4 },
    ]
  },
];

// Generate the GeoJSON features
function generateLightPollutionFeatures(): LightPollutionFeature[] {
  const features: LightPollutionFeature[] = [];

  // Sort by bortle class (brightest first so darker zones overlay)
  const allZones: Array<{
    name: string;
    lng: number;
    lat: number;
    radius: number;
    bortle: BortleClass;
  }> = [];

  for (const source of LIGHT_SOURCES) {
    for (const zone of source.zones) {
      allZones.push({
        name: source.name,
        lng: source.lng,
        lat: source.lat,
        radius: zone.radius,
        bortle: zone.bortle,
      });
    }
  }

  // Sort by bortle (brightest/highest number first)
  allZones.sort((a, b) => b.bortle - a.bortle);

  for (const zone of allZones) {
    features.push({
      type: 'Feature',
      properties: {
        bortleClass: zone.bortle,
        name: zone.name,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [createCircle(zone.lng, zone.lat, zone.radius)],
      },
    });
  }

  return features;
}

// Export the complete GeoJSON
export const LIGHT_POLLUTION_DATA: LightPollutionGeoJSON = {
  type: 'FeatureCollection',
  features: generateLightPollutionFeatures(),
};

// Vermont boundary for the dark sky background layer
// This creates a "base" of class 3 for most of Vermont (rural)
// with even darker areas (class 2) in the Northeast Kingdom
export const VERMONT_DARK_SKY_ZONES: LightPollutionGeoJSON = {
  type: 'FeatureCollection',
  features: [
    // Northeast Kingdom - Bortle 2 (darkest)
    {
      type: 'Feature',
      properties: {
        bortleClass: 2,
        name: 'Northeast Kingdom',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-71.5, 44.4],
          [-72.3, 44.4],
          [-72.3, 45.0],
          [-71.5, 45.0],
          [-71.5, 44.4],
        ]],
      },
    },
    // Green Mountain National Forest South - Bortle 3
    {
      type: 'Feature',
      properties: {
        bortleClass: 3,
        name: 'Green Mountain NF South',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-73.1, 42.8],
          [-72.7, 42.8],
          [-72.7, 43.4],
          [-73.1, 43.4],
          [-73.1, 42.8],
        ]],
      },
    },
    // Green Mountain National Forest North - Bortle 3
    {
      type: 'Feature',
      properties: {
        bortleClass: 3,
        name: 'Green Mountain NF North',
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [-73.2, 43.8],
          [-72.7, 43.8],
          [-72.7, 44.3],
          [-73.2, 44.3],
          [-73.2, 43.8],
        ]],
      },
    },
  ],
};
