import { useState, useEffect, useCallback, useRef } from 'react';

// Iowa Environmental Mesonet NEXRAD radar tiles
const IEM_RADAR_URL = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::CONUS-NEXRAD-N0Q/{z}/{x}/{y}.png';

// RainViewer API for animated frames
const RAINVIEWER_API = 'https://api.rainviewer.com/public/weather-maps.json';

export function useRadarAnimation(map, options = {}) {
  const {
    frameCount = 6,
    frameDelay = 700, // ms between frames
    autoPlay = false
  } = options;

  const [frames, setFrames] = useState([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  // Fetch radar frames from RainViewer
  const fetchFrames = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(RAINVIEWER_API);
      if (!response.ok) throw new Error('Failed to fetch radar data');

      const data = await response.json();
      const radarData = data.radar;

      if (!radarData?.past?.length) {
        throw new Error('No radar data available');
      }

      // Get the last N frames
      // Tile URL format: /{path}/{size}/{z}/{x}/{y}/{color}/{smooth}_{snow}.png
      // color: 0-8 (we use 2 for blue/green), smooth: 0=no 1=yes, snow: 0=no 1=yes
      const pastFrames = radarData.past.slice(-frameCount).map(frame => ({
        time: new Date(frame.time * 1000).toISOString(),
        timestamp: frame.time,
        path: frame.path,
        tileUrl: `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/6/1_1.png`
      }));

      // Add nowcast frames if available
      const nowcastFrames = (radarData.nowcast || []).slice(0, 2).map(frame => ({
        time: new Date(frame.time * 1000).toISOString(),
        timestamp: frame.time,
        path: frame.path,
        tileUrl: `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/6/1_1.png`,
        isNowcast: true
      }));

      setFrames([...pastFrames, ...nowcastFrames]);
      setCurrentFrame(pastFrames.length - 1); // Start at most recent past frame
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Error fetching radar frames:', err);
      }
      setError(err.message);

      // Fallback to static IEM tile
      setFrames([{
        time: new Date().toISOString(),
        timestamp: Date.now() / 1000,
        path: null,
        tileUrl: IEM_RADAR_URL
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [frameCount]);

  // Initial fetch
  useEffect(() => {
    fetchFrames();

    // Refresh frames every 5 minutes
    const refreshInterval = setInterval(fetchFrames, 5 * 60 * 1000);
    return () => clearInterval(refreshInterval);
  }, [fetchFrames]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying || frames.length === 0) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % frames.length);
    }, frameDelay);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, frames.length, frameDelay]);

  // Note: Tile updates are now handled by RadarOverlay component
  // to avoid duplicate setTiles() calls and flickering

  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const toggle = useCallback(() => setIsPlaying(prev => !prev), []);

  const goToFrame = useCallback((index) => {
    if (index >= 0 && index < frames.length) {
      setCurrentFrame(index);
    }
  }, [frames.length]);

  const nextFrame = useCallback(() => {
    setCurrentFrame(prev => (prev + 1) % frames.length);
  }, [frames.length]);

  const prevFrame = useCallback(() => {
    setCurrentFrame(prev => (prev - 1 + frames.length) % frames.length);
  }, [frames.length]);

  return {
    frames,
    currentFrame,
    currentFrameData: frames[currentFrame] || null,
    isPlaying,
    isLoading,
    error,
    play,
    pause,
    toggle,
    goToFrame,
    nextFrame,
    prevFrame,
    refresh: fetchFrames
  };
}
