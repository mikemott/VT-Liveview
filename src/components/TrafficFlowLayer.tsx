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
  const isDarkRef = useRef(isDark);

  // Keep ref in sync with prop
  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  // Effect to add layers on mount, remove on unmount
  // IMPORTANT: isDark is NOT in the dependency array to prevent recreating
  // event listeners on every theme change. We use isDarkRef.current to get latest value.
  useEffect(() => {
    if (!map || !TOMTOM_API_KEY) {
      console.warn('TrafficFlowLayer: Component mounted but prerequisites missing', {
        hasMap: !!map,
        hasApiKey: !!TOMTOM_API_KEY
      });
      return;
    }

    const instanceId = Math.random().toString(36).substring(7);
    console.log(`TrafficFlowLayer: MOUNTING - Instance ID: ${instanceId}`);
    console.log('TrafficFlowLayer: API key value:', TOMTOM_API_KEY ? `${TOMTOM_API_KEY.substring(0, 10)}...` : 'UNDEFINED');

    const addTrafficLayers = (retryCount = 0) => {
      const styleLoaded = map.isStyleLoaded();
      console.log(`TrafficFlowLayer [${instanceId}]: Attempting to add layers`, {
        styleLoaded,
        retryCount,
        hasStyle: !!map.getStyle(),
        currentTheme: isDarkRef.current ? 'dark' : 'light'
      });

      if (!styleLoaded) {
        // Use both event listener AND timeout fallback to handle race conditions
        if (retryCount < 10) {
          console.log('TrafficFlowLayer: Style not loaded, scheduling retry');
          setTimeout(() => addTrafficLayers(retryCount + 1), 100);
        } else {
          console.error('TrafficFlowLayer: Failed to add layers after 10 retries - style never loaded');
        }
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
          const tileUrl = `https://api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.pbf?key=${TOMTOM_API_KEY}`;
          console.log('TrafficFlowLayer: Adding source with tile URL:', tileUrl.substring(0, 80) + '...');

          try {
            map.addSource(SOURCE_ID, {
              type: 'vector',
              tiles: [tileUrl],
              minzoom: 6,
              maxzoom: 18,
              attribution: '© TomTom'
            });
            console.log('TrafficFlowLayer: Source added successfully');
          } catch (sourceError) {
            console.error('TrafficFlowLayer: FAILED to add source!', sourceError);
            throw sourceError;
          }

          console.log('TrafficFlowLayer: Verifying source exists...', !!map.getSource(SOURCE_ID));
        } else {
          console.log('TrafficFlowLayer: Source already exists, skipping addSource');
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

        const visibilityValue = visible ? 'visible' : 'none';
        console.log('TrafficFlowLayer: Creating layers with visible =', visible, 'visibility =', visibilityValue);

        // Add casing layer (outline for visibility)
        if (!map.getLayer(LAYER_ID_CASING)) {
          const casingColor = isDarkRef.current ? '#000000' : '#ffffff';

          map.addLayer({
            id: LAYER_ID_CASING,
            type: 'line',
            source: SOURCE_ID,
            'source-layer': 'Traffic flow',
            layout: {
              'line-cap': 'round',
              'line-join': 'round'
            },
            paint: {
              'line-color': casingColor,
              'line-width': 4,
              'line-opacity': 0.5
            }
          }, firstLabelLayer); // Insert before labels

          // Explicitly set visibility after layer creation
          map.setLayoutProperty(LAYER_ID_CASING, 'visibility', visibilityValue);
        } else {
          // Layer already exists, just update the casing color to match current theme
          const casingColor = isDarkRef.current ? '#000000' : '#ffffff';
          map.setPaintProperty(LAYER_ID_CASING, 'line-color', casingColor);
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
              'line-join': 'round'
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

          // Explicitly set visibility after layer creation
          map.setLayoutProperty(LAYER_ID, 'visibility', visibilityValue);
        }

        layersAdded.current = true;

        // Verify visibility was set correctly
        const mainVis = map.getLayoutProperty(LAYER_ID, 'visibility');
        const casingVis = map.getLayoutProperty(LAYER_ID_CASING, 'visibility');

        console.log('TrafficFlowLayer: Successfully added traffic layers', {
          sourceExists: !!map.getSource(SOURCE_ID),
          mainLayerExists: !!map.getLayer(LAYER_ID),
          casingLayerExists: !!map.getLayer(LAYER_ID_CASING),
          mainVisibility: mainVis,
          casingVisibility: casingVis,
          visibleProp: visible
        });
      } catch (e) {
        // Always log errors - critical for debugging production issues
        console.error('TrafficFlowLayer: Error adding layers', e);
      }
    };

    // Add layers initially
    addTrafficLayers();

    // Re-add layers whenever style reloads (theme changes, etc)
    // This is critical because MapLibre wipes custom layers on style change
    map.on('style.load', addTrafficLayers);

    // Start periodic monitoring to detect layer disappearance
    const monitorInterval = setInterval(() => {
      if (!map) return;

      const sourceExists = !!map.getSource(SOURCE_ID);
      const layerExists = !!map.getLayer(LAYER_ID);
      const casingExists = !!map.getLayer(LAYER_ID_CASING);

      if (layersAdded.current && (!layerExists || !casingExists)) {
        console.error(`TrafficFlowLayer [${instanceId}]: LAYERS DISAPPEARED!`, {
          sourceExists,
          layerExists,
          casingExists,
          wasAdded: layersAdded.current
        });
      }

      if (layerExists) {
        const visibility = map.getLayoutProperty(LAYER_ID, 'visibility');
        if (visibility !== 'visible' && visible) {
          console.warn(`TrafficFlowLayer [${instanceId}]: Visibility changed unexpectedly to ${visibility}`);
        }
      }
    }, 2000);

    // Cleanup only on unmount
    return () => {
      console.log(`TrafficFlowLayer: CLEANUP RUNNING - Instance ID: ${instanceId} - WHY?`);
      clearInterval(monitorInterval);
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
  }, [map]); // isDark removed - handled in separate effect below

  // Separate effect for isDark changes (update paint colors only)
  useEffect(() => {
    if (!map || !layersAdded.current) return;

    try {
      const casingColor = isDark ? '#000000' : '#ffffff';
      if (map.getLayer(LAYER_ID_CASING)) {
        map.setPaintProperty(LAYER_ID_CASING, 'line-color', casingColor);
      }
    } catch {
      // Layer may not exist yet
    }
  }, [map, isDark]);

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
