/**
 * Backcountry camping areas: state parks/forests/WMAs with primitive sites.
 * Park outlines are drawn as green zones; each area gets a shared marker
 * (VTL-64) with its site count, and clicking opens it in the side panel.
 */
import { memo } from 'react';
import type { GeoJSONSource } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { fetchCampingAreas, type CampingArea } from '../services/campingApi';
import { useLayerData } from '../hooks/useLayerData';
import { useMapMarkers, type BuiltMarker } from '../hooks/useMapMarkers';
import { createMapMarker } from '../utils/mapMarker';
import { PARK_TYPE_LABELS } from '../utils/campingAreas';
import type { MapLibreMap } from '../types';

interface CampingAreasLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  mapStyleVersion?: number;
  onSelect: (area: CampingArea) => void;
  /** Called after each successful fetch (counts, shared links) */
  onLoaded?: (areas: CampingArea[]) => void;
}

const REFRESH_MS = 24 * 60 * 60 * 1000;

// Lucide Tent icon (hard-coded; white via currentColor)
const TENT_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3.5 21 14 3"/>
    <path d="M20.5 21 10 3"/>
    <path d="M15.5 21 12 15l-3.5 6"/>
    <path d="M2 21h20"/>
  </svg>
`;

// Greens of the Camping layer color (VTL-64) so areas match the Camping chip
const PARK_TYPE_COLORS = {
  state_park: '#15803d',
  state_forest: '#166534',
  wildlife_management_area: '#3f6212',
  other: '#6b7280', // Gray
};

const fetchAreas = (): Promise<CampingArea[]> =>
  fetchCampingAreas({ minSites: 1, includeBoundaries: true });

function buildAreaMarker(area: CampingArea): BuiltMarker {
  const type = PARK_TYPE_LABELS[area.type]?.toLowerCase() ?? 'area';
  const element = createMapMarker({
    layer: 'campingSites',
    iconSvg: TENT_ICON,
    text: String(area.siteCount),
    label: `Backcountry camping: ${area.name}, ${type}, ${area.siteCount} site${area.siteCount === 1 ? '' : 's'}`,
    title: area.name,
    className: 'camping-area-marker',
  });
  return { lngLat: [area.centroid.longitude, area.centroid.latitude], element };
}

function CampingAreasLayer({
  map,
  visible,
  mapStyleVersion,
  onSelect,
  onLoaded,
}: CampingAreasLayerProps) {
  // Boundaries are large: only fetch once the layer is shown
  const areas = useLayerData(!!map && visible, fetchAreas, REFRESH_MS, onLoaded, 'camping areas');
  const boundaryLayerAddedRef = useRef(false);

  // Add boundary polygons layer (zones like stargazing)
  useEffect(() => {
    if (!map || !visible || areas.length === 0) {
      // Remove boundary layer if it exists
      if (boundaryLayerAddedRef.current) {
        if (map?.getLayer('camping-area-boundaries-fill')) {
          map.removeLayer('camping-area-boundaries-fill');
        }
        if (map?.getLayer('camping-area-boundaries-outline')) {
          map.removeLayer('camping-area-boundaries-outline');
        }
        if (map?.getSource('camping-area-boundaries')) {
          map.removeSource('camping-area-boundaries');
        }
        boundaryLayerAddedRef.current = false;
      }
      return;
    }

    // Create GeoJSON from areas with boundaries
    const features = areas
      .filter((area) => area.boundary)
      .map((area) => ({
        type: 'Feature' as const,
        properties: {
          name: area.name,
          type: area.type,
          siteCount: area.siteCount,
        },
        geometry: area.boundary!,
      }));

    if (features.length === 0) return;

    const geojson = {
      type: 'FeatureCollection' as const,
      features,
    };

    if (import.meta.env.DEV) {
      console.log('CampingAreasLayer: GeoJSON structure:', {
        featureCount: features.length,
        firstFeature: features[0],
        firstGeometryType: features[0]?.geometry?.type,
        firstCoordsLength: features[0]?.geometry?.coordinates?.length,
      });
    }

    // Add source if it doesn't exist
    if (!map.getSource('camping-area-boundaries')) {
      map.addSource('camping-area-boundaries', {
        type: 'geojson',
        data: geojson,
      });
    } else {
      // Update existing source
      map.getSource<GeoJSONSource>('camping-area-boundaries')?.setData(geojson);
    }

    // Add fill layer if it doesn't exist (green zones, Camping layer color)
    if (!map.getLayer('camping-area-boundaries-fill')) {
      map.addLayer({
        id: 'camping-area-boundaries-fill',
        type: 'fill',
        source: 'camping-area-boundaries',
        paint: {
          'fill-color': [
            'match',
            ['get', 'type'],
            'state_park',
            PARK_TYPE_COLORS.state_park,
            'state_forest',
            PARK_TYPE_COLORS.state_forest,
            'wildlife_management_area',
            PARK_TYPE_COLORS.wildlife_management_area,
            PARK_TYPE_COLORS.other,
          ],
          'fill-opacity': 0.5, // Prominent like stargazing (50%)
        },
      });
    }

    // Add outline layer if it doesn't exist (glowing green border)
    if (!map.getLayer('camping-area-boundaries-outline')) {
      map.addLayer({
        id: 'camping-area-boundaries-outline',
        type: 'line',
        source: 'camping-area-boundaries',
        paint: {
          'line-color': [
            'match',
            ['get', 'type'],
            'state_park',
            '#22c55e', // Lighter green outlines (VTL-64)
            'state_forest',
            '#16a34a',
            'wildlife_management_area',
            '#65a30d',
            '#9ca3af', // Light gray for other
          ],
          'line-width': 2,
          'line-opacity': 0.7, // Prominent like stargazing (70%)
          'line-blur': 2, // Soft glow
        },
      });
    }

    boundaryLayerAddedRef.current = true;

    if (import.meta.env.DEV) {
      console.log(`CampingAreasLayer: Added boundary zones for ${features.length} areas`);
      console.log(`CampingAreasLayer: Boundary layers exist:`, {
        fillLayer: map.getLayer('camping-area-boundaries-fill') ? 'YES' : 'NO',
        outlineLayer: map.getLayer('camping-area-boundaries-outline') ? 'YES' : 'NO',
        source: map.getSource('camping-area-boundaries') ? 'YES' : 'NO',
      });
    }

    return () => {
      if (map.getLayer('camping-area-boundaries-fill')) {
        map.removeLayer('camping-area-boundaries-fill');
      }
      if (map.getLayer('camping-area-boundaries-outline')) {
        map.removeLayer('camping-area-boundaries-outline');
      }
      if (map.getSource('camping-area-boundaries')) {
        map.removeSource('camping-area-boundaries');
      }
      boundaryLayerAddedRef.current = false;
    };
  }, [map, visible, areas, mapStyleVersion]);

  useMapMarkers(map, visible, areas, buildAreaMarker, onSelect);

  return null;
}

export default memo(CampingAreasLayer);
