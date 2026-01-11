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
  const layerInitialized = useRef(false);

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
  } = useRadarAnimation(map, { frameCount: 6, frameDelay: 700 });

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

  // Initialize radar layer
  useEffect(() => {
    if (!map || layerInitialized.current) return;

    const initLayer = () => {
      if (!map.isStyleLoaded() || hasSource('radar')) return;

      // Add radar source with initial URL
      const initialUrl = frames[0]?.tileUrl || getCurrentRadarTileUrl();

      map.addSource('radar', {
        type: 'raster',
        tiles: [initialUrl],
        tileSize: 256,
        attribution: 'Weather radar: RainViewer / NOAA'
      });

      map.addLayer({
        id: 'radar-layer',
        type: 'raster',
        source: 'radar',
        paint: {
          'raster-opacity': opacity,
          'raster-fade-duration': 0
        }
      });

      layerInitialized.current = true;
    };

    // Wait for style to load
    if (map.isStyleLoaded()) {
      initLayer();
    } else {
      map.once('style.load', initLayer);
    }

    return () => {
      if (hasLayer('radar-layer')) {
        map.removeLayer('radar-layer');
      }
      if (hasSource('radar')) {
        map.removeSource('radar');
      }
      layerInitialized.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, hasSource, hasLayer]);

  // Update radar tiles when frame changes
  useEffect(() => {
    if (!map || !currentFrameData || !hasSource('radar')) return;

    const source = map.getSource('radar');
    if (source) {
      source.setTiles([currentFrameData.tileUrl]);
    }
  }, [map, currentFrameData, hasSource]);

  // Update visibility
  useEffect(() => {
    if (!hasLayer('radar-layer')) return;
    map.setLayoutProperty('radar-layer', 'visibility', visible ? 'visible' : 'none');
  }, [map, visible, hasLayer]);

  // Update opacity
  useEffect(() => {
    if (!hasLayer('radar-layer')) return;
    map.setPaintProperty('radar-layer', 'raster-opacity', opacity);
  }, [map, opacity, hasLayer]);

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
            <button onClick={prevFrame} disabled={isLoading} title="Previous frame">
              <SkipBack size={18} />
            </button>
            <button
              className="play-button"
              onClick={toggle}
              disabled={isLoading || frames.length === 0}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button onClick={nextFrame} disabled={isLoading} title="Next frame">
              <SkipForward size={18} />
            </button>
            <button onClick={refresh} disabled={isLoading} title="Refresh radar">
              <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
            </button>
          </div>

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
