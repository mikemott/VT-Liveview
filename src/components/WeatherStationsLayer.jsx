import { useState, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { graphqlClient } from '../services/graphqlClient';
import { gql } from 'graphql-request';
import './WeatherStationsLayer.css';

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

function WeatherStationsLayer({ map, visible, isDark }) {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(false);
  const markersRef = useRef([]);
  const currentPopupRef = useRef(null);

  // Fetch stations on mount and every 15 minutes
  useEffect(() => {
    if (!map) return;

    fetchStations();
    const interval = setInterval(fetchStations, 15 * 60 * 1000); // 15 minutes
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  const fetchStations = async () => {
    if (!map) return;

    setLoading(true);
    try {
      const data = await graphqlClient.request(STATIONS_QUERY);
      setStations(data.observationStations);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching weather stations:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  // Add markers to map when stations change
  useEffect(() => {
    if (!map || !visible) {
      // Clear existing markers and popups
      markersRef.current.forEach(({ marker, element, handler }) => {
        if (element && handler) {
          element.removeEventListener('click', handler);
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
    const handleMapClick = () => {
      if (currentPopupRef.current) {
        currentPopupRef.current.remove();
        currentPopupRef.current = null;
      }
    };
    map.on('click', handleMapClick);

    // Remove old markers
    markersRef.current.forEach(({ marker, element, handler }) => {
      if (element && handler) {
        element.removeEventListener('click', handler);
      }
      marker.remove();
    });
    markersRef.current = [];

    // Filter out offline stations (those without valid temperature data)
    const onlineStations = stations.filter(station =>
      station.weather.temperature !== null && station.weather.temperature !== undefined
    );

    // Add new markers for online stations only
    onlineStations.forEach(station => {
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
      const handleMarkerClick = (e) => {
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

      el.addEventListener('click', handleMarkerClick);

      markersRef.current.push({
        marker: marker,
        element: el,
        handler: handleMarkerClick
      });
    });

    // Cleanup
    return () => {
      markersRef.current.forEach(({ marker, element, handler }) => {
        if (element && handler) {
          element.removeEventListener('click', handler);
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

// Create weather station marker element
function createWeatherStationMarker(station) {
  const el = document.createElement('div');
  el.className = 'weather-station-marker';

  const temp = station.weather.temperature;

  // Color based on temperature
  let color;
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

  el.textContent = `${Math.round(temp)}°`;

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

export default WeatherStationsLayer;
