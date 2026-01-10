import { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Droplets, Radar, RefreshCw } from 'lucide-react';
import './MapTilerRadar.css';

// MapTiler Weather API configuration
const MAPTILER_API_KEY = import.meta.env.VITE_MAPTILER_API_KEY;

// Weather data layer types
const LAYER_TYPES = {
  RADAR: {
    id: 'radar',
    name: 'Radar',
    icon: Radar,
    // MapTiler radar tiles endpoint
    getTileUrl: (timestamp) =>
      `https://api.maptiler.com/tiles/radar/{z}/{x}/{y}.png?key=${MAPTILER_API_KEY}${timestamp ? `&time=${timestamp}` : ''}`,
    legendColors: ['#00ff00', '#32cd32', '#ffff00', '#ffa500', '#ff4500', '#ff0000', '#8b0000'],
    legendLabels: ['Light', 'Moderate', 'Heavy', 'Extreme'],
    legendTitle: 'Radar Reflectivity (dBZ)'
  },
  PRECIPITATION: {
    id: 'precipitation',
    name: 'Precip',
    icon: Droplets,
    getTileUrl: (timestamp) =>
      `https://api.maptiler.com/tiles/precipitation/{z}/{x}/{y}.png?key=${MAPTILER_API_KEY}${timestamp ? `&time=${timestamp}` : ''}`,
    legendColors: ['#e0f7fa', '#4dd0e1', '#00bcd4', '#0097a7', '#006064'],
    legendLabels: ['0', '1', '5', '10+'],
    legendTitle: 'Precipitation (mm/h)'
  }
};

// Generate timestamps for animation frames (past 2 hours + future 4 hours)
function generateTimeframes() {
  const frames = [];
  const now = new Date();
  // Round to nearest 15 minutes
  now.setMinutes(Math.floor(now.getMinutes() / 15) * 15, 0, 0);

  // Past 2 hours (8 frames at 15-min intervals)
  for (let i = -8; i <= 0; i++) {
    const time = new Date(now.getTime() + i * 15 * 60 * 1000);
    frames.push({
      timestamp: time.toISOString(),
      offsetMinutes: i * 15,
      label: formatTimeLabel(time, now)
    });
  }

  // Future forecast (next 4 hours, at 30-min intervals)
  for (let i = 1; i <= 8; i++) {
    const time = new Date(now.getTime() + i * 30 * 60 * 1000);
    frames.push({
      timestamp: time.toISOString(),
      offsetMinutes: i * 30,
      label: formatTimeLabel(time, now),
      isForecast: true
    });
  }

  return frames;
}

function formatTimeLabel(time, now) {
  const diffMinutes = Math.round((time - now) / (60 * 1000));

  if (diffMinutes === 0) return 'Now';
  if (diffMinutes < 0) {
    const mins = Math.abs(diffMinutes);
    if (mins < 60) return `-${mins}m`;
    return `-${Math.round(mins / 60)}h`;
  }
  if (diffMinutes < 60) return `+${diffMinutes}m`;
  return `+${Math.round(diffMinutes / 60)}h`;
}

function MapTilerRadar({ map, visible, opacity, onOpacityChange }) {
  const [layerType, setLayerType] = useState('RADAR');
  const [frames, setFrames] = useState([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const animationRef = useRef(null);
  const sourcesAddedRef = useRef(new Set());

  // Initialize frames on mount
  useEffect(() => {
    const timeframes = generateTimeframes();
    setFrames(timeframes);
    // Start at "now" frame (index 8)
    setCurrentFrameIndex(8);
  }, []);

  // Get current layer config
  const layerConfig = LAYER_TYPES[layerType];
  const currentFrame = frames[currentFrameIndex];

  // Add/update radar source and layer
  useEffect(() => {
    if (!map || !visible || frames.length === 0 || !MAPTILER_API_KEY) {
      if (!MAPTILER_API_KEY) {
        setError('MapTiler API key not configured');
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    const sourceId = `maptiler-weather-${layerConfig.id}`;
    const layerId = `maptiler-weather-layer-${layerConfig.id}`;

    try {
      // Remove other layer types if they exist
      Object.values(LAYER_TYPES).forEach(config => {
        const otherId = `maptiler-weather-layer-${config.id}`;
        const otherSourceId = `maptiler-weather-${config.id}`;
        if (config.id !== layerConfig.id) {
          if (map.getLayer(otherId)) {
            map.removeLayer(otherId);
          }
          if (map.getSource(otherSourceId)) {
            map.removeSource(otherSourceId);
          }
        }
      });

      // Get tile URL for current timestamp
      const timestamp = currentFrame?.timestamp;
      const tileUrl = layerConfig.getTileUrl(timestamp);

      // Update or add source
      if (map.getSource(sourceId)) {
        // Update existing source tiles
        const source = map.getSource(sourceId);
        if (source.setTiles) {
          source.setTiles([tileUrl]);
        } else {
          // Remove and re-add if setTiles not available
          if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
          }
          map.removeSource(sourceId);

          map.addSource(sourceId, {
            type: 'raster',
            tiles: [tileUrl],
            tileSize: 256,
            attribution: '<a href="https://www.maptiler.com/weather/" target="_blank">© MapTiler Weather</a>'
          });

          map.addLayer({
            id: layerId,
            type: 'raster',
            source: sourceId,
            paint: {
              'raster-opacity': opacity,
              'raster-fade-duration': 0
            }
          }, 'alert-fills'); // Add below alert layers if they exist
        }
      } else {
        // Add new source and layer
        map.addSource(sourceId, {
          type: 'raster',
          tiles: [tileUrl],
          tileSize: 256,
          attribution: '<a href="https://www.maptiler.com/weather/" target="_blank">© MapTiler Weather</a>'
        });

        // Find the right position for the layer (above base map, below alerts)
        let beforeLayerId = undefined;
        if (map.getLayer('alert-fills')) {
          beforeLayerId = 'alert-fills';
        }

        map.addLayer({
          id: layerId,
          type: 'raster',
          source: sourceId,
          paint: {
            'raster-opacity': opacity,
            'raster-fade-duration': 0
          }
        }, beforeLayerId);

        sourcesAddedRef.current.add(sourceId);
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error setting up weather layer:', err);
      setError('Failed to load weather data');
      setIsLoading(false);
    }

    // Cleanup
    return () => {
      // Don't remove on every re-render, only on unmount
    };
  }, [map, visible, layerConfig, currentFrameIndex, frames]);

  // Update opacity
  useEffect(() => {
    if (!map) return;

    const layerId = `maptiler-weather-layer-${layerConfig.id}`;
    if (map.getLayer(layerId)) {
      map.setPaintProperty(layerId, 'raster-opacity', opacity);
    }
  }, [map, opacity, layerConfig]);

  // Handle visibility
  useEffect(() => {
    if (!map) return;

    const layerId = `maptiler-weather-layer-${layerConfig.id}`;
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    }
  }, [map, visible, layerConfig]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying || frames.length === 0) {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    animationRef.current = setInterval(() => {
      setCurrentFrameIndex(prev => {
        const next = prev + 1;
        return next >= frames.length ? 0 : next;
      });
    }, 500); // 500ms per frame for smooth animation

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
    };
  }, [isPlaying, frames.length]);

  // Playback controls
  const togglePlayback = () => setIsPlaying(!isPlaying);

  const skipBackward = useCallback(() => {
    setIsPlaying(false);
    setCurrentFrameIndex(prev => Math.max(0, prev - 1));
  }, []);

  const skipForward = useCallback(() => {
    setIsPlaying(false);
    setCurrentFrameIndex(prev => Math.min(frames.length - 1, prev + 1));
  }, [frames.length]);

  const handleTimelineChange = useCallback((e) => {
    setIsPlaying(false);
    setCurrentFrameIndex(parseInt(e.target.value, 10));
  }, []);

  const refreshData = useCallback(() => {
    const timeframes = generateTimeframes();
    setFrames(timeframes);
    setCurrentFrameIndex(8); // Reset to "now"
  }, []);

  if (!visible) return null;

  const LayerIcon = layerConfig.icon;

  return (
    <div className="maptiler-radar-control">
      {/* Layer Type Selector */}
      <div className="layer-type-selector">
        {Object.entries(LAYER_TYPES).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <button
              key={key}
              className={`layer-type-btn ${layerType === key ? 'active' : ''}`}
              onClick={() => setLayerType(key)}
              title={config.name}
            >
              <Icon size={16} />
              <span>{config.name}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="radar-error">
          <span>{error}</span>
        </div>
      )}

      {/* Timeline Display */}
      <div className="timeline-display">
        <span className="current-time">
          {currentFrame?.label || 'Loading...'}
          {isLoading && <RefreshCw size={14} className="loading-icon" />}
        </span>
        {currentFrame?.isForecast && (
          <span className="forecast-label">Forecast</span>
        )}
      </div>

      {/* Playback Controls */}
      <div className="playback-controls">
        <button onClick={skipBackward} className="playback-btn" title="Previous frame" disabled={currentFrameIndex === 0}>
          <SkipBack size={16} />
        </button>
        <button onClick={togglePlayback} className="playback-btn play-btn" title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button onClick={skipForward} className="playback-btn" title="Next frame" disabled={currentFrameIndex === frames.length - 1}>
          <SkipForward size={16} />
        </button>
        <button onClick={refreshData} className="playback-btn refresh-btn" title="Refresh data">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Timeline Slider */}
      <div className="timeline-slider-container">
        <input
          type="range"
          min="0"
          max={frames.length - 1}
          step="1"
          value={currentFrameIndex}
          onChange={handleTimelineChange}
          className="timeline-slider"
        />
        <div className="timeline-labels">
          <span>-2h</span>
          <span className="timeline-now-marker">Now</span>
          <span>+4h</span>
        </div>
        {/* Progress indicator */}
        <div className="timeline-progress">
          <div
            className="timeline-progress-bar"
            style={{ width: `${(currentFrameIndex / (frames.length - 1)) * 100}%` }}
          />
          <div
            className="timeline-now-indicator"
            style={{ left: `${(8 / (frames.length - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Opacity Control */}
      <div className="opacity-control">
        <label>Opacity</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={opacity}
          onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
          className="opacity-slider"
        />
        <span className="opacity-value">{Math.round(opacity * 100)}%</span>
      </div>

      {/* Legend */}
      <div className="radar-legend">
        <div className="legend-title">
          {layerConfig.legendTitle}
        </div>
        <div className="legend-bar">
          <div
            className="legend-gradient"
            style={{
              background: `linear-gradient(to right, ${layerConfig.legendColors.join(', ')})`
            }}
          />
        </div>
        <div className="legend-labels">
          {layerConfig.legendLabels.map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MapTilerRadar;
