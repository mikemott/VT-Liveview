import { useEffect, useRef, useState, memo } from 'react';
import { fetchRoadWeather, type RoadWeatherStation } from '../services/roadWeatherApi';
import { useVisibleInterval } from '../hooks/useVisibleInterval';
import { useMapMarkers, type BuiltMarker } from '../hooks/useMapMarkers';
import { createMapMarker } from '../utils/mapMarker';
import { getObservationAge } from '../utils/observationAge';
import { getRoadRisk, headlineTempF, ROAD_RISK_LABELS } from '../utils/roadWeather';
import type { MapLibreMap } from '../types';
import './RoadWeatherLayer.css';

interface RoadWeatherLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  onStationClick: (station: RoadWeatherStation) => void;
  /** Called after each successful fetch (search, shared links). */
  onStationsLoaded?: (stations: RoadWeatherStation[]) => void;
}

/** Stations report every ~5 minutes */
const REFRESH_MS = 5 * 60 * 1000;

/** Status fills; the slate layer color shows as the ring (VTL-64) */
const RISK_FILL: Partial<Record<ReturnType<typeof getRoadRisk>, string>> = {
  nearFreezing: '#b45309', // 33–36 °F
  freezing: '#0e7490', // ≤ 32 °F: ice cyan, not Stations blue
  hazard: '#b91c1c', // ice / snow / frost reported
};

function buildRoadWeatherMarker(station: RoadWeatherStation): BuiltMarker {
  const temp = headlineTempF(station);
  const risk = getRoadRisk(station);
  const stale = getObservationAge(station.observedAt).isStale;
  const reading = temp
    ? `${temp.kind === 'pavement' ? 'pavement' : 'air'} ${temp.value}°F`
    : 'no temperature';
  const fill = stale ? undefined : RISK_FILL[risk];
  const element = createMapMarker({
    layer: 'roadWeather',
    shape: 'pill',
    // textContent: no markup from the feed reaches the DOM as HTML
    text: temp ? `${temp.value}°` : '–',
    label: `Road weather: ${station.name}, ${reading}, ${ROAD_RISK_LABELS[risk].toLowerCase()}${
      stale ? ' (old reading)' : ''
    }`,
    title: station.name,
    ...(fill ? { statusFill: fill } : {}),
    dimmed: stale,
    className: [
      'road-weather-marker',
      `risk-${risk}`,
      temp?.kind === 'air' ? 'air-only' : '',
      stale ? 'stale' : '',
    ]
      .filter(Boolean)
      .join(' '),
  });
  // Most stations share a pole with a traffic camera: float the pill just above
  // the point (like a label) so a camera icon there doesn't cover the reading
  return { lngLat: [station.lng, station.lat], element, anchor: 'bottom', offset: [0, -14] };
}

function RoadWeatherLayer({
  map,
  visible,
  onStationClick,
  onStationsLoaded,
}: RoadWeatherLayerProps) {
  const [stations, setStations] = useState<RoadWeatherStation[]>([]);
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

  useMapMarkers(map, visible, stations, buildRoadWeatherMarker, onStationClick);

  return null;
}

export default memo(RoadWeatherLayer);
