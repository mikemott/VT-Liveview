/**
 * Ski resort base cameras, checked and resolved by the backend (VTL-88).
 * Shape matches backend/src/services/skiWebcams.ts.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export interface ResolvedWebcam {
  name: string;
  /** live = player on tap; panorama = player on tap, no preview; still = image only */
  kind: 'live' | 'panorama' | 'still';
  preview: string | null;
  /** Snapshot image: add a cache-busting stamp so an open panel stays fresh */
  refreshPreview: boolean;
  embed: string | null;
}

export interface ResortWebcam {
  page: string;
  camera: ResolvedWebcam | null;
  status: 'ok' | 'offline' | 'unavailable';
  reason?: string;
}

export interface SkiWebcams {
  checkedAt: string;
  youtubeLookup: boolean;
  resorts: Record<string, ResortWebcam>;
}

export async function fetchSkiWebcams(): Promise<SkiWebcams> {
  const res = await fetch(`${BACKEND_URL}/api/ski-webcams`);
  if (!res.ok) throw new Error(`Ski webcams HTTP ${res.status}`);
  return (await res.json()) as SkiWebcams;
}

/** Ten-minute cache key for still images */
export function snapshotStamp(now: number = Date.now()): number {
  return Math.floor(now / 600_000);
}

/** The preview URL to load, with a stamp for snapshots */
export function previewUrl(camera: ResolvedWebcam, now: number = Date.now()): string | null {
  if (!camera.preview) return null;
  if (!camera.refreshPreview) return camera.preview;
  return `${camera.preview}${camera.preview.includes('?') ? '&' : '?'}t=${snapshotStamp(now)}`;
}
