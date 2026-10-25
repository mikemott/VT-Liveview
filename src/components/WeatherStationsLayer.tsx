/**
 * Weather observation stations (NWS + USGS water temperature).
 *
 * Markers come from the shared builder (VTL-64): a blue circle with the
 * temperature; USGS water stations add a droplet. Clicking opens the station
 * in the side panel.
 */
import { useState, useEffect, useRef, memo } from 'react';
import { graphqlClient } from '../services/graphqlClient';
import { gql } from 'graphql-request';
import { INTERVALS } from '../utils/constants';
import { useVisibleInterval } from '../hooks/useVisibleInterval';
import { useMapMarkers, type BuiltMarker } from '../hooks/useMapMarkers';
import { createMapMarker } from '../utils/mapMarker';
import { getObservationAge } from '../utils/observationAge';
import type { MapLibreMap, ObservationStation } from '../types';

interface StationsResponse {
  observationStations: ObservationStation[];
}

interface WeatherStationsLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  onStationClick: (station: ObservationStation) => void;
  /** Called after each successful stations fetch (used to restore a shared selection). */
  onStationsLoaded?: (stations: ObservationStation[]) => void;
}

const STATIONS_QUERY = gql`
  query GetObservationStations {
    observationStations {
      id
      name
      location {
        lat
        lng
      }
      elevation
      weather {
        temperature
        temperatureUnit
        description
        windSpeed
        windDirection
        humidity
        dewpoint
        pressure
        timestamp
      }
    }
  }
`;

// Lucide Droplet icon as static SVG (a React root per marker was never unmounted)
const DROPLET_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
       fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
       stroke-linejoin="round">
    <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>
  </svg>
`;

const isNum = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

function buildStationMarker(station: ObservationStation): BuiltMarker {
  const isWaterTemp = station.id.startsWith('USGS-');
  // Grey out readings that are too old to describe current conditions (VTL-50)
  const age = getObservationAge(station.weather?.timestamp);
  const temp = station.weather?.temperature;
  const tempDisplay = isNum(temp) ? `${Math.round(temp)}°` : 'N/A';

  // Lead the name with the visible reading so speech/voice control matches
  // what is shown (FINDINGS H15)
  const reading = isWaterTemp ? `${tempDisplay} water temperature` : tempDisplay;
  const staleNote = age.isStale && age.ago ? `, reading from ${age.ago}` : '';

  const element = createMapMarker({
    layer: 'weatherStations',
    text: tempDisplay,
    ...(isWaterTemp ? { iconSvg: DROPLET_ICON } : {}),
    label: `${reading}, ${station.name}${staleNote}`,
    title: station.name,
    dimmed: age.isStale,
    className: ['weather-station-marker', isWaterTemp ? 'water' : '', age.isStale ? 'stale' : '']
      .filter(Boolean)
      .join(' '),
  });
  return { lngLat: [station.location.lng, station.location.lat], element };
}

function WeatherStationsLayer({
  map,
  visible,
  onStationClick,
  onStationsLoaded,
}: WeatherStationsLayerProps) {
  const [stations, setStations] = useState<ObservationStation[]>([]);

  // Ref so a new callback identity doesn't refetch
  const onStationsLoadedRef = useRef(onStationsLoaded);
  useEffect(() => {
    onStationsLoadedRef.current = onStationsLoaded;
  }, [onStationsLoaded]);

  // Fetch once there's a map, then every 15 minutes while the page is visible
  const [refreshTick, setRefreshTick] = useState(0);
  useVisibleInterval(() => setRefreshTick((t) => t + 1), map ? INTERVALS.STATIONS_REFRESH : null);
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const data = await graphqlClient.request<StationsResponse>(STATIONS_QUERY);
        if (cancelled) return;
        setStations(data.observationStations);
        onStationsLoadedRef.current?.(data.observationStations);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error fetching weather stations:', error);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [map, refreshTick]);

  useMapMarkers(map, visible, stations, buildStationMarker, onStationClick);

  return null;
}

export default memo(WeatherStationsLayer);
