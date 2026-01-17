import { useEffect, useRef, useState, useCallback, KeyboardEvent } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './WeatherMap.css';
import TravelLayer from './components/TravelLayer';
import WeatherStationsLayer from './components/WeatherStationsLayer';
import CurrentWeather from './components/CurrentWeather';
import RadarOverlay from './components/RadarOverlay';
import ThemeToggle from './components/ThemeToggle';
import { getMapStyle, isDarkMode } from './utils/mapStyles';
import type { MapLibreMap } from './types';
import { VERMONT, INTERVALS } from './utils/constants';
import { useIsMobile } from './hooks/useIsMobile';
import { Menu, X } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

interface AlertProperties {
  event: string;
  headline: string;
  severity?: string;
  areaDesc: string;
}

interface AlertGeometry {
  type: 'Polygon';
  coordinates: number[][][];
}

interface AlertFeature {
  type: 'Feature';
  properties: AlertProperties;
  geometry: AlertGeometry | null;
}

interface MapCenterState {
  lat: number;
  lng: number;
}

// =============================================================================
// Constants
// =============================================================================

const VERMONT_CENTER = {
  lng: VERMONT.centerLng,
  lat: VERMONT.centerLat,
  zoom: VERMONT.centerZoom
};

// =============================================================================
// Component
// =============================================================================

function WeatherMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(VERMONT_CENTER.zoom);
  const [isDark, setIsDark] = useState(() => isDarkMode());
  const [manualThemeOverride, setManualThemeOverride] = useState(false);
  const [mapStyleVersion, setMapStyleVersion] = useState(0); // Track map style changes
  const [alerts, setAlerts] = useState<AlertFeature[]>([]);
  const [mapCenter, setMapCenter] = useState<MapCenterState>({
    lat: VERMONT_CENTER.lat,
    lng: VERMONT_CENTER.lng
  });
  const [showWeatherStations, setShowWeatherStations] = useState(true);

  // Mobile responsiveness
  const isMobile = useIsMobile();
  const [controlsPanelOpen, setControlsPanelOpen] = useState(false); // Collapsed by default on mobile

  // Add alerts to map
  const addAlertsToMap = useCallback((alertFeatures: AlertFeature[]): void => {
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
        features: alertFeatures.filter(f => f.geometry) as GeoJSON.Feature[]
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
      if (!e.features || e.features.length === 0 || !map.current) return;

      const feature = e.features[0];
      if (!feature) return;
      const alert = feature.properties as AlertProperties;
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
      if (map.current) {
        map.current.getCanvas().style.cursor = 'pointer';
      }
    });

    map.current.on('mouseleave', 'alert-fills', () => {
      if (map.current) {
        map.current.getCanvas().style.cursor = '';
      }
    });
  }, []);

  // Handle alert item click to fly to affected area and highlight boundary
  const handleAlertClick = useCallback((alert: AlertFeature): void => {
    if (!map.current || !alert.geometry) return;

    // Close mobile controls panel for better visibility
    if (isMobile) {
      setControlsPanelOpen(false);
    }

    // Remove existing alert highlight if present
    if (map.current.getLayer('alert-highlight-border')) {
      map.current.removeLayer('alert-highlight-border');
    }
    if (map.current.getLayer('alert-highlight-fill')) {
      map.current.removeLayer('alert-highlight-fill');
    }
    if (map.current.getSource('alert-highlight')) {
      map.current.removeSource('alert-highlight');
    }

    // Add highlight source for this specific alert
    map.current.addSource('alert-highlight', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: alert.properties,
        geometry: alert.geometry
      } as GeoJSON.Feature
    });

    // Get color based on severity
    const severityColor =
      alert.properties.severity === 'Extreme' ? '#d00000' :
      alert.properties.severity === 'Severe' ? '#ff6d00' :
      alert.properties.severity === 'Moderate' ? '#ffba08' :
      alert.properties.severity === 'Minor' ? '#3b82f6' :
      '#8b8b8b';

    // Add highlighted fill layer
    map.current.addLayer({
      id: 'alert-highlight-fill',
      type: 'fill',
      source: 'alert-highlight',
      paint: {
        'fill-color': severityColor,
        'fill-opacity': 0.25
      }
    });

    // Add prominent highlighted border
    map.current.addLayer({
      id: 'alert-highlight-border',
      type: 'line',
      source: 'alert-highlight',
      paint: {
        'line-color': severityColor,
        'line-width': 4,
        'line-opacity': 0.9
      }
    });

    // Calculate bounding box from polygon coordinates
    const coords = alert.geometry.coordinates[0];
    if (!coords || coords.length === 0) return;

    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    coords.forEach((point) => {
      const lng = point[0];
      const lat = point[1];
      if (lng !== undefined && lat !== undefined) {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
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
  }, [isMobile]);

  // Fetch NOAA weather alerts
  const fetchAlerts = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch('https://api.weather.gov/alerts/active?area=VT', {
        headers: {
          'User-Agent': 'VT-Liveview Weather App'
        }
      });
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        setAlerts(data.features as AlertFeature[]);
        addAlertsToMap(data.features as AlertFeature[]);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching alerts:', error);
      }
    }
  }, [addAlertsToMap]);

  // Initialize map with Protomaps basemap
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    // Create map with Protomaps style
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: getMapStyle(isDark),
      center: [VERMONT_CENTER.lng, VERMONT_CENTER.lat],
      zoom: VERMONT_CENTER.zoom,
      minZoom: 6.5,  // Allow zooming out to see full state and surrounding areas
      maxZoom: 18,   // Allow detailed street-level zoom
      maxBounds: [
        [-75.0, 41.5], // Southwest corner - more generous bounds
        [-70.0, 46.5]  // Northeast corner - allows viewing all of Vermont
      ]
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current.addControl(new maplibregl.FullscreenControl(), 'top-right');

    // Expose map for debugging
    (window as { map?: MapLibreMap }).map = map.current;

    // Debug tile loading
    map.current.on('error', (e) => {
      if (import.meta.env.DEV) {
        console.error('Map error:', e);
      }
    });

    map.current.on('data', (e) => {
      if (import.meta.env.DEV && e.dataType === 'source' && e.sourceDataType === 'metadata') {
        // Cast to access sourceId which exists on source data events
        const sourceEvent = e as { sourceId?: string };
        console.log('Source loaded:', sourceEvent.sourceId);
      }
    });

    map.current.on('load', () => {
      if (import.meta.env.DEV && map.current) {
        console.log('Map loaded!', {
          sources: Object.keys(map.current.getStyle().sources || {}),
          layers: (map.current.getStyle().layers || []).length,
          firstLayer: (map.current.getStyle().layers || [])[0]
        });
      }

      setLoading(false);
      setMapLoaded(true);
      fetchAlerts();
    });

    // Track zoom changes
    map.current.on('zoom', () => {
      if (map.current) {
        setCurrentZoom(map.current.getZoom());
      }
    });

    // Track map center changes (debounced)
    let moveEndTimeout: ReturnType<typeof setTimeout>;
    map.current.on('moveend', () => {
      clearTimeout(moveEndTimeout);
      moveEndTimeout = setTimeout(() => {
        if (map.current) {
          const center = map.current.getCenter();
          setMapCenter({ lat: center.lat, lng: center.lng });
        }
      }, INTERVALS.MAP_MOVE_DEBOUNCE);
    });

    // Clear alert highlight when clicking elsewhere on map
    map.current.on('click', (e) => {
      if (!map.current) return;

      // Build list of existing alert layers to query
      const layersToQuery: string[] = [];
      if (map.current.getLayer('alert-fills')) {
        layersToQuery.push('alert-fills');
      }
      if (map.current.getLayer('alert-borders')) {
        layersToQuery.push('alert-borders');
      }
      if (map.current.getLayer('alert-highlight-fill')) {
        layersToQuery.push('alert-highlight-fill');
      }

      // Only query if we have layers to check
      let clickedOnAlert = false;
      if (layersToQuery.length > 0) {
        const features = map.current.queryRenderedFeatures(e.point, {
          layers: layersToQuery
        });
        clickedOnAlert = features.length > 0;
      }

      // Only clear highlight if not clicking on an alert
      if (!clickedOnAlert) {
        if (map.current.getLayer('alert-highlight-border')) {
          map.current.removeLayer('alert-highlight-border');
        }
        if (map.current.getLayer('alert-highlight-fill')) {
          map.current.removeLayer('alert-highlight-fill');
        }
        if (map.current.getSource('alert-highlight')) {
          map.current.removeSource('alert-highlight');
        }
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [fetchAlerts, isDark]);

  // Check theme based on daylight hours and update automatically (only if user hasn't manually overridden)
  useEffect(() => {
    // Skip automatic updates if user has manually set theme
    if (manualThemeOverride) return;

    // Check theme every minute to catch sunrise/sunset transitions
    const checkTheme = (): void => {
      const shouldBeDark = isDarkMode();
      if (shouldBeDark !== isDark) {
        setIsDark(shouldBeDark);
      }
    };

    // Check immediately and then every minute
    checkTheme();
    const interval = setInterval(checkTheme, INTERVALS.THEME_CHECK);

    return () => clearInterval(interval);
  }, [isDark, manualThemeOverride]);

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
      if (!map.current) return;

      map.current.setCenter(center);
      map.current.setZoom(zoom);

      // Re-add alerts layer if we have alerts
      if (alerts.length > 0) {
        addAlertsToMap(alerts);
      }

      // Increment mapStyleVersion to trigger radar layer recreation
      setMapStyleVersion(v => v + 1);
    });
  }, [isDark, mapLoaded, alerts, addAlertsToMap]);

  // Toggle theme manually
  const toggleTheme = useCallback((): void => {
    setIsDark(prev => !prev);
    setManualThemeOverride(true); // User has manually set the theme
  }, []);

  // Handle alert keyboard navigation
  const handleAlertKeyDown = (e: KeyboardEvent<HTMLDivElement>, alert: AlertFeature): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleAlertClick(alert);
    }
  };

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
          isMobile={isMobile}
        />
      )}

      {/* Theme Toggle */}
      <ThemeToggle isDark={isDark} onToggle={toggleTheme} />

      {/* Mobile Menu Toggle Button */}
      {isMobile && (
        <button
          className={`mobile-menu-toggle ${isDark ? 'dark' : ''} ${controlsPanelOpen ? 'open' : ''}`}
          onClick={() => setControlsPanelOpen(!controlsPanelOpen)}
          aria-label={controlsPanelOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={controlsPanelOpen}
        >
          {controlsPanelOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      )}

      {/* Mobile Backdrop Overlay - clickable to close panel */}
      {isMobile && controlsPanelOpen && (
        <div
          className={`mobile-backdrop ${isDark ? 'dark' : ''}`}
          onClick={() => setControlsPanelOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Controls Panel - hidden on mobile unless toggled open */}
      <div className={`controls-panel ${isDark ? 'dark' : ''} ${isMobile ? 'mobile' : ''} ${isMobile && !controlsPanelOpen ? 'hidden' : ''}`}>
        <div className="logo-container">
          <img
            src={isDark ? '/assets/vt-liveview-dark.svg' : '/assets/vt-liveview-light.svg'}
            alt="VT LiveView"
            className="app-logo"
          />
          {/* Close button inside panel on mobile */}
          {isMobile && (
            <button
              className="mobile-panel-close"
              onClick={() => setControlsPanelOpen(false)}
              aria-label="Close panel"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="controls-panel-scroll">
          {/* Radar Controls */}
          {mapLoaded && (
            <div className="control-section">
              <RadarOverlay map={map.current} isDark={isDark} key={mapStyleVersion} />
            </div>
          )}

          {/* Map Features (Travel Layer with Weather Stations toggle) */}
          {mapLoaded && (
            <TravelLayer
              map={map.current}
              visible={true}
              currentZoom={currentZoom}
              isDark={isDark}
              showWeatherStations={showWeatherStations}
              onToggleWeatherStations={() => setShowWeatherStations(!showWeatherStations)}
            />
          )}

          {/* Weather Stations Layer */}
          {mapLoaded && (
            <WeatherStationsLayer
              map={map.current}
              visible={showWeatherStations}
              isDark={isDark}
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
                    onKeyDown={(e) => handleAlertKeyDown(e, alert)}
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
    </div>
  );
}

export default WeatherMap;
