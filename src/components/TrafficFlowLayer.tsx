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
  const visibleRef = useRef(visible);

  // Keep refs in sync with props
  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  // Effect to add layers on mount, remove on unmount
  // IMPORTANT: isDark is NOT in the dependency array to prevent recreating
  // event listeners on every theme change. We use isDarkRef.current to get latest value.
  useEffect(() => {
    if (!map) {
      console.warn('TrafficFlowLayer: Map not available yet');
      return;
    }

    if (!TOMTOM_API_KEY) {
      console.error('TrafficFlowLayer: VITE_TOMTOM_API_KEY environment variable is not set!');
      console.error('TrafficFlowLayer: Traffic flow layer will not work without an API key');
      console.error('TrafficFlowLayer: Get a free API key at https://developer.tomtom.com/');
      return;
    }

    const instanceId = Math.random().toString(36).substring(7);
    if (import.meta.env.DEV) {
      console.log(`TrafficFlowLayer: MOUNTING - Instance ID: ${instanceId}`);
      console.log('TrafficFlowLayer: API key value:', TOMTOM_API_KEY ? `${TOMTOM_API_KEY.substring(0, 10)}...` : 'UNDEFINED');
    }

    const addTrafficLayers = (retryCount = 0) => {
      const styleLoaded = map.isStyleLoaded();
      if (import.meta.env.DEV) {
        console.log(`TrafficFlowLayer [${instanceId}]: Attempting to add layers`, {
          styleLoaded,
          retryCount,
          hasStyle: !!map.getStyle(),
          currentTheme: isDarkRef.current ? 'dark' : 'light'
        });
      }

      if (!styleLoaded) {
        // Use both event listener AND timeout fallback to handle race conditions
        if (retryCount < 10) {
          if (import.meta.env.DEV) {
            console.log('TrafficFlowLayer: Style not loaded, scheduling retry');
          }
          // Increased delay to 200ms to give style more time to stabilize
          setTimeout(() => addTrafficLayers(retryCount + 1), 200);
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
              minzoom: 0, // Changed from 6 to 0 to ensure tiles load at all zoom levels
              maxzoom: 22, // Increased to match TomTom's max
              attribution: '© TomTom'
            });
            console.log('TrafficFlowLayer: Source added successfully');

            // Add event listeners to debug tile loading
            map.on('sourcedataloading', (e) => {
              if (e.sourceId === SOURCE_ID && import.meta.env.DEV) {
                console.log('TrafficFlowLayer: Tiles loading from source');
              }
            });

            map.on('sourcedata', (e) => {
              if (e.sourceId === SOURCE_ID && e.isSourceLoaded && import.meta.env.DEV) {
                console.log('TrafficFlowLayer: Source data loaded', {
                  tileID: e.tile?.tileID,
                  loaded: e.isSourceLoaded
                });
              }
            });

            map.on('error', (e) => {
              const err = e.error as any;
              if (err?.url?.includes('tomtom.com')) {
                console.error('TrafficFlowLayer: TomTom tile loading error:', {
                  message: err.message,
                  url: err.url,
                  status: err.status
                });
              }
            });
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
                0, '#dc2626',      // Red (stopped)
                0.25, '#ea580c',   // Orange
                0.5, '#eab308',    // Yellow
                0.75, '#84cc16',   // Light green
                1, '#22c55e'       // Green (free flow)
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

        // Check if layers still exist after 50ms, 200ms, 500ms, 1000ms
        const checkDelays = [50, 200, 500, 1000];
        checkDelays.forEach(delay => {
          setTimeout(() => {
            const stillExists = !!map.getLayer(LAYER_ID);
            const casingStillExists = !!map.getLayer(LAYER_ID_CASING);
            const sourceStillExists = !!map.getSource(SOURCE_ID);

            if (!stillExists || !casingStillExists) {
              console.error(`TrafficFlowLayer: Layers disappeared after ${delay}ms!`, {
                mainLayerExists: stillExists,
                casingExists: casingStillExists,
                sourceExists: sourceStillExists
              });
            } else {
              console.log(`TrafficFlowLayer: Layers still exist after ${delay}ms ✓`);
            }
          }, delay);
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
    // Add small delay after style.load to ensure style is fully ready
    const handleStyleLoad = () => {
      // Wait for next tick to ensure style is fully settled
      setTimeout(() => addTrafficLayers(), 50);
    };

    map.on('style.load', handleStyleLoad);

    // Start periodic monitoring to detect layer disappearance
    // Using 100ms interval to catch immediate disappearance
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
          wasAdded: layersAdded.current,
          timestamp: new Date().toISOString()
        });

        // Check all layers on the map to see if something else was added
        const allLayers = map.getStyle()?.layers?.map(l => l.id) || [];
        console.error(`TrafficFlowLayer: Current layers on map:`, allLayers);
      }

      if (layerExists) {
        const visibility = map.getLayoutProperty(LAYER_ID, 'visibility');
        // Use visibleRef.current to get latest value (avoid stale closure)
        if (visibility !== 'visible' && visibleRef.current) {
          console.warn(`TrafficFlowLayer [${instanceId}]: Visibility changed unexpectedly to ${visibility}`);
        }
      }
    }, 100); // Changed from 2000ms to 100ms to catch immediate disappearance

    // Cleanup only on unmount
    return () => {
      if (import.meta.env.DEV) {
        console.log(`TrafficFlowLayer: CLEANUP RUNNING - Instance ID: ${instanceId} - WHY?`);
      }
      clearInterval(monitorInterval);
      map.off('style.load', handleStyleLoad);
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
