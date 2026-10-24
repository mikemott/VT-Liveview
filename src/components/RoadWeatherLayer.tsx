import { useEffect, useRef, useState, memo } from 'react';
import maplibregl from 'maplibre-gl';
import { fetchRoadWeather, type RoadWeatherStation } from '../services/roadWeatherApi';
import { useVisibleInterval } from '../hooks/useVisibleInterval';
import { getObservationAge } from '../utils/observationAge';
import { getRoadRisk, headlineTempF, ROAD_RISK_LABELS } from '../utils/roadWeather';
import type { MapLibreMap, Marker } from '../types';
import './RoadWeatherLayer.css';

interface RoadWeatherLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  onStationClick: (station: RoadWeatherStation) => void;
  /** Called after each successful fetch (search, shared links). */
  onStationsLoaded?: (stations: RoadWeatherStation[]) => void;
}

interface MarkerEntry {
  marker: Marker;
  element: HTMLDivElement;
  handler: (e: MouseEvent) => void;
}

/** Stations report every ~5 minutes */
const REFRESH_MS = 5 * 60 * 1000;

function createRoadWeatherMarker(station: RoadWeatherStation): HTMLDivElement {
  const temp = headlineTempF(station);
  const risk = getRoadRisk(station);
  const stale = getObservationAge(station.observedAt).isStale;

  const el = document.createElement('div');
  el.className = [
    'road-weather-marker',
    `risk-${risk}`,
    temp?.kind === 'air' ? 'air-only' : '',
    stale ? 'stale' : '',
  ]
    .filter(Boolean)
    .join(' ');
  // textContent: no markup from the feed reaches innerHTML
  el.textContent = temp ? `${temp.value}°` : '–';
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  const reading = temp
    ? `${temp.kind === 'pavement' ? 'pavement' : 'air'} ${temp.value}°F`
    : 'no temperature';
  el.setAttribute(
    'aria-label',
    `Road weather: ${station.name}, ${reading}, ${ROAD_RISK_LABELS[risk].toLowerCase()}${
      stale ? ' (old reading)' : ''
    }`,
  );
  el.title = station.name;
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.click();
    }
  });
  return el;
}

function RoadWeatherLayer({
  map,
  visible,
  onStationClick,
  onStationsLoaded,
}: RoadWeatherLayerProps) {
  const [stations, setStations] = useState<RoadWeatherStation[]>([]);
  const markersRef = useRef<MarkerEntry[]>([]);
  const onLoadedRef = useRef(onStationsLoaded);
  useEffect(() => {
    onLoadedRef.current = onStationsLoaded;
  }, [onStationsLoaded]);

  // Fetch once there's a map (also while hidden, for search and shared links),
  // then refresh every 5 minutes while the page is visible
  const [refreshTick, setRefreshTick] = useState(0);
  useVisibleInterval(() => setRefreshTick((t) => t + 1), map ? REFRESH_MS : null);
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const list = await fetchRoadWeather();
        if (cancelled) return;
        setStations(list);
        onLoadedRef.current?.(list);
      } catch (error) {
        if (import.meta.env.DEV) console.error('Error fetching road weather:', error);
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

    for (const station of stations) {
      const element = createRoadWeatherMarker(station);
      const handler = (e: MouseEvent): void => {
        e.stopPropagation();
        onStationClick(station);
      };
      element.addEventListener('click', handler);
      const marker = new maplibregl.Marker({ element })
        .setLngLat([station.lng, station.lat])
        .addTo(map);
      markersRef.current.push({ marker, element, handler });
    }
    return clear;
  }, [map, visible, stations, onStationClick]);

  return null;
}

export default memo(RoadWeatherLayer);
