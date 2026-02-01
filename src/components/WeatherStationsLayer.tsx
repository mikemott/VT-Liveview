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
  globalPopupRef: React.MutableRefObject<maplibregl.Popup | null>;
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

  // Weather station colors - vibrant and eye-catching
  const stationColors = {
    bg: '#588bae', // Vibrant soft blue
    border: '#ffffff', // White border for contrast
    shadow: 'rgba(0, 0, 0, 0.3)',
    text: '#ffffff' // White text
  };

  // Create inner element for content and hover effects
  // This prevents conflicts with MapLibre's positioning transform
  const inner = document.createElement('div');
  inner.style.cssText = `
    width: 34px;
    height: 34px;
    background: ${stationColors.bg};
    border: 3px solid ${stationColors.border};
    border-radius: 50%;
    box-shadow: 0 3px 8px ${stationColors.shadow};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: 10px;
    font-weight: 700;
    color: ${stationColors.text};
    transform-origin: center center;
    will-change: transform;
  `;

  inner.textContent = `${Math.round(station.weather.temperature)}°`;

  // Add hover effect to inner element only
  inner.addEventListener('mouseenter', () => {
    inner.style.transform = 'translateY(-2px) scale(1.1)';
    inner.style.boxShadow = `0 5px 12px ${stationColors.shadow}`;
  });

  inner.addEventListener('mouseleave', () => {
    inner.style.transform = 'translateY(0) scale(1)';
    inner.style.boxShadow = `0 3px 8px ${stationColors.shadow}`;
  });

  el.appendChild(inner);
  return el;
}

// =============================================================================
// Component
// =============================================================================

function WeatherStationsLayer({ map, visible, onStationClick: _onStationClick, globalPopupRef }: WeatherStationsLayerProps) {
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
      // Clear existing markers and popup
      markersRef.current.forEach(({ marker, element, handler }) => {
        if (element && handler) {
          element.removeEventListener('click', handler as EventListener);
        }
        marker.remove();
      });
      markersRef.current = [];
      if (globalPopupRef.current) {
        globalPopupRef.current.remove();
        globalPopupRef.current = null;
      }
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

    // Close popup on map click
    const handleMapClick = (): void => {
      if (globalPopupRef.current) {
        globalPopupRef.current.remove();
        globalPopupRef.current = null;
      }
    };
    map.on('click', handleMapClick);

    // Add new markers for stations
    stations.forEach((station) => {
      const el = createWeatherStationMarker(station);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([station.location.lng, station.location.lat])
        .addTo(map);

      // Weather station colors (soft blue from style guide) - solid cream background
      const stationColors = {
        bg: '#fbfdf4',
        border: 'rgba(88, 139, 174, 0.4)',
        text: '#2c5368',
        badgeBg: 'rgba(88, 139, 174, 0.2)',
        badgeBorder: 'rgba(88, 139, 174, 0.4)',
        secondary: '#7a9576',
        metadata: '#7a9576'
      };

      // Escape HTML
      const escapeHTML = (str: string): string => {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
      };

      const safeName = escapeHTML(station.name);
      const temp = station.weather?.temperature ? `${Math.round(station.weather.temperature)}°F` : 'N/A';
      const wind = station.weather?.windSpeed ? station.weather.windSpeed : 'N/A';
      const humidity = station.weather?.humidity ? `${Math.round(station.weather.humidity)}%` : 'N/A';
      const pressure = station.weather?.pressure ? `${(station.weather.pressure / 100).toFixed(2)} mb` : 'N/A';

      // Create popup
      const popup = new maplibregl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
        maxWidth: '280px',
        className: 'station-popup'
      }).setHTML(`
        <div style="
          padding: var(--space-7, 16px);
          background: ${stationColors.bg};
          border-radius: var(--radius-xl, 12px);
          border: 1px solid rgba(93, 124, 90, 0.12);
          box-shadow: 0 6px 16px rgba(150, 150, 140, 0.12);
          font-family: 'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif;
        ">
          <div style="
            background: ${stationColors.badgeBg};
            border: 2px solid ${stationColors.badgeBorder};
            border-radius: var(--radius-lg, 8px);
            padding: var(--space-2, 6px) var(--space-4, 10px);
            margin-bottom: var(--space-5, 12px);
            display: inline-flex;
            align-items: center;
            gap: var(--space-2, 6px);
          ">
            <span style="
              color: ${stationColors.text};
              font-size: var(--font-size-sm, 10px);
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            ">Weather Station</span>
          </div>
          <h3 style="
            margin: 0 0 var(--space-5, 12px) 0;
            color: ${stationColors.text};
            font-size: var(--font-size-2xl, 16px);
            font-weight: 700;
            line-height: 1.2;
          ">${safeName}</h3>
          <div style="
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: var(--space-4, 10px);
            margin-bottom: var(--space-3, 8px);
          ">
            <div style="
              font-size: var(--font-size-sm, 10px);
              color: ${stationColors.secondary};
            ">
              <div style="font-weight: 600; margin-bottom: 2px;">Temperature</div>
              <div style="font-size: var(--font-size-xl, 14px); color: ${stationColors.text}; font-weight: 700;">${temp}</div>
            </div>
            <div style="
              font-size: var(--font-size-sm, 10px);
              color: ${stationColors.secondary};
            ">
              <div style="font-weight: 600; margin-bottom: 2px;">Wind</div>
              <div style="font-size: var(--font-size-lg, 13px); color: ${stationColors.text}; font-weight: 600;">${wind}</div>
            </div>
            <div style="
              font-size: var(--font-size-sm, 10px);
              color: ${stationColors.secondary};
            ">
              <div style="font-weight: 600; margin-bottom: 2px;">Humidity</div>
              <div style="font-size: var(--font-size-lg, 13px); color: ${stationColors.text}; font-weight: 600;">${humidity}</div>
            </div>
            <div style="
              font-size: var(--font-size-sm, 10px);
              color: ${stationColors.secondary};
            ">
              <div style="font-weight: 600; margin-bottom: 2px;">Pressure</div>
              <div style="font-size: var(--font-size-lg, 13px); color: ${stationColors.text}; font-weight: 600;">${pressure}</div>
            </div>
          </div>
          ${station.elevation ? `
            <div style="
              padding-top: var(--space-3, 8px);
              border-top: 1px solid rgba(93, 124, 90, 0.12);
              font-size: var(--font-size-sm, 10px);
              color: ${stationColors.metadata};
              font-weight: 500;
            ">
              Elevation: ${station.elevation.toLocaleString()} ft
            </div>
          ` : ''}
        </div>
      `);

      // Click handler opens popup
      const handleMarkerClick = (e: MouseEvent): void => {
        e.stopPropagation();

        // Close existing popup if any (atomic operation)
        if (globalPopupRef.current && globalPopupRef.current !== popup) {
          globalPopupRef.current.remove();
          globalPopupRef.current = null;
        }

        // Toggle popup: close if clicking same marker, open if different
        if (globalPopupRef.current === popup) {
          popup.remove();
          globalPopupRef.current = null;
        } else {
          popup.setLngLat([station.location.lng, station.location.lat]).addTo(map);
          globalPopupRef.current = popup;
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

      // Clean up popup and map click handler
      if (globalPopupRef.current) {
        globalPopupRef.current.remove();
        globalPopupRef.current = null;
      }
      map.off('click', handleMapClick);
    };
  }, [map, visible, stations]);

  // No UI panel - markers only
  return null;
}

export default memo(WeatherStationsLayer);
