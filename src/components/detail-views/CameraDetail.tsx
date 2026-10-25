/**
 * CameraDetail - latest snapshot from a VTrans traffic camera (VTL-56)
 */
import { useEffect, useRef, useState } from 'react';
import { MapPin, RefreshCw, VideoOff } from 'lucide-react';
import { fetchCameraImage, type CameraImage, type TrafficCamera } from '../../services/cameraApi';
import { useVisibleInterval } from '../../hooks/useVisibleInterval';
import { getObservationAge } from '../../utils/observationAge';
import LayerBadge from './LayerBadge';
import './DetailViews.css';

/** How often to reload the picture while the panel is open. */
const REFRESH_MS = 60_000;

interface CameraDetailProps {
  camera: TrafficCamera;
  isDark: boolean;
}

type ImageState =
  | { status: 'loading' }
  | { status: 'ready'; image: CameraImage }
  | { status: 'none' }
  | { status: 'error' };

export default function CameraDetail({ camera, isDark }: CameraDetailProps) {
  const [state, setState] = useState<ImageState>({ status: 'loading' });
  const [tick, setTick] = useState(0);

  // Reload every minute while the page is visible; catches up on return
  useVisibleInterval(() => setTick((t) => t + 1), REFRESH_MS);

  // The object URL currently shown; revoked when replaced or on unmount
  const shownUrl = useRef<string | null>(null);
  const show = (next: ImageState): void => {
    const nextUrl = next.status === 'ready' ? next.image.url : null;
    if (shownUrl.current && shownUrl.current !== nextUrl) URL.revokeObjectURL(shownUrl.current);
    shownUrl.current = nextUrl;
    setState(next);
  };
  useEffect(
    () => () => {
      if (shownUrl.current) URL.revokeObjectURL(shownUrl.current);
      shownUrl.current = null;
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchCameraImage(camera.id, controller.signal)
      .then((image) => {
        if (controller.signal.aborted) {
          if (image) URL.revokeObjectURL(image.url);
          return;
        }
        show(image ? { status: 'ready', image } : { status: 'none' });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (import.meta.env.DEV) console.error('Camera image failed:', error);
        // Keep showing the last good picture on a failed refresh
        if (!shownUrl.current) show({ status: 'error' });
      });
    return () => controller.abort();
  }, [camera.id, tick]);

  const age =
    state.status === 'ready' && state.image.takenAt
      ? getObservationAge(state.image.takenAt.toISOString())
      : null;
  const where = [camera.roadway, camera.direction && `${camera.direction}bound`]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={`detail-view camera-detail ${isDark ? 'dark' : ''}`}>
      <LayerBadge layer="trafficCameras" label="Traffic camera" />
      <div className="station-name">{camera.name}</div>
      {where && (
        <div className="station-location">
          <MapPin size={14} />
          <span>{where}</span>
        </div>
      )}

      <div className="camera-image-frame">
        {state.status === 'ready' && (
          <img src={state.image.url} alt={`Latest view from ${camera.name}`} />
        )}
        {state.status === 'loading' && (
          <div className="camera-image-placeholder">Loading image…</div>
        )}
        {(state.status === 'none' || state.status === 'error') && (
          <div className="camera-image-placeholder">
            <VideoOff size={28} aria-hidden="true" />
            <span>
              {state.status === 'none'
                ? 'This camera has no current image.'
                : "Couldn't load the camera image right now."}
            </span>
          </div>
        )}
      </div>

      <div className={`camera-caption${age?.isStale ? ' stale' : ''}`} role="status">
        {age ? (
          <>
            {age.isStale ? '⚠️ Old image: ' : 'Image '}
            {age.ago} ({age.asOf})
          </>
        ) : state.status === 'ready' ? (
          'Latest image'
        ) : null}
        {state.status === 'ready' && (
          <span className="camera-refresh-note">
            <RefreshCw size={12} aria-hidden="true" /> updates every minute while open
          </span>
        )}
      </div>

      <div className="station-updated">Source: VTrans traffic cameras</div>
    </div>
  );
}
