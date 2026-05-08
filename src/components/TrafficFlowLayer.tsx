import { useEffect, useRef, memo } from 'react';
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

// TomTom API key from environment variables
const TOMTOM_API_KEY = import.meta.env.VITE_TOMTOM_API_KEY as string;

// Traffic flow layer IDs
const SOURCE_ID = 'traffic-flow-source';
const LAYER_ID = 'traffic-flow-layer';
const LAYER_ID_CASING = 'traffic-flow-layer-casing';

// =============================================================================
// Component
// =============================================================================

function TrafficFlowLayer({ map, visible, isDark }: TrafficFlowLayerProps) {
  const layersAdded = useRef(false);

  // Effect to add layers on mount, remove on unmount
  useEffect(() => {
    if (!map || !TOMTOM_API_KEY) {
      return;
    }

    const addTrafficLayers = () => {
      if (!map.isStyleLoaded()) {
        map.once('style.load', addTrafficLayers);
        return;
      }

      // Clean up existing layers/sources if they exist
      // This handles style reload scenarios
      try {
        if (map.getLayer(LAYER_ID)) {
          map.removeLayer(LAYER_ID);
        }
        if (map.getLayer(LAYER_ID_CASING)) {
          map.removeLayer(LAYER_ID_CASING);
        }
        if (map.getSource(SOURCE_ID)) {
          map.removeSource(SOURCE_ID);
        }
      } catch {
        // Layers/sources don't exist yet, which is fine
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

        // Find the first label/symbol layer to insert traffic layers before it
        // This ensures traffic shows above roads but below labels
        const layers = map.getStyle().layers;
        let firstLabelLayer: string | undefined;
        for (const layer of layers) {
          if (layer.type === 'symbol' || layer.id.includes('label') || layer.id.includes('place')) {
            firstLabelLayer = layer.id;
            break;
          }
        }

        // Add casing layer (outline for visibility)
        if (!map.getLayer(LAYER_ID_CASING)) {
          map.addLayer({
            id: LAYER_ID_CASING,
            type: 'line',
            source: SOURCE_ID,
            'source-layer': 'Traffic flow',
            layout: {
              'line-cap': 'round',
              'line-join': 'round',
              visibility: visible ? 'visible' : 'none'
            },
            paint: {
              'line-color': isDark ? '#000000' : '#ffffff',
              'line-width': 4,
              'line-opacity': 0.5
            }
          }, firstLabelLayer); // Insert before labels
        }

        // Add main traffic layer
        if (!map.getLayer(LAYER_ID)) {
          map.addLayer({
            id: LAYER_ID,
            type: 'line',
            source: SOURCE_ID,
            'source-layer': 'Traffic flow',
            layout: {
              'line-cap': 'round',
              'line-join': 'round',
              visibility: visible ? 'visible' : 'none'
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
          }, firstLabelLayer); // Insert before labels
        }

        layersAdded.current = true;
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error('TrafficFlowLayer: Error adding layers', e);
        }
      }
    };

    // Add layers initially
    addTrafficLayers();

    // Re-add layers whenever style reloads (theme changes, etc)
    // This is critical because MapLibre wipes custom layers on style change
    map.on('style.load', addTrafficLayers);

    // Cleanup only on unmount
    return () => {
      map.off('style.load', addTrafficLayers);
      if (!map) return;
      try {
        if (map.getLayer(LAYER_ID)) {
          map.removeLayer(LAYER_ID);
        }
        if (map.getLayer(LAYER_ID_CASING)) {
          map.removeLayer(LAYER_ID_CASING);
        }
        if (map.getSource(SOURCE_ID)) {
          map.removeSource(SOURCE_ID);
        }
      } catch {
        // Map may have been destroyed
      }
      layersAdded.current = false;
    };
  }, [map, isDark]); // Note: visible not in deps - handled separately

  // Separate effect for visibility changes
  useEffect(() => {
    if (!map || !layersAdded.current) return;

    try {
      const visibility = visible ? 'visible' : 'none';
      if (map.getLayer(LAYER_ID)) {
        map.setLayoutProperty(LAYER_ID, 'visibility', visibility);
      }
      if (map.getLayer(LAYER_ID_CASING)) {
        map.setLayoutProperty(LAYER_ID_CASING, 'visibility', visibility);
      }
    } catch {
      // Layers may not exist yet
    }
  }, [map, visible]);

  // This component only manages map layers, no UI to render
  return null;
}

export default memo(TrafficFlowLayer);
