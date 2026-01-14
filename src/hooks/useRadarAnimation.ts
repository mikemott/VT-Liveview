/**
 * Radar Animation Hook
 * Manages animated weather radar frames from RainViewer API
 * Falls back to static IEM radar tiles on error
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { RADAR_CONFIG, INTERVALS } from '@/utils/constants';
import type { MapLibreMap } from '@/types';

// =============================================================================
// Types
// =============================================================================

/** Single radar frame data */
export interface RadarFrameData {
  /** ISO timestamp string */
  time: string;
  /** Unix timestamp in seconds */
  timestamp: number;
  /** RainViewer path (null for fallback IEM tile) */
  path: string | null;
  /** Tile URL template with {z}/{x}/{y} placeholders */
  tileUrl: string;
  /** Whether this is a nowcast (forecast) frame */
  isNowcast?: boolean;
}

/** Options for useRadarAnimation hook */
export interface UseRadarAnimationOptions {
  /** Number of frames to fetch (default: RADAR_CONFIG.FRAME_COUNT) */
  frameCount?: number;
  /** Delay between frames in ms (default: RADAR_CONFIG.FRAME_DELAY) */
  frameDelay?: number;
  /** Auto-start playback (default: false) */
  autoPlay?: boolean;
}

/** Return value from useRadarAnimation hook */
export interface UseRadarAnimationReturn {
  /** All available radar frames */
  frames: RadarFrameData[];
  /** Current frame index */
  currentFrame: number;
  /** Current frame data (null if no frames) */
  currentFrameData: RadarFrameData | null;
  /** Whether animation is playing */
  isPlaying: boolean;
  /** Whether frames are loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Start playback */
  play: () => void;
  /** Stop playback */
  pause: () => void;
  /** Toggle play/pause */
  toggle: () => void;
  /** Jump to specific frame index */
  goToFrame: (index: number) => void;
  /** Advance to next frame */
  nextFrame: () => void;
  /** Go to previous frame */
  prevFrame: () => void;
  /** Refresh frame data from API */
  refresh: () => Promise<void>;
}

// =============================================================================
// Constants
// =============================================================================

/** Iowa Environmental Mesonet NEXRAD radar tiles (fallback) */
const IEM_RADAR_URL =
  'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/ridge::CONUS-NEXRAD-N0Q/{z}/{x}/{y}.png';

/** RainViewer API for animated frames */
const RAINVIEWER_API = 'https://api.rainviewer.com/public/weather-maps.json';

// =============================================================================
// RainViewer API Types
// =============================================================================

/** RainViewer frame data */
interface RainViewerFrame {
  time: number; // Unix timestamp in seconds
  path: string;
}

/** RainViewer radar data */
interface RainViewerRadar {
  past: RainViewerFrame[];
  nowcast?: RainViewerFrame[];
}

/** RainViewer API response */
interface RainViewerResponse {
  version: string;
  generated: number;
  host: string;
  radar: RainViewerRadar;
  satellite?: {
    infrared: RainViewerFrame[];
  };
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for managing animated weather radar frames
 * @param map - MapLibre map instance (unused but kept for API compatibility)
 * @param options - Animation options
 */
export function useRadarAnimation(
  _map: MapLibreMap | null,
  options: UseRadarAnimationOptions = {}
): UseRadarAnimationReturn {
  const {
    frameCount = RADAR_CONFIG.frameCount,
    frameDelay = RADAR_CONFIG.frameDelay,
    autoPlay = false,
  } = options;

  const [frames, setFrames] = useState<RadarFrameData[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch radar frames from RainViewer
  const fetchFrames = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(RAINVIEWER_API);
      if (!response.ok) throw new Error('Failed to fetch radar data');

      const data: RainViewerResponse = await response.json();
      const radarData = data.radar;

      if (!radarData?.past?.length) {
        throw new Error('No radar data available');
      }

      // Get the last N frames
      const pastFrames: RadarFrameData[] = radarData.past
        .slice(-frameCount)
        .map((frame) => ({
          time: new Date(frame.time * 1000).toISOString(),
          timestamp: frame.time,
          path: frame.path,
          tileUrl: `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
        }));

      // Add nowcast frames if available
      const nowcastFrames: RadarFrameData[] = (radarData.nowcast ?? [])
        .slice(0, 2)
        .map((frame) => ({
          time: new Date(frame.time * 1000).toISOString(),
          timestamp: frame.time,
          path: frame.path,
          tileUrl: `https://tilecache.rainviewer.com${frame.path}/256/{z}/{x}/{y}/2/1_1.png`,
          isNowcast: true,
        }));

      setFrames([...pastFrames, ...nowcastFrames]);
      setCurrentFrame(pastFrames.length - 1); // Start at most recent past frame
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Error fetching radar frames:', err);
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      // Fallback to static IEM tile
      setFrames([
        {
          time: new Date().toISOString(),
          timestamp: Date.now() / 1000,
          path: null,
          tileUrl: IEM_RADAR_URL,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [frameCount]);

  // Initial fetch
  useEffect(() => {
    void fetchFrames();

    // Refresh frames every 5 minutes
    const refreshInterval = setInterval(() => {
      void fetchFrames();
    }, INTERVALS.RADAR_REFRESH);

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
      setCurrentFrame((prev) => (prev + 1) % frames.length);
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
  const toggle = useCallback(() => setIsPlaying((prev) => !prev), []);

  const goToFrame = useCallback(
    (index: number) => {
      if (index >= 0 && index < frames.length) {
        setCurrentFrame(index);
      }
    },
    [frames.length]
  );

  const nextFrame = useCallback(() => {
    if (frames.length === 0) return;
    setCurrentFrame((prev) => (prev + 1) % frames.length);
  }, [frames.length]);

  const prevFrame = useCallback(() => {
    if (frames.length === 0) return;
    setCurrentFrame((prev) => (prev - 1 + frames.length) % frames.length);
  }, [frames.length]);

  return {
    frames,
    currentFrame,
    currentFrameData: frames[currentFrame] ?? null,
    isPlaying,
    isLoading,
    error,
    play,
    pause,
    toggle,
    goToFrame,
    nextFrame,
    prevFrame,
    refresh: fetchFrames,
  };
}
