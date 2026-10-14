import { useEffect, useRef, useState, useCallback, ChangeEvent } from 'react';
import { useRadarAnimation, type RadarFrameData } from '../hooks/useRadarAnimation';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { RADAR_CONFIG } from '../utils/constants';
import type { MapLibreMap } from '../types';
import './RadarOverlay.css';

interface RadarOverlayProps {
  map: MapLibreMap | null;
  isDark?: boolean;
  collapsed?: boolean;
}

export default function RadarOverlay({ map, isDark = false, collapsed = false }: RadarOverlayProps) {
  const [visible, setVisible] = useState(true);
  const [opacity, setOpacity] = useState(0.7);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const layersInitialized = useRef(false);
  const previousFrameCount = useRef(0);
  const loadedSources = useRef(new Set<string>());

  const {
    frames,
    currentFrame,
    currentFrameData,
    isPlaying,
    isLoading,
    toggle,
    nextFrame,
    prevFrame,
    goToFrame,
    refresh
  } = useRadarAnimation(map, {
    frameCount: RADAR_CONFIG.frameCount,
    frameDelay: RADAR_CONFIG.frameDelay,
  });

  // Helper to safely check if layer exists
  const hasLayer = useCallback((layerId: string): boolean => {
    if (!map || !map.isStyleLoaded()) return false;
    try {
      return !!map.getLayer(layerId);
    } catch {
      return false;
    }
  }, [map]);

  // Helper to safely check if source exists
  const hasSource = useCallback((sourceId: string): boolean => {
    if (!map || !map.isStyleLoaded()) return false;
    try {
      return !!map.getSource(sourceId);
    } catch {
      return false;
    }
  }, [map]);

  // Initialize multiple radar layers (one per frame) for smooth transitions
  useEffect(() => {
    if (!map || !map.isStyleLoaded() || frames.length === 0) return;

    const currentCount = frames.length;
    const previousCount = previousFrameCount.current;

    // If frame count changed, we need to add/remove layers
    if (currentCount !== previousCount) {
      // Reset tile loading state
      setTilesLoaded(false);
      loadedSources.current.clear();

      // Remove extra layers if count decreased
      if (currentCount < previousCount) {
        for (let i = currentCount; i < previousCount; i++) {
          const layerId = `radar-layer-${i}`;
          const sourceId = `radar-source-${i}`;
          if (hasLayer(layerId)) {
            map.removeLayer(layerId);
          }
          if (hasSource(sourceId)) {
            map.removeSource(sourceId);
          }
        }
      }

      // Add sources sequentially with delays to avoid RainViewer rate limiting (429 errors)
      // Loading all 4 frames at once causes CORS errors due to 429 responses lacking CORS headers
      const addSourcesSequentially = async () => {
        for (let index = 0; index < frames.length; index++) {
          const frame = frames[index];
          if (!frame) continue;
          const sourceId = `radar-source-${index}`;
          const layerId = `radar-layer-${index}`;

          // If source exists, remove and recreate with new URL
          if (hasSource(sourceId)) {
            if (hasLayer(layerId)) {
              map.removeLayer(layerId);
            }
            map.removeSource(sourceId);
          }

          // Add source with current frame URL
          map.addSource(sourceId, {
            type: 'raster',
            tiles: [frame.tileUrl],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 7,  // RainViewer maximum zoom level
            scheme: 'xyz',
            attribution: index === 0 ? 'Weather radar: RainViewer / NOAA' : ''
          });

          // Add layer - start hidden to prevent tile loading
          // Only the current frame will be set to visible, avoiding rate limits
          map.addLayer({
            id: layerId,
            type: 'raster',
            source: sourceId,
            layout: {
              visibility: index === frames.length - 1 ? 'visible' : 'none' // Only show most recent frame initially
            },
            paint: {
              'raster-opacity': 0, // Start transparent, increase after tiles load
              'raster-fade-duration': 0 // No fade during preload
            }
          });

          // Wait 400ms before adding next source to avoid rate limiting
          // This prevents RainViewer from returning 429 (Too Many Requests)
          if (index < frames.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 400));
          }
        }
      };

      void addSourcesSequentially();

      layersInitialized.current = true;
      previousFrameCount.current = currentCount;
    } else if (currentCount > 0 && layersInitialized.current) {
      // Frame count same but URLs may have changed (refresh)
      // Update sources without full layer recreation to avoid flicker
      let needsUpdate = false;

      frames.forEach((_frame: RadarFrameData, index: number) => {
        const sourceId = `radar-source-${index}`;
        if (hasSource(sourceId)) {
          // Check if URL changed by comparing with previous frame
          // Since we can't directly compare, we'll update on every refresh
          // This is triggered by the 5-minute interval
          needsUpdate = true;
        }
      });

      if (needsUpdate) {
        setTilesLoaded(false);
        loadedSources.current.clear();

        // Update sources sequentially with delays to avoid rate limiting
        const updateSourcesSequentially = async () => {
          for (let index = 0; index < frames.length; index++) {
            const frame = frames[index];
            if (!frame) continue;
            const sourceId = `radar-source-${index}`;
            const layerId = `radar-layer-${index}`;

            if (hasSource(sourceId) && hasLayer(layerId)) {
              // Hide layer temporarily
              map.setPaintProperty(layerId, 'raster-opacity', 0);

              // Remove and recreate source with new URL
              map.removeLayer(layerId);
              map.removeSource(sourceId);

              map.addSource(sourceId, {
                type: 'raster',
                tiles: [frame.tileUrl],
                tileSize: 256,
                minzoom: 0,
                maxzoom: 7,  // RainViewer maximum zoom level
                scheme: 'xyz',
                attribution: index === 0 ? 'Weather radar: RainViewer / NOAA' : ''
              });

              map.addLayer({
                id: layerId,
                type: 'raster',
                source: sourceId,
                layout: {
                  visibility: index === frames.length - 1 ? 'visible' : 'none'
                },
                paint: {
                  'raster-opacity': 0,
                  'raster-fade-duration': 0
                }
              });

              // Wait 400ms before updating next source
              if (index < frames.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 400));
              }
            }
          }
        };

        void updateSourcesSequentially();
      }
    }

    return () => {
      // Cleanup all layers and sources
      for (let i = 0; i < previousFrameCount.current; i++) {
        const layerId = `radar-layer-${i}`;
        const sourceId = `radar-source-${i}`;
        if (hasLayer(layerId)) {
          map.removeLayer(layerId);
        }
        if (hasSource(sourceId)) {
          map.removeSource(sourceId);
        }
      }
      layersInitialized.current = false;
      previousFrameCount.current = 0;
      loadedSources.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, frames, hasSource, hasLayer]);

  // Mark tiles as loaded immediately since we're using lazy loading
  // Each frame loads its tiles only when visible, so no preload wait needed
  useEffect(() => {
    if (!map || !layersInitialized.current || frames.length === 0) return;

    // With lazy loading (visibility: 'none'), tiles load on-demand
    // No need to wait for all sources - mark as ready immediately
    setTilesLoaded(true);
  }, [map, frames, layersInitialized.current]);

  // Toggle visibility and opacity between layers based on current frame
  // Using visibility:'none' prevents MapLibre from loading tiles, avoiding rate limits
  useEffect(() => {
    if (!map || !layersInitialized.current || frames.length === 0) return;

    if (import.meta.env.DEV) {
      console.log('[RadarOverlay] Toggling frame visibility:', {
        currentFrame,
        visible,
        opacity,
        totalFrames: frames.length
      });
    }

    // Show only the current frame by adjusting both visibility and opacity
    frames.forEach((_: RadarFrameData, index: number) => {
      const layerId = `radar-layer-${index}`;
      if (hasLayer(layerId)) {
        const shouldShow = index === currentFrame && visible;

        if (import.meta.env.DEV && shouldShow) {
          console.log(`[RadarOverlay] Making ${layerId} visible with opacity ${opacity}`);
        }

        // Set visibility - 'none' prevents tile loading (avoids rate limits)
        map.setLayoutProperty(layerId, 'visibility', shouldShow ? 'visible' : 'none');

        // Set opacity - only visible layer gets opacity
        if (shouldShow) {
          map.setPaintProperty(layerId, 'raster-fade-duration', 0);
          map.setPaintProperty(layerId, 'raster-opacity', opacity);
        }
      }
    });
  }, [map, currentFrame, visible, frames, hasLayer, opacity]);

  // Note: Opacity is now handled in the frame switching effect above
  // to avoid conflicts and ensure smooth transitions

  const formatTime = (isoString: string | undefined): string => {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleOpacityChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setOpacity(parseFloat(e.target.value));
  };

  // When collapsed (stargazing mode), show minimal UI
  if (collapsed) {
    return (
      <div className={`radar-overlay ${isDark ? 'dark' : ''} collapsed`}>
        <div className="radar-header collapsed">
          <h3>Weather Radar</h3>
          <span className="collapsed-hint">Hidden for stargazing</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`radar-overlay ${isDark ? 'dark' : ''}`}>
      <div className="radar-header">
        <h3>Weather Radar</h3>
        <button
          className="visibility-toggle"
          onClick={() => setVisible(!visible)}
          title={visible ? 'Hide radar' : 'Show radar'}
          aria-label={visible ? 'Hide radar overlay' : 'Show radar overlay'}
          aria-pressed={visible}
        >
          {visible ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>

      {visible && (
        <>
          <div className="radar-controls">
            <button
              onClick={prevFrame}
              disabled={isLoading || !tilesLoaded}
              title="Previous frame"
              aria-label="Previous radar frame"
            >
              <SkipBack size={18} />
            </button>
            <button
              className="play-button"
              onClick={toggle}
              disabled={isLoading || frames.length === 0 || !tilesLoaded}
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label={isPlaying ? 'Pause radar animation' : 'Play radar animation'}
              aria-pressed={isPlaying}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button
              onClick={nextFrame}
              disabled={isLoading || !tilesLoaded}
              title="Next frame"
              aria-label="Next radar frame"
            >
              <SkipForward size={18} />
            </button>
            <button
              onClick={refresh}
              disabled={isLoading}
              title="Refresh radar"
              aria-label="Refresh radar data"
            >
              <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
            </button>
          </div>

          {!tilesLoaded && frames.length > 0 && (
            <div className="radar-preloading">
              <RefreshCw size={14} className="spinning" />
              <span>Loading radar tiles...</span>
            </div>
          )}

          <div
            className="radar-timeline"
            role="slider"
            aria-label="Radar timeline"
            aria-valuemin={0}
            aria-valuemax={Math.max(0, frames.length - 1)}
            aria-valuenow={Math.max(0, Math.min(currentFrame, Math.max(0, frames.length - 1)))}
            aria-valuetext={frames.length === 0 ? 'No frames available' : `Frame ${currentFrame + 1} of ${frames.length}: ${formatTime(currentFrameData?.time)}`}
            tabIndex={frames.length === 0 ? -1 : 0}
            aria-disabled={frames.length === 0}
            onKeyDown={(e) => {
              if (frames.length === 0) return;
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                prevFrame();
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                nextFrame();
              }
            }}
          >
            <div className="timeline-track">
              {frames.map((frame: RadarFrameData, idx: number) => (
                <button
                  key={idx}
                  className={`timeline-dot ${idx === currentFrame ? 'active' : ''} ${frame.isNowcast ? 'nowcast' : ''}`}
                  onClick={() => goToFrame(idx)}
                  title={formatTime(frame.time)}
                  aria-label={`Go to frame ${idx + 1}: ${formatTime(frame.time)}${frame.isNowcast ? ' (forecast)' : ''}`}
                />
              ))}
            </div>
            <div className="timeline-time">
              {currentFrameData?.isNowcast && <span className="nowcast-badge">Forecast</span>}
              <span>{formatTime(currentFrameData?.time)}</span>
            </div>
          </div>

          <div className="opacity-control">
            <label htmlFor="radar-opacity">Opacity</label>
            <input
              id="radar-opacity"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={opacity}
              onChange={handleOpacityChange}
              aria-label="Radar overlay opacity"
              aria-valuemin={0}
              aria-valuemax={1}
              aria-valuenow={opacity}
              aria-valuetext={`${Math.round(opacity * 100)} percent`}
            />
            <span aria-live="polite">{Math.round(opacity * 100)}%</span>
          </div>

          <div className="radar-legend">
            <div className="legend-title">Intensity</div>
            <div className="legend-bar">
              <div className="legend-gradient" />
              <div className="legend-labels">
                <span>Light</span>
                <span>Heavy</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
