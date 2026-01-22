import { useState, useEffect, useRef, memo } from 'react';
import maplibregl from 'maplibre-gl';
import { graphqlClient } from '../services/graphqlClient';
import { gql } from 'graphql-request';
import { INTERVALS } from '../utils/constants';
import type { MapLibreMap, Marker, ObservationStation } from '../types';
import './WeatherStationsLayer.css';

// =============================================================================
// Types
// =============================================================================

interface StationsResponse {
  observationStations: ObservationStation[];
}

interface MarkerEntry {
  marker: Marker;
  element: HTMLDivElement;
  handler: (e: MouseEvent) => void;
}

interface WeatherStationsLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  onStationClick?: (station: ObservationStation) => void;
}

// =============================================================================
// GraphQL Query
// =============================================================================

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

// =============================================================================
// Helper Functions
// =============================================================================

function createWeatherStationMarker(station: ObservationStation): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'weather-station-marker';

  // Color based on temperature
  const temp = station.weather.temperature;
  let color: string;
  if (temp < 32) {
    color = '#3b82f6'; // Blue for freezing
  } else if (temp < 50) {
    color = '#06b6d4'; // Cyan for cold
  } else if (temp < 70) {
    color = '#10b981'; // Green for mild
  } else if (temp < 85) {
    color = '#f59e0b'; // Amber for warm
  } else {
    color = '#ef4444'; // Red for hot
  }

  el.style.cssText = `
    width: 28px;
    height: 28px;
    background: ${color};
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: box-shadow 0.2s ease, border-width 0.2s ease;
    font-size: 10px;
    font-weight: 700;
    color: white;
  `;

  el.textContent = `${Math.round(station.weather.temperature)}°`;

  // Use box-shadow glow effect on hover instead of transform
  el.addEventListener('mouseenter', () => {
    el.style.boxShadow = `0 0 12px ${color}, 0 2px 8px rgba(0, 0, 0, 0.3)`;
    el.style.borderWidth = '3px';
  });

  el.addEventListener('mouseleave', () => {
    el.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.25)';
    el.style.borderWidth = '2px';
  });

  return el;
}

// =============================================================================
// Component
// =============================================================================

function WeatherStationsLayer({ map, visible, onStationClick }: WeatherStationsLayerProps) {
  const [stations, setStations] = useState<ObservationStation[]>([]);
  const [_loading, setLoading] = useState(false);
  const markersRef = useRef<MarkerEntry[]>([]);

  // Fetch stations on mount and every 15 minutes
  useEffect(() => {
    if (!map) return;

    const fetchStations = async (): Promise<void> => {
      if (!map) return;

      setLoading(true);
      try {
        const data = await graphqlClient.request<StationsResponse>(STATIONS_QUERY);
        setStations(data.observationStations);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error fetching weather stations:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStations();
    const interval = setInterval(fetchStations, INTERVALS.STATIONS_REFRESH);
    return () => clearInterval(interval);
  }, [map]);

  // Add markers to map when stations change
  useEffect(() => {
    if (!map || !visible) {
      // Clear existing markers
      markersRef.current.forEach(({ marker, element, handler }) => {
        if (element && handler) {
          element.removeEventListener('click', handler as EventListener);
        }
        marker.remove();
      });
      markersRef.current = [];
      return;
    }

    // Remove old markers
    markersRef.current.forEach(({ marker, element, handler }) => {
      if (element && handler) {
        element.removeEventListener('click', handler as EventListener);
      }
      marker.remove();
    });
    markersRef.current = [];

    // Add new markers for stations
    stations.forEach((station) => {
      const el = createWeatherStationMarker(station);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([station.location.lng, station.location.lat])
        .addTo(map);

      // Click handler opens DetailPanel
      const handleMarkerClick = (e: MouseEvent): void => {
        e.stopPropagation();
        if (onStationClick) {
          onStationClick(station);
        }
      };

      el.addEventListener('click', handleMarkerClick as EventListener);

      markersRef.current.push({
        marker: marker as Marker,
        element: el,
        handler: handleMarkerClick
      });
    });

    // Cleanup
    return () => {
      markersRef.current.forEach(({ marker, element, handler }) => {
        if (element && handler) {
          element.removeEventListener('click', handler as EventListener);
        }
        marker.remove();
      });
      markersRef.current = [];
    };
  }, [map, visible, stations, onStationClick]);

  // No UI panel - markers only
  return null;
}

export default memo(WeatherStationsLayer);
