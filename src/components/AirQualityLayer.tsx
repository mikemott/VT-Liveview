/**
 * Air quality monitors (VTL-76): EPA AirNow sites in and around Vermont, each a
 * pill with its current AQI, tinted by EPA category.
 */
import { useEffect, useRef, useState, memo } from 'react';
import { fetchAirQualityMonitors, type AirQualityMonitor } from '../services/airQualityApi';
import { useVisibleInterval } from '../hooks/useVisibleInterval';
import { useMapMarkers, type BuiltMarker } from '../hooks/useMapMarkers';
import { createMapMarker } from '../utils/mapMarker';
import { aqiCategory, isAirReadingStale, pollutantLabel } from '../utils/aqi';
import type { MapLibreMap } from '../types';

interface AirQualityLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  onMonitorClick: (monitor: AirQualityMonitor) => void;
  /** Called after each successful fetch (search, shared links). */
  onMonitorsLoaded?: (monitors: AirQualityMonitor[]) => void;
}

/** Readings are hourly; the backend caches for 20 minutes */
const REFRESH_MS = 20 * 60 * 1000;

function buildAirQualityMarker(monitor: AirQualityMonitor): BuiltMarker {
  const category = aqiCategory(monitor.category);
  const stale = isAirReadingStale(monitor.observedAt);
  const element = createMapMarker({
    layer: 'airQuality',
    shape: 'pill',
    // textContent: no markup from the feed reaches the DOM as HTML
    text: String(monitor.aqi),
    label: `Air quality: ${monitor.name}, AQI ${monitor.aqi}, ${category.name.toLowerCase()} (${pollutantLabel(
      monitor.pollutant,
    )})${stale ? ' (old reading)' : ''}`,
    title: `${monitor.name}: ${category.name}`,
    statusFill: category.color,
    dimmed: stale,
    className: ['air-quality-marker', `aqi-${monitor.category}`, stale ? 'stale' : '']
      .filter(Boolean)
      .join(' '),
  });
  return { lngLat: [monitor.lng, monitor.lat], element };
}

function AirQualityLayer({ map, visible, onMonitorClick, onMonitorsLoaded }: AirQualityLayerProps) {
  const [monitors, setMonitors] = useState<AirQualityMonitor[]>([]);
  const onLoadedRef = useRef(onMonitorsLoaded);
  useEffect(() => {
    onLoadedRef.current = onMonitorsLoaded;
  }, [onMonitorsLoaded]);

  // Fetch once there's a map (also while hidden, for search and shared links),
  // then refresh while the page is visible
  const [refreshTick, setRefreshTick] = useState(0);
  useVisibleInterval(() => setRefreshTick((t) => t + 1), map ? REFRESH_MS : null);
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const list = await fetchAirQualityMonitors();
        if (cancelled) return;
        setMonitors(list);
        onLoadedRef.current?.(list);
      } catch (error) {
        if (import.meta.env.DEV) console.error('Error fetching air quality monitors:', error);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [map, refreshTick]);

  useMapMarkers(map, visible, monitors, buildAirQualityMarker, onMonitorClick);

  return null;
}

export default memo(AirQualityLayer);
