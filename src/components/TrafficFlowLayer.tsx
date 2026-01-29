import { useEffect, memo } from 'react';
import type { MapLibreMap } from '../types';

// =============================================================================
// Types
// =============================================================================

interface TrafficFlowLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  isDark: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY as string;

// Traffic flow layer IDs
const SOURCE_ID = 'traffic-flow-source';
const LAYER_ID = 'traffic-flow-layer';
const LAYER_ID_CASING = 'traffic-flow-layer-casing';

// Show all traffic but use opacity to de-emphasize free-flowing roads

// =============================================================================
// Component
// =============================================================================

function TrafficFlowLayer({ map, visible, isDark }: TrafficFlowLayerProps) {
  // Single effect that manages everything based on visible state
  useEffect(() => {
    if (!map || !TOMTOM_API_KEY) {
      return;
    }

    // If not visible, hide layers
    if (!visible) {
      try {
        if (map.getLayer(LAYER_ID)) {
          map.setLayoutProperty(LAYER_ID, 'visibility', 'none');
        }
        if (map.getLayer(LAYER_ID_CASING)) {
          map.setLayoutProperty(LAYER_ID_CASING, 'visibility', 'none');
        }
      } catch {
        // Layers may not exist yet
      }
      return;
    }

    // visible === true, add layers if needed
    const addTrafficLayers = () => {
      if (!map.isStyleLoaded()) {
        map.once('style.load', addTrafficLayers);
        return;
      }

      try {
        // Add source if needed
        if (!map.getSource(SOURCE_ID)) {
          map.addSource(SOURCE_ID, {
            type: 'vector',
            tiles: [
              `https://api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.pbf?key=${TOMTOM_API_KEY}`
            ],
            minzoom: 6,
            maxzoom: 18,
            attribution: '© TomTom'
          });
        }

        // Add casing layer if needed (outline for visibility)
        if (!map.getLayer(LAYER_ID_CASING)) {
          map.addLayer({
            id: LAYER_ID_CASING,
            type: 'line',
            source: SOURCE_ID,
            'source-layer': 'Traffic flow',
            layout: {
              'line-cap': 'round',
              'line-join': 'round',
              visibility: 'visible'
            },
            paint: {
              'line-color': isDark ? '#000000' : '#ffffff',
              'line-width': 4,
              'line-opacity': 0.5
            }
          });
        } else {
          map.setLayoutProperty(LAYER_ID_CASING, 'visibility', 'visible');
        }

        // Add main traffic layer if needed
        if (!map.getLayer(LAYER_ID)) {
          map.addLayer({
            id: LAYER_ID,
            type: 'line',
            source: SOURCE_ID,
            'source-layer': 'Traffic flow',
            layout: {
              'line-cap': 'round',
              'line-join': 'round',
              visibility: 'visible'
            },
            paint: {
              // Color: red (stopped) -> orange -> yellow -> green (free flow)
              'line-color': [
                'interpolate',
                ['linear'],
                ['get', 'traffic_level'],
                0, '#dc2626',
                0.25, '#ea580c',
                0.5, '#eab308',
                0.75, '#84cc16',
                1, '#22c55e'
              ],
              'line-width': 3,
              'line-opacity': 0.85
            }
          });
        } else {
          map.setLayoutProperty(LAYER_ID, 'visibility', 'visible');
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error('TrafficFlowLayer: Error adding layers', e);
        }
      }
    };

    addTrafficLayers();
  }, [map, visible, isDark]);


  // This component only manages map layers, no UI to render
  return null;
}

export default memo(TrafficFlowLayer);
