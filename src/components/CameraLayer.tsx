import { useEffect, useRef, useState, memo } from 'react';
import { fetchCameras, type TrafficCamera } from '../services/cameraApi';
import { useVisibleInterval } from '../hooks/useVisibleInterval';
import { useMapMarkers, type BuiltMarker } from '../hooks/useMapMarkers';
import { createMapMarker } from '../utils/mapMarker';
import type { MapLibreMap } from '../types';

interface CameraLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  onCameraClick: (camera: TrafficCamera) => void;
  /** Called after each successful list fetch (search, shared links). */
  onCamerasLoaded?: (cameras: TrafficCamera[]) => void;
}

// Lucide "video" icon (hard-coded; white via currentColor)
const CAMERA_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"
       stroke-linejoin="round" aria-hidden="true">
    <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/>
    <rect x="2" y="6" width="14" height="12" rx="2"/>
  </svg>`;

function buildCameraMarker(camera: TrafficCamera): BuiltMarker {
  const element = createMapMarker({
    layer: 'trafficCameras',
    iconSvg: CAMERA_ICON,
    label: `Traffic camera: ${camera.name}${camera.online ? '' : ' (offline)'}`,
    title: camera.name,
    dimmed: !camera.online,
    className: `camera-marker${camera.online ? '' : ' offline'}`,
  });
  return { lngLat: [camera.lng, camera.lat], element };
}

const LIST_REFRESH_MS = 10 * 60 * 1000;

function CameraLayer({ map, visible, onCameraClick, onCamerasLoaded }: CameraLayerProps) {
  const [cameras, setCameras] = useState<TrafficCamera[]>([]);
  const onLoadedRef = useRef(onCamerasLoaded);
  useEffect(() => {
    onLoadedRef.current = onCamerasLoaded;
  }, [onCamerasLoaded]);

  // Fetch once there's a map (also for search/shared links while the layer is
  // hidden), then refresh every 10 minutes while the page is visible
  const [refreshTick, setRefreshTick] = useState(0);
  useVisibleInterval(() => setRefreshTick((t) => t + 1), map ? LIST_REFRESH_MS : null);
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const list = await fetchCameras();
        if (cancelled) return;
        setCameras(list);
        onLoadedRef.current?.(list);
      } catch (error) {
        if (import.meta.env.DEV) console.error('Error fetching traffic cameras:', error);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [map, refreshTick]);

  useMapMarkers(map, visible, cameras, buildCameraMarker, onCameraClick);

  return null;
}

export default memo(CameraLayer);
