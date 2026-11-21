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

/** Where a camera is, in words, from VTrans's 511 GIS (VTL-94) */
export interface CameraLocation {
  town: string | null;
  county: string | null;
  /** Posted interstate mile marker */
  milepost: number | null;
  nearestExit: {
    number: string;
    name: string;
    /** Straight-line miles from the exit */
    distanceMi: number;
    /** Which way the camera is from the exit */
    direction: string;
  } | null;
  /** Local name of the road here ("Franklin St") */
  streetName: string | null;
  /** "4200 block of US Route 2" */
  addressBlock: string | null;
  speedLimitMph: number | null;
}

export async function fetchCameraLocation(id: string): Promise<CameraLocation> {
  const res = await fetch(`${BACKEND_URL}/api/cameras/${encodeURIComponent(id)}/location`);
  if (!res.ok) throw new Error(`Camera location unavailable (HTTP ${res.status})`);
  const body = (await res.json()) as { location: CameraLocation };
  return body.location;
}
