import { useEffect, useRef, useState, useCallback } from 'react';
import { useRadarAnimation, getCurrentRadarTileUrl } from '../hooks/useRadarAnimation';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import './RadarOverlay.css';

export default function RadarOverlay({ map, isDark = false }) {
  const [visible, setVisible] = useState(true);
  const [opacity, setOpacity] = useState(0.7);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const layersInitialized = useRef(false);
  const previousFrameCount = useRef(0);
  const loadedSources = useRef(new Set());
  const preloadTimeoutRef = useRef(null);

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
  } = useRadarAnimation(map, { frameCount: 6, frameDelay: 500 });

  // Helper to safely check if layer exists
  const hasLayer = useCallback((layerId) => {
    if (!map || !map.isStyleLoaded()) return false;
    try {
      return !!map.getLayer(layerId);
    } catch {
      return false;
    }
  }, [map]);

  // Helper to safely check if source exists
  const hasSource = useCallback((sourceId) => {
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

    // If frames changed (e.g., after refresh), reinitialize
    if (frames.length !== previousFrameCount.current) {
      // Reset tile loading state
      setTilesLoaded(false);
      loadedSources.current.clear();

      // Clean up old layers
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

      // Create source and layer for each frame
      frames.forEach((frame, index) => {
        const sourceId = `radar-source-${index}`;
        const layerId = `radar-layer-${index}`;

        if (!hasSource(sourceId)) {
          map.addSource(sourceId, {
            type: 'raster',
            tiles: [frame.tileUrl],
            tileSize: 256,
            attribution: index === 0 ? 'Weather radar: RainViewer / NOAA' : ''
          });
        }

        if (!hasLayer(layerId)) {
          map.addLayer({
            id: layerId,
            type: 'raster',
            source: sourceId,
            layout: {
              visibility: 'visible' // Keep visible to preload tiles
            },
            paint: {
              'raster-opacity': 0, // Start transparent, increase after tiles load
              'raster-fade-duration': 0 // No fade during preload
            }
          });
        }
      });

      layersInitialized.current = true;
      previousFrameCount.current = frames.length;
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
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, frames, hasSource, hasLayer]);

  // Preload tiles by listening for data events
  useEffect(() => {
    if (!map || !layersInitialized.current || frames.length === 0 || tilesLoaded) return;

    const handleSourceData = (e) => {
      // Check if this is a radar source and tiles are loaded
      if (e.sourceId && e.sourceId.startsWith('radar-source-') && e.isSourceLoaded) {
        loadedSources.current.add(e.sourceId);

        // If all sources have loaded tiles, mark as ready
        if (loadedSources.current.size >= frames.length) {
          setTilesLoaded(true);
        }
      }
    };

    map.on('sourcedata', handleSourceData);

    // Fallback: If tiles don't load within 8 seconds, show anyway
    preloadTimeoutRef.current = setTimeout(() => {
      if (!tilesLoaded) {
        console.log('Radar tiles preload timeout, showing anyway');
        setTilesLoaded(true);
      }
    }, 8000);

    return () => {
      map.off('sourcedata', handleSourceData);
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, [map, frames, layersInitialized, tilesLoaded]);

  // Toggle opacity between layers based on current frame
  useEffect(() => {
    if (!map || !layersInitialized.current || frames.length === 0 || !tilesLoaded) return;

    // Show only the current frame by adjusting opacity
    frames.forEach((_, index) => {
      const layerId = `radar-layer-${index}`;
      if (hasLayer(layerId)) {
        const shouldShow = index === currentFrame && visible;
        // Use opacity for instant switching - no fade during animation
        map.setPaintProperty(layerId, 'raster-fade-duration', 0);
        map.setPaintProperty(layerId, 'raster-opacity', shouldShow ? opacity : 0);
      }
    });
  }, [map, currentFrame, visible, frames, hasLayer, tilesLoaded, opacity]);

  // Note: Opacity is now handled in the frame switching effect above
  // to avoid conflicts and ensure smooth transitions

  const formatTime = (isoString) => {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`radar-overlay ${isDark ? 'dark' : ''}`}>
      <div className="radar-header">
        <h3>Weather Radar</h3>
        <button
          className="visibility-toggle"
          onClick={() => setVisible(!visible)}
          title={visible ? 'Hide radar' : 'Show radar'}
        >
          {visible ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>

      {visible && (
        <>
          <div className="radar-controls">
            <button onClick={prevFrame} disabled={isLoading || !tilesLoaded} title="Previous frame">
              <SkipBack size={18} />
            </button>
            <button
              className="play-button"
              onClick={toggle}
              disabled={isLoading || frames.length === 0 || !tilesLoaded}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button onClick={nextFrame} disabled={isLoading || !tilesLoaded} title="Next frame">
              <SkipForward size={18} />
            </button>
            <button onClick={refresh} disabled={isLoading} title="Refresh radar">
              <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
            </button>
          </div>

          {!tilesLoaded && frames.length > 0 && (
            <div className="radar-preloading">
              <RefreshCw size={14} className="spinning" />
              <span>Loading radar tiles...</span>
            </div>
          )}

          <div className="radar-timeline">
            <div className="timeline-track">
              {frames.map((frame, idx) => (
                <button
                  key={idx}
                  className={`timeline-dot ${idx === currentFrame ? 'active' : ''} ${frame.isNowcast ? 'nowcast' : ''}`}
                  onClick={() => goToFrame(idx)}
                  title={formatTime(frame.time)}
                />
              ))}
            </div>
            <div className="timeline-time">
              {currentFrameData?.isNowcast && <span className="nowcast-badge">Forecast</span>}
              <span>{formatTime(currentFrameData?.time)}</span>
            </div>
          </div>

          <div className="opacity-control">
            <label>Opacity</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
            />
            <span>{Math.round(opacity * 100)}%</span>
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
