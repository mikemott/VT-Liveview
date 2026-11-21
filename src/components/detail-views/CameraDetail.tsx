/**
 * CameraDetail - latest snapshot from a VTrans traffic camera (VTL-56), with
 * where it is in words and the road weather at the same site (VTL-94)
 */
import { useEffect, useRef, useState } from 'react';
import { MapPin, RefreshCw, VideoOff } from 'lucide-react';
import { fetchCameraImage, type CameraImage, type TrafficCamera } from '../../services/cameraApi';
import { locationRows } from '../../utils/cameraLocation';
import type { RoadWeatherStation } from '../../services/roadWeatherApi';
import { useVisibleInterval } from '../../hooks/useVisibleInterval';
import { useCameraLocation, useSiteRoadWeather } from '../../hooks/useCameraSite';
import { getObservationAge } from '../../utils/observationAge';
import { cToF, getRoadRisk, ROAD_RISK_LABELS } from '../../utils/roadWeather';
import LayerBadge from './LayerBadge';
import './DetailViews.css';

/** How often to reload the picture while the panel is open. */
const REFRESH_MS = 60_000;

interface CameraDetailProps {
  camera: TrafficCamera;
  isDark: boolean;
}

const fmtTemp = (c: number | null): string | null => (c === null ? null : `${cToF(c)}°F`);

function SiteRoadWeather({ station }: { station: RoadWeatherStation }) {
  const age = getObservationAge(station.observedAt);
  const rows: [string, string | null][] = [
    ['Conditions', ROAD_RISK_LABELS[getRoadRisk(station)]],
    ['Surface', station.surface],
    ['Pavement', fmtTemp(station.pavementTempC)],
    ['Air', fmtTemp(station.airTempC)],
  ];
  return (
    <section className="camera-site-weather" aria-label="Road weather at this camera">
      <h3 className="camera-section-title">Road weather here</h3>
      <dl className="detail-rows">
        {rows
          .filter((row): row is [string, string] => row[1] !== null)
          .map(([label, value]) => (
            <div key={label} className="detail-row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      {age.ago && (
        <div className={`camera-caption${age.isStale ? ' stale' : ''}`}>
          {age.isStale ? '⚠️ Old reading: ' : 'Reading '}
          {age.ago} · {station.name}
        </div>
      )}
    </section>
  );
}

type ImageState =
  | { status: 'loading' }
  | { status: 'ready'; image: CameraImage }
  | { status: 'none' }
  | { status: 'error' };

export default function CameraDetail({ camera, isDark }: CameraDetailProps) {
  const [state, setState] = useState<ImageState>({ status: 'loading' });
  const { data: location } = useCameraLocation(camera.id);
  const siteStation = useSiteRoadWeather(camera);
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

      <section className="camera-location" aria-label="Camera location">
        <h3 className="camera-section-title">Location</h3>
        <dl className="detail-rows">
          {locationRows(camera, location).map(([label, value]) => (
            <div key={label} className="detail-row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <a
          className="camera-map-link"
          href={`https://www.google.com/maps/search/?api=1&query=${camera.lat},${camera.lng}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open in Maps ↗
        </a>
      </section>

      {siteStation && <SiteRoadWeather station={siteStation} />}

      <div className="station-updated">
        Source: VTrans traffic cameras; location from the VTrans 511 GIS
        {siteStation ? ' and road weather station' : ''}
      </div>
    </div>
  );
}
