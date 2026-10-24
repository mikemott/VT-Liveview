import { useEffect, useRef, useState, memo } from 'react';
import maplibregl from 'maplibre-gl';
import { fetchCameras, type TrafficCamera } from '../services/cameraApi';
import { useVisibleInterval } from '../hooks/useVisibleInterval';
import type { MapLibreMap, Marker } from '../types';
import './CameraLayer.css';

interface CameraLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  onCameraClick: (camera: TrafficCamera) => void;
  /** Called after each successful list fetch (search, shared links). */
  onCamerasLoaded?: (cameras: TrafficCamera[]) => void;
}

interface MarkerEntry {
  marker: Marker;
  element: HTMLDivElement;
  handler: (e: MouseEvent) => void;
}

// Lucide "video" icon
const CAMERA_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
       fill="none" stroke="white" stroke-width="2.25" stroke-linecap="round"
       stroke-linejoin="round" aria-hidden="true">
    <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/>
    <rect x="2" y="6" width="14" height="12" rx="2"/>
  </svg>`;

function createCameraMarker(camera: TrafficCamera): HTMLDivElement {
  const el = document.createElement('div');
  el.className = `camera-marker${camera.online ? '' : ' offline'}`;
  // MapLibre positions `el` with a transform; visuals and hover zoom live on
  // the inner body so they never fight that transform (VTL-63)
  el.innerHTML = `<span class="camera-marker-body">${CAMERA_ICON}</span>`;
  // Keyboard and screen-reader access, like the station markers
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  el.setAttribute(
    'aria-label',
    `Traffic camera: ${camera.name}${camera.online ? '' : ' (offline)'}`,
  );
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.click();
    }
  });
  return el;
}

const LIST_REFRESH_MS = 10 * 60 * 1000;

function CameraLayer({ map, visible, onCameraClick, onCamerasLoaded }: CameraLayerProps) {
  const [cameras, setCameras] = useState<TrafficCamera[]>([]);
  const markersRef = useRef<MarkerEntry[]>([]);
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

  useEffect(() => {
    const clear = (): void => {
      for (const { marker, element, handler } of markersRef.current) {
        element.removeEventListener('click', handler);
        marker.remove();
      }
      markersRef.current = [];
    };
    clear();
    if (!map || !visible) return clear;

    for (const camera of cameras) {
      const element = createCameraMarker(camera);
      const handler = (e: MouseEvent): void => {
        e.stopPropagation();
        onCameraClick(camera);
      };
      element.addEventListener('click', handler);
      const marker = new maplibregl.Marker({ element })
        .setLngLat([camera.lng, camera.lat])
        .addTo(map);
      markersRef.current.push({ marker, element, handler });
    }
    return clear;
  }, [map, visible, cameras, onCameraClick]);

  return null;
}

export default memo(CameraLayer);
