import { useState, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { graphqlClient } from '../services/graphqlClient';
import { gql } from 'graphql-request';
import { INTERVALS } from '../utils/constants';
import type { MapLibreMap, Marker, Popup } from '../types';
import './WeatherStationsLayer.css';

// =============================================================================
// Types
// =============================================================================

interface StationLocation {
  lat: number;
  lng: number;
}

interface StationWeather {
  temperature: number;
  temperatureUnit: string;
  description: string;
  windSpeed: string | null;
  windDirection: string | null;
  humidity: number | null;
  dewpoint: number | null;
  pressure: number | null;
  timestamp: string;
}

interface ObservationStation {
  id: string;
  name: string;
  location: StationLocation;
  elevation: number | null;
  weather: StationWeather;
}

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
  isDark: boolean;
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

function WeatherStationsLayer({ map, visible, isDark }: WeatherStationsLayerProps) {
  const [stations, setStations] = useState<ObservationStation[]>([]);
  const [_loading, setLoading] = useState(false);
  const markersRef = useRef<MarkerEntry[]>([]);
  const currentPopupRef = useRef<Popup | null>(null);

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
      // Clear existing markers and popups
      markersRef.current.forEach(({ marker, element, handler }) => {
        if (element && handler) {
          element.removeEventListener('click', handler as EventListener);
        }
        marker.remove();
      });
      markersRef.current = [];
      if (currentPopupRef.current) {
        currentPopupRef.current.remove();
        currentPopupRef.current = null;
      }
      return;
    }

    // Close popup when clicking on map
    const handleMapClick = (): void => {
      if (currentPopupRef.current) {
        currentPopupRef.current.remove();
        currentPopupRef.current = null;
      }
    };
    map.on('click', handleMapClick);

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

      // Theme-aware colors
      const themeColors = isDark ? {
        title: '#f5f5f5',
        text: '#c0c0c0',
        textSecondary: '#b5b5b5',
        metadata: '#a5a5a5',
        border: 'rgba(255, 255, 255, 0.1)',
        background: '#1a1a1a'
      } : {
        title: '#1f2937',
        text: '#4b5563',
        textSecondary: '#6b7280',
        metadata: '#9ca3af',
        border: '#e5e7eb',
        background: '#ffffff'
      };

      const popup = new maplibregl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
        maxWidth: '320px'
      }).setHTML(`
        <div style="padding: 6px; background: ${themeColors.background}; color: ${themeColors.text};">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
            <h3 style="margin: 0; color: ${themeColors.title}; font-size: 15px; font-weight: 600;">
              ${station.name}
            </h3>
          </div>

          ${station.elevation ? `
            <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid ${themeColors.border};">
              <p style="margin: 0; color: ${themeColors.textSecondary}; font-size: 12px;">
                📍 Elevation: ${station.elevation} ft
              </p>
            </div>
          ` : ''}

          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <div>
              <div style="font-size: 11px; color: ${themeColors.metadata}; margin-bottom: 2px;">Temperature</div>
              <div style="font-size: 28px; font-weight: 700; color: ${themeColors.title};">
                ${station.weather.temperature}°F
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 13px; color: ${themeColors.text}; font-weight: 500;">
                ${station.weather.description}
              </div>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin-bottom: 8px;">
            ${station.weather.windSpeed ? `
              <div style="padding: 6px; background: ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'}; border-radius: 4px;">
                <div style="color: ${themeColors.metadata}; font-size: 10px; margin-bottom: 2px;">Wind</div>
                <div style="color: ${themeColors.text}; font-weight: 600;">
                  ${station.weather.windDirection || ''} ${station.weather.windSpeed}
                </div>
              </div>
            ` : ''}
            ${station.weather.humidity !== null ? `
              <div style="padding: 6px; background: ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'}; border-radius: 4px;">
                <div style="color: ${themeColors.metadata}; font-size: 10px; margin-bottom: 2px;">Humidity</div>
                <div style="color: ${themeColors.text}; font-weight: 600;">
                  ${Math.round(station.weather.humidity)}%
                </div>
              </div>
            ` : ''}
            ${station.weather.dewpoint !== null ? `
              <div style="padding: 6px; background: ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'}; border-radius: 4px;">
                <div style="color: ${themeColors.metadata}; font-size: 10px; margin-bottom: 2px;">Dewpoint</div>
                <div style="color: ${themeColors.text}; font-weight: 600;">
                  ${station.weather.dewpoint}°F
                </div>
              </div>
            ` : ''}
            ${station.weather.pressure !== null ? `
              <div style="padding: 6px; background: ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'}; border-radius: 4px;">
                <div style="color: ${themeColors.metadata}; font-size: 10px; margin-bottom: 2px;">Pressure</div>
                <div style="color: ${themeColors.text}; font-weight: 600;">
                  ${station.weather.pressure} mb
                </div>
              </div>
            ` : ''}
          </div>

          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid ${themeColors.border}; text-align: center;">
            <span style="font-size: 10px; color: ${themeColors.metadata}; font-style: italic;">
              NOAA • Updated ${new Date(station.weather.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          </div>
        </div>
      `);

      // Store click handler for cleanup
      const handleMarkerClick = (e: MouseEvent): void => {
        e.stopPropagation();

        // Close existing popup if any
        if (currentPopupRef.current && currentPopupRef.current !== popup) {
          currentPopupRef.current.remove();
          currentPopupRef.current = null;
        }

        // Toggle popup
        if (currentPopupRef.current === popup) {
          popup.remove();
          currentPopupRef.current = null;
        } else {
          popup.setLngLat([station.location.lng, station.location.lat]).addTo(map);
          currentPopupRef.current = popup;
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

      if (currentPopupRef.current) {
        currentPopupRef.current.remove();
        currentPopupRef.current = null;
      }

      map.off('click', handleMapClick);
    };
  }, [map, visible, stations, isDark]);

  // No UI panel - markers only
  return null;
}

export default WeatherStationsLayer;
