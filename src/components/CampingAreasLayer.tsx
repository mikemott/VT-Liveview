import { useState, useEffect, useRef, memo } from 'react';
import maplibregl from 'maplibre-gl';
import { fetchCampingAreas } from '../services/campingApi';
import type { CampingArea } from '../services/campingApi';
import { escapeHTML } from '../utils/sanitize';
import type { MapLibreMap, Marker } from '../types';
import './CampingAreasLayer.css';

interface MarkerEntry {
  marker: Marker;
  element: HTMLDivElement;
  handler: (e: MouseEvent) => void;
}

interface CampingAreasLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  onAreaClick?: (area: CampingArea) => void;
  onCountChange?: (count: number) => void;
}

// Lucide Tent icon SVG
const TENT_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
       viewBox="0 0 24 24" fill="none" stroke="white"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3.5 21 14 3"/>
    <path d="M20.5 21 10 3"/>
    <path d="M15.5 21 12 15l-3.5 6"/>
    <path d="M2 21h20"/>
  </svg>
`;

const PARK_TYPE_COLORS = {
  state_park: '#92400e', // Brown (wilderness/backcountry)
  state_forest: '#78350f', // Dark brown
  wildlife_management_area: '#b45309', // Medium brown
  other: '#6b7280', // Gray
};

const PARK_TYPE_LABELS: Record<string, string> = {
  state_park: 'State Park',
  state_forest: 'State Forest',
  wildlife_management_area: 'Wildlife Management Area',
  other: 'Other',
};

function createAreaMarker(area: CampingArea): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'camping-area-marker';

  const color = PARK_TYPE_COLORS[area.type as keyof typeof PARK_TYPE_COLORS] || PARK_TYPE_COLORS.other;

  // Fixed dimensions like SkiLayer - prevents stretching
  el.style.cssText = `
    width: 48px;
    height: 48px;
    background: ${color};
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: box-shadow 0.2s ease, border-width 0.2s ease;
  `;

  const iconWrapper = document.createElement('div');
  iconWrapper.innerHTML = TENT_ICON;
  iconWrapper.style.cssText = `
    display: flex;
    align-items: center;
    flex-shrink: 0;
    margin-bottom: 2px;
  `;

  const label = document.createElement('span');
  label.textContent = area.siteCount.toString();
  label.style.cssText = `
    color: white;
    font-weight: 700;
    font-size: 11px;
    line-height: 1;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  `;

  el.appendChild(iconWrapper);
  el.appendChild(label);

  // Hover effect - NO TRANSFORM, only shadow/border like SkiLayer
  el.addEventListener('mouseenter', () => {
    el.style.boxShadow = `0 0 12px ${color}, 0 2px 8px rgba(0, 0, 0, 0.3)`;
    el.style.borderWidth = '3px';
  });

  el.addEventListener('mouseleave', () => {
    el.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.25)';
    el.style.borderWidth = '2px';
  });

  return el;
}

function createPopupHTML(area: CampingArea): string {
  const safeName = escapeHTML(area.name);
  const typeLabel = PARK_TYPE_LABELS[area.type] || area.type;
  const color = PARK_TYPE_COLORS[area.type as keyof typeof PARK_TYPE_COLORS] || PARK_TYPE_COLORS.other;

  // Generate park website URL if it's a state park
  let websiteLink = '';
  if (area.type === 'state_park') {
    const parkSlug = area.name.toLowerCase()
      .replace(/\s+state\s+park$/i, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    websiteLink = `https://vtstateparks.com/${parkSlug}`;
  }

  return `
    <div class="camping-areas-popup">
      <div class="camping-areas-popup-header" style="border-left: 4px solid ${color};">
        <h3 class="camping-areas-popup-title">${safeName}</h3>
        <span class="camping-areas-popup-type">${typeLabel}</span>
      </div>
      <div class="camping-areas-popup-stats">
        <div class="camping-areas-stat">
          <div class="camping-areas-stat-icon">⛺</div>
          <div class="camping-areas-stat-content">
            <span class="camping-areas-stat-value">${area.siteCount}</span>
            <span class="camping-areas-stat-label">Backcountry Site${area.siteCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
      ${websiteLink ? `
        <div class="camping-areas-popup-footer">
          <a href="${websiteLink}" target="_blank" rel="noopener noreferrer" class="camping-areas-link-btn">
            Park Website →
          </a>
        </div>
      ` : ''}
    </div>
  `;
}

function CampingAreasLayer({ map, visible, onAreaClick, onCountChange }: CampingAreasLayerProps) {
  const [areas, setAreas] = useState<CampingArea[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const markersRef = useRef<MarkerEntry[]>([]);
  const currentPopupRef = useRef<maplibregl.Popup | null>(null);
  const boundaryLayerAddedRef = useRef(false);

  // Fetch camping areas
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('CampingAreasLayer: useEffect triggered', { visible, map: !!map });
    }

    if (!visible) {
      if (import.meta.env.DEV) {
        console.log('CampingAreasLayer: Not visible, skipping fetch');
      }
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    if (import.meta.env.DEV) {
      console.log('CampingAreasLayer: Fetching camping areas...');
    }

    fetchCampingAreas({ minSites: 1, includeBoundaries: true })
      .then(data => {
        if (isMounted) {
          setAreas(data);
          setLoading(false);

          // Report total backcountry site count
          const totalBackcountrySites = data.reduce((sum, area) => sum + area.siteCount, 0);
          const areasWithBoundaries = data.filter(a => a.boundary).length;

          if (onCountChange) {
            onCountChange(totalBackcountrySites);
          }

          if (import.meta.env.DEV) {
            console.log(`CampingAreasLayer: Loaded ${data.length} camping areas with ${totalBackcountrySites} total sites`);
            console.log(`CampingAreasLayer: ${areasWithBoundaries} areas have boundaries`);
            console.log('CampingAreasLayer: First area with boundary:', data.find(a => a.boundary));
          }
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load camping areas');
          setLoading(false);
          console.error('CampingAreasLayer error:', err);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [visible, onCountChange]);

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
      .filter(area => area.boundary)
      .map(area => ({
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
      const source = map.getSource('camping-area-boundaries');
      if (source && 'setData' in source) {
        source.setData(geojson);
      }
    }

    // Add fill layer if it doesn't exist (prominent brown zones like stargazing)
    if (!map.getLayer('camping-area-boundaries-fill')) {
      map.addLayer({
        id: 'camping-area-boundaries-fill',
        type: 'fill',
        source: 'camping-area-boundaries',
        paint: {
          'fill-color': [
            'match',
            ['get', 'type'],
            'state_park', '#92400e',      // Brown for state parks
            'state_forest', '#78350f',     // Dark brown for state forests
            'wildlife_management_area', '#b45309', // Medium brown for WMAs
            '#6b7280', // Gray for other
          ],
          'fill-opacity': 0.5, // Prominent like stargazing (50%)
        },
      });
    }

    // Add outline layer if it doesn't exist (glowing brown border)
    if (!map.getLayer('camping-area-boundaries-outline')) {
      map.addLayer({
        id: 'camping-area-boundaries-outline',
        type: 'line',
        source: 'camping-area-boundaries',
        paint: {
          'line-color': [
            'match',
            ['get', 'type'],
            'state_park', '#d97706',      // Amber outline
            'state_forest', '#b45309',     // Medium brown outline
            'wildlife_management_area', '#f59e0b', // Bright amber outline
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
  }, [map, visible, areas]);

  // Update markers when areas or visibility changes
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('CampingAreasLayer: Marker useEffect triggered', {
        hasMap: !!map,
        mapLoaded: map?.loaded(),
        visible,
        areasCount: areas.length,
      });
    }

    if (!map || !visible || areas.length === 0) {
      if (import.meta.env.DEV) {
        console.log('CampingAreasLayer: Skipping marker creation', {
          hasMap: !!map,
          visible,
          areasCount: areas.length,
        });
      }
      // Clear markers if not visible
      markersRef.current.forEach(({ marker, element, handler }) => {
        element.removeEventListener('click', handler);
        marker.remove();
      });
      markersRef.current = [];
      return;
    }

    // Clear existing markers
    if (import.meta.env.DEV) {
      console.log(`CampingAreasLayer: Clearing ${markersRef.current.length} existing markers`);
    }
    markersRef.current.forEach(({ marker, element, handler }) => {
      element.removeEventListener('click', handler);
      marker.remove();
    });
    markersRef.current = [];

    // Add new markers
    if (import.meta.env.DEV) {
      const mapCenter = map.getCenter();
      const mapZoom = map.getZoom();
      console.log(`CampingAreasLayer: Creating ${areas.length} new markers`, {
        mapCenter: [mapCenter.lng, mapCenter.lat],
        mapZoom: mapZoom.toFixed(2),
      });
    }
    areas.forEach((area, index) => {
      const element = createAreaMarker(area);

      const markerLngLat: [number, number] = [area.centroid.longitude, area.centroid.latitude];

      const marker = new maplibregl.Marker({ element })
        .setLngLat(markerLngLat)
        .addTo(map);

      // Log first 3 markers with full details
      if (import.meta.env.DEV && index < 3) {
        console.log(`CampingAreasLayer: Added marker #${index + 1}:`, {
          name: area.name,
          siteCount: area.siteCount,
          coordinates: markerLngLat,
          hasBoundary: !!area.boundary,
        });
      }

      // Click handler - simplified like SkiLayer (no setTimeout needed)
      const handler = (e: MouseEvent) => {
        e.stopPropagation();

        // Close existing popup
        if (currentPopupRef.current) {
          currentPopupRef.current.remove();
        }

        // Create and show popup immediately
        const popup = new maplibregl.Popup({
          closeButton: true,
          closeOnClick: true,
          className: 'camping-areas-popup-container',
          maxWidth: '300px',
          offset: 25,
        })
          .setLngLat([area.centroid.longitude, area.centroid.latitude])
          .setHTML(createPopupHTML(area))
          .addTo(map);

        currentPopupRef.current = popup;

        // Notify parent if handler provided
        if (onAreaClick) {
          onAreaClick(area);
        }
      };

      element.addEventListener('click', handler);

      markersRef.current.push({ marker, element, handler });
    });

    // Cleanup on unmount
    return () => {
      markersRef.current.forEach(({ marker, element, handler }) => {
        element.removeEventListener('click', handler);
        marker.remove();
      });
      markersRef.current = [];

      if (currentPopupRef.current) {
        currentPopupRef.current.remove();
        currentPopupRef.current = null;
      }
    };
  }, [map, visible, areas, onAreaClick]);

  // Show loading/error states
  useEffect(() => {
    if (loading && import.meta.env.DEV) {
      console.log('Loading camping areas...');
    }
    if (error) {
      console.error('Camping areas layer error:', error);
    }
  }, [loading, error]);

  return null;
}

export default memo(CampingAreasLayer);
