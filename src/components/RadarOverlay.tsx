import { useEffect, useState, useCallback, ChangeEvent } from 'react';
import { useRadarAnimation, type RadarFrameData } from '../hooks/useRadarAnimation';
import { Play, Pause, SkipBack, SkipForward, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { RADAR_CONFIG } from '../utils/constants';
import type { MapLibreMap } from '../types';
import './RadarOverlay.css';

interface RadarOverlayProps {
  map: MapLibreMap | null;
  isDark?: boolean;
  collapsed?: boolean;
}

export default function RadarOverlay({
  map,
  isDark = false,
  collapsed = false,
}: RadarOverlayProps) {
  const [visible, setVisible] = useState(true);
  const [opacity, setOpacity] = useState(0.7);
  // Number of frame layers the current add loop has put on the map
  const [layersAdded, setLayersAdded] = useState(0);
  const tilesLoaded = layersAdded > 0;

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
    refresh,
  } = useRadarAnimation(map, {
    frameCount: RADAR_CONFIG.frameCount,
    frameDelay: RADAR_CONFIG.frameDelay,
  });

  // Look layers/sources up directly: map.isStyleLoaded() is false while tiles are
  // loading, so guarding on it skipped init and cleanup (FINDINGS H11).
  const hasLayer = useCallback(
    (layerId: string): boolean => {
      if (!map) return false;
      try {
        return !!map.getLayer(layerId);
      } catch {
        return false;
      }
    },
    [map],
  );

  const hasSource = useCallback(
    (sourceId: string): boolean => {
      if (!map) return false;
      try {
        return !!map.getSource(sourceId);
      } catch {
        return false;
      }
    },
    [map],
  );

  // Build one radar layer per frame for smooth transitions, rebuilt whenever the
  // frame list changes (count or URLs). Sources are added one at a time, 400ms apart,
  // to avoid RainViewer rate limiting: its 429 responses lack CORS headers and surface
  // as CORS errors. The loop is cancelled on cleanup so a stale loop never writes into
  // a refreshed frame set or a replaced style (FINDINGS H10).
  useEffect(() => {
    if (!map || frames.length === 0) return;

    let cancelled = false;
    const count = frames.length;

    const addSourcesSequentially = async () => {
      for (let index = 0; index < count; index++) {
        if (cancelled) return;
        const frame = frames[index];
        if (!frame) continue;
        const sourceId = `radar-source-${index}`;
        const layerId = `radar-layer-${index}`;

        try {
          if (hasLayer(layerId)) map.removeLayer(layerId);
          if (hasSource(sourceId)) map.removeSource(sourceId);

          map.addSource(sourceId, {
            type: 'raster',
            tiles: [frame.tileUrl],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 7, // RainViewer maximum zoom level
            scheme: 'xyz',
            attribution: index === 0 ? 'Weather radar: RainViewer / NOAA' : '',
          });

          // Start hidden and transparent; the visibility effect below shows only the
          // current frame, so hidden frames never load tiles.
          map.addLayer({
            id: layerId,
            type: 'raster',
            source: sourceId,
            layout: { visibility: 'none' },
            paint: {
              'raster-opacity': 0,
              'raster-fade-duration': 0,
            },
          });
        } catch (err) {
          // The style is being replaced (theme change); the remounted overlay rebuilds.
          if (import.meta.env.DEV) {
            console.warn('[RadarOverlay] Could not add radar layer:', err);
          }
          return;
        }

        setLayersAdded(index + 1);

        if (index < count - 1) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
    };

    void addSourcesSequentially();

    return () => {
      cancelled = true;
      for (let i = 0; i < count; i++) {
        const layerId = `radar-layer-${i}`;
        const sourceId = `radar-source-${i}`;
        if (hasLayer(layerId)) map.removeLayer(layerId);
        if (hasSource(sourceId)) map.removeSource(sourceId);
      }
      setLayersAdded(0);
    };
  }, [map, frames, hasSource, hasLayer]);

  // Show only the current frame. visibility:'none' stops MapLibre loading tiles for
  // hidden frames, avoiding rate limits. Re-runs as each layer is added, so the
  // current frame appears as soon as its layer exists.
  useEffect(() => {
    if (!map || layersAdded === 0) return;

    if (import.meta.env.DEV) {
      console.log('[RadarOverlay] Toggling frame visibility:', {
        currentFrame,
        visible,
        opacity,
        totalFrames: frames.length,
      });
    }

    frames.forEach((_: RadarFrameData, index: number) => {
      const layerId = `radar-layer-${index}`;
      if (hasLayer(layerId)) {
        const shouldShow = index === currentFrame && visible;

        if (import.meta.env.DEV && shouldShow) {
          console.log(`[RadarOverlay] Making ${layerId} visible with opacity ${opacity}`);
        }

        map.setLayoutProperty(layerId, 'visibility', shouldShow ? 'visible' : 'none');

        if (shouldShow) {
          map.setPaintProperty(layerId, 'raster-fade-duration', 0);
          map.setPaintProperty(layerId, 'raster-opacity', opacity);
        }
      }
    });
  }, [map, currentFrame, visible, frames, hasLayer, opacity, layersAdded]);

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
              onClick={() => void refresh()}
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
            aria-valuetext={
              frames.length === 0
                ? 'No frames available'
                : `Frame ${currentFrame + 1} of ${frames.length}: ${formatTime(currentFrameData?.time)}`
            }
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
