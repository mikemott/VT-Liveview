/**
 * VTrans traffic cameras via the backend (VTL-56).
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export interface TrafficCamera {
  id: string;
  name: string;
  lat: number;
  lng: number;
  roadway: string | null;
  direction: string | null;
  online: boolean;
}

export async function fetchCameras(): Promise<TrafficCamera[]> {
  const res = await fetch(`${BACKEND_URL}/api/cameras`);
  if (!res.ok) throw new Error(`Traffic cameras unavailable (HTTP ${res.status})`);
  const body = (await res.json()) as { cameras?: TrafficCamera[] };
  return body.cameras ?? [];
}

export interface CameraImage {
  /** Object URL for an <img>; the caller must revoke it. */
  url: string;
  /** When the picture was taken, from the backend's Last-Modified header. */
  takenAt: Date | null;
}

/**
 * Latest snapshot for a camera, or null if it has no current image (404).
 * Uses fetch (not a bare <img src>) so the capture time can be read.
 */
export async function fetchCameraImage(
  id: string,
  signal?: AbortSignal,
): Promise<CameraImage | null> {
  const res = await fetch(`${BACKEND_URL}/api/cameras/${encodeURIComponent(id)}/snapshot.jpg`, {
    cache: 'no-cache', // revalidate: the image changes every few minutes
    ...(signal ? { signal } : {}),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Camera image unavailable (HTTP ${res.status})`);
  const lastModified = res.headers.get('Last-Modified');
  const takenAt = lastModified ? new Date(lastModified) : null;
  return {
    url: URL.createObjectURL(await res.blob()),
    takenAt: takenAt && !Number.isNaN(takenAt.getTime()) ? takenAt : null,
  };
}
