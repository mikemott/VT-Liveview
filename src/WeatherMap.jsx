import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './WeatherMap.css';
import TravelLayer from './components/TravelLayer';
import CurrentWeather from './components/CurrentWeather';
import RadarOverlay from './components/RadarOverlay';
import ThemeToggle from './components/ThemeToggle';
import { getMapStyle, registerPMTilesProtocol, isDarkMode, onThemeChange } from './utils/mapStyles';

const VERMONT_CENTER = {
  lng: -72.5778,
  lat: 44.5588,
  zoom: 7.5
};

// Default weather location: Montpelier, VT
const WEATHER_LOCATION = {
  lat: 44.2601,
  lon: -72.5754
};

function WeatherMap() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [travelVisible, setTravelVisible] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(VERMONT_CENTER.zoom);
  const [isDark, setIsDark] = useState(isDarkMode);
  const [alerts, setAlerts] = useState([]);
  const [mapCenter, setMapCenter] = useState({
    lat: VERMONT_CENTER.lat,
    lng: VERMONT_CENTER.lng
  });

  // Add alerts to map
  const addAlertsToMap = useCallback((alertFeatures) => {
    if (!map.current) return;

    // Remove existing alert layers if present
    if (map.current.getLayer('alert-fills')) {
      map.current.removeLayer('alert-fills');
    }
    if (map.current.getLayer('alert-borders')) {
      map.current.removeLayer('alert-borders');
    }
    if (map.current.getSource('alerts')) {
      map.current.removeSource('alerts');
    }

    // Add alerts source
    map.current.addSource('alerts', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: alertFeatures.filter(f => f.geometry)
      }
    });

    // Add alert polygons with color based on severity
    map.current.addLayer({
      id: 'alert-fills',
      type: 'fill',
      source: 'alerts',
      paint: {
        'fill-color': [
          'match',
          ['get', 'severity'],
          'Extreme', '#d00000',
          'Severe', '#ff6d00',
          'Moderate', '#ffba08',
          'Minor', '#3b82f6',
          '#8b8b8b'
        ],
        'fill-opacity': 0.3
      }
    });

    // Add alert borders
    map.current.addLayer({
      id: 'alert-borders',
      type: 'line',
      source: 'alerts',
      paint: {
        'line-color': [
          'match',
          ['get', 'severity'],
          'Extreme', '#d00000',
          'Severe', '#ff6d00',
          'Moderate', '#ffba08',
          'Minor', '#3b82f6',
          '#8b8b8b'
        ],
        'line-width': 2
      }
    });

    // Add click handlers for alerts
    map.current.on('click', 'alert-fills', (e) => {
      if (e.features.length === 0) return;

      const alert = e.features[0].properties;
      const coordinates = e.lngLat;

      new maplibregl.Popup()
        .setLngLat(coordinates)
        .setHTML(`
          <div style="padding: 8px;">
            <h3 style="margin: 0 0 8px 0; color: #ff6d00;">${alert.event}</h3>
            <p style="margin: 0 0 4px 0;"><strong>Severity:</strong> ${alert.severity}</p>
            <p style="margin: 0 0 4px 0;"><strong>Area:</strong> ${alert.areaDesc}</p>
            <p style="margin: 0;">${alert.headline}</p>
          </div>
        `)
        .addTo(map.current);
    });

    // Change cursor on hover
    map.current.on('mouseenter', 'alert-fills', () => {
      map.current.getCanvas().style.cursor = 'pointer';
    });

    map.current.on('mouseleave', 'alert-fills', () => {
      map.current.getCanvas().style.cursor = '';
    });
  }, []);

  // Handle alert item click to fly to affected area
  const handleAlertClick = useCallback((alert) => {
    if (!map.current || !alert.geometry) return;

    // Calculate bounding box from polygon coordinates
    const coords = alert.geometry.coordinates[0];
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    coords.forEach(([lng, lat]) => {
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    });

    // Fly to bounds with smooth animation
    map.current.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      {
        padding: 80,        // 80px buffer on all sides
        duration: 1500,     // 1.5 second smooth animation
        maxZoom: 15         // Prevent excessive zoom on tiny polygons
      }
    );
  }, []);

  // Fetch NOAA weather alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch('https://api.weather.gov/alerts/active?area=VT', {
        headers: {
          'User-Agent': 'VT-Liveview Weather App'
        }
      });
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        setAlerts(data.features);
        addAlertsToMap(data.features);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  }, [addAlertsToMap]);

  // Initialize map with Protomaps basemap
  useEffect(() => {
    if (map.current) return;

    // Register PMTiles protocol
    registerPMTilesProtocol();

    // Create map with Protomaps style
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: getMapStyle(isDark),
      center: [VERMONT_CENTER.lng, VERMONT_CENTER.lat],
      zoom: VERMONT_CENTER.zoom,
      maxBounds: [
        [-74.5, 42.0], // Southwest corner
        [-70.5, 46.0]  // Northeast corner
      ]
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current.addControl(new maplibregl.FullscreenControl(), 'top-right');

    // Expose map for debugging
    window.map = map.current;

    // Debug tile loading
    map.current.on('error', (e) => {
      console.error('Map error:', e);
    });

    map.current.on('data', (e) => {
      if (e.dataType === 'source' && e.sourceDataType === 'metadata') {
        console.log('Source loaded:', e.sourceId);
      }
    });

    map.current.on('load', () => {
      console.log('Map loaded!');
      console.log('Sources:', Object.keys(map.current.getStyle().sources));
      console.log('Layers:', map.current.getStyle().layers.length);
      console.log('First layer:', map.current.getStyle().layers[0]);

      setLoading(false);
      setMapLoaded(true);
      fetchAlerts();
    });

    // Track zoom changes
    map.current.on('zoom', () => {
      setCurrentZoom(map.current.getZoom());
    });

    // Track map center changes (debounced)
    let moveEndTimeout;
    map.current.on('moveend', () => {
      clearTimeout(moveEndTimeout);
      moveEndTimeout = setTimeout(() => {
        const center = map.current.getCenter();
        setMapCenter({ lat: center.lat, lng: center.lng });
      }, 500);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const unsubscribe = onThemeChange((prefersDark) => {
      setIsDark(prefersDark);
    });
    return unsubscribe;
  }, []);

  // Update map style when theme changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Get current center and zoom
    const center = map.current.getCenter();
    const zoom = map.current.getZoom();

    // Set new style
    map.current.setStyle(getMapStyle(isDark));

    // Restore center and zoom after style load
    map.current.once('style.load', () => {
      map.current.setCenter(center);
      map.current.setZoom(zoom);

      // Re-add alerts layer if we have alerts
      if (alerts.length > 0) {
        addAlertsToMap(alerts);
      }
    });
  }, [isDark, mapLoaded, alerts, addAlertsToMap]);

  // Toggle theme
  const toggleTheme = useCallback(() => {
    setIsDark(prev => !prev);
  }, []);

  return (
    <div className={`weather-map-container ${isDark ? 'dark' : ''}`}>
      <div ref={mapContainer} className="map-container" />

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p>Loading Vermont Weather Map...</p>
        </div>
      )}

      {/* Current Weather Display */}
      {mapLoaded && (
        <CurrentWeather
          lat={mapCenter.lat}
          lon={mapCenter.lng}
          isDark={isDark}
        />
      )}

      {/* Theme Toggle */}
      <ThemeToggle isDark={isDark} onToggle={toggleTheme} />

      {/* Controls Panel */}
      <div className={`controls-panel ${isDark ? 'dark' : ''}`}>
        <h2>VT LiveView</h2>

        {/* Radar Controls */}
        {mapLoaded && (
          <RadarOverlay map={map.current} isDark={isDark} />
        )}

        {/* Travel Layer Controls */}
        <div className="control-section">
          <h3>Travel</h3>
          <label className="toggle-control">
            <input
              type="checkbox"
              checked={travelVisible}
              onChange={() => setTravelVisible(!travelVisible)}
            />
            <span>Show Incidents</span>
          </label>
        </div>

        {travelVisible && mapLoaded && (
          <TravelLayer
            map={map.current}
            visible={travelVisible}
            currentZoom={currentZoom}
          />
        )}

        {/* Active Alerts */}
        {alerts.length > 0 && (
          <div className="control-section">
            <h3>Active Alerts ({alerts.length})</h3>
            <div className="alerts-list">
              {alerts.map((alert, index) => (
                <div
                  key={index}
                  className={`alert-item severity-${alert.properties.severity?.toLowerCase()}`}
                  onClick={() => handleAlertClick(alert)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleAlertClick(alert);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Zoom to ${alert.properties.event} affected area`}
                >
                  <div className="alert-event">{alert.properties.event}</div>
                  <div className="alert-headline">{alert.properties.headline}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attribution */}
        <div className="attribution">
          <p>Weather: NOAA</p>
          <p>Radar: RainViewer</p>
          <p>Traffic: VT 511, USGS</p>
          <p>Map: Protomaps / OSM</p>
        </div>
      </div>
    </div>
  );
}

export default WeatherMap;
