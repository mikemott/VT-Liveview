/**
 * Radar animation type definitions
 * Based on Iowa Environmental Mesonet (IEM) radar tiles
 */

/** Single radar frame */
export interface RadarFrame {
  /** Frame index (0-based) */
  index: number;
  /** Timestamp of the radar data */
  timestamp: Date;
  /** URL to the radar tile layer */
  tileUrl: string;
  /** Whether this frame has been loaded/cached */
  loaded: boolean;
}

/** Radar animation playback state */
export interface RadarAnimationState {
  /** Whether animation is currently playing */
  isPlaying: boolean;
  /** Current frame index being displayed */
  currentFrame: number;
  /** Total number of frames available */
  totalFrames: number;
  /** All radar frames */
  frames: RadarFrame[];
  /** Radar layer opacity (0-1) */
  opacity: number;
  /** Whether radar is visible on the map */
  isVisible: boolean;
  /** Whether frames are currently loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
}

/** Radar animation controls */
export interface RadarControls {
  /** Start/resume animation playback */
  play: () => void;
  /** Pause animation playback */
  pause: () => void;
  /** Toggle play/pause state */
  toggle: () => void;
  /** Jump to a specific frame */
  setFrame: (index: number) => void;
  /** Set radar layer opacity */
  setOpacity: (opacity: number) => void;
  /** Toggle radar visibility */
  toggleVisibility: () => void;
  /** Refresh/reload radar frames */
  refresh: () => Promise<void>;
}

/** Hook return type for useRadarAnimation */
export interface UseRadarAnimationReturn {
  state: RadarAnimationState;
  controls: RadarControls;
}

/** Radar configuration from constants */
export interface RadarConfig {
  /** Number of frames to fetch */
  frameCount: number;
  /** Delay between frames in ms */
  frameDelay: number;
  /** Default opacity for radar layer */
  defaultOpacity: number;
}
