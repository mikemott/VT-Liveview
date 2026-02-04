import { useEffect, useRef, useState, useCallback, KeyboardEvent } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './WeatherMap.css';
import TravelLayer from './components/TravelLayer';
import WeatherStationsLayer from './components/WeatherStationsLayer';
import SkiLayer from './components/SkiLayer';
import TrafficFlowLayer from './components/TrafficFlowLayer';
import CreemeeLayer from './components/CreemeeLayer';
import CurrentWeather from './components/CurrentWeather';
import RadarOverlay from './components/RadarOverlay';
import ThemeToggle from './components/ThemeToggle';
import DetailPanel from './components/DetailPanel';
import { getMapStyle, isDarkMode } from './utils/mapStyles';
import type { MapLibreMap, DetailPanelContent, AlertFeature, ObservationStation } from './types';
import { VERMONT, INTERVALS } from './utils/constants';
import { useIsMobile } from './hooks/useIsMobile';
import { useSeasonalLayers } from './hooks/useSeasonalLayers';
import { SEASONAL_LAYERS } from './config/seasonalLayers';
import { Menu, X, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { fetchMergedAlerts, type MergedAlertData } from './services/graphqlClient';

// =============================================================================
// Types
// =============================================================================

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
// Helper Functions
// =============================================================================

// Get Lucide icon based on severity - defined outside component for performance
function getSeverityIcon(severity: string): React.ReactNode {
  switch (severity) {
    case 'Extreme':
    case 'Severe':
      return <AlertTriangle size={16} strokeWidth={2.5} />;
    case 'Moderate':
      return <AlertCircle size={16} strokeWidth={2.5} />;
    case 'Minor':
    default:
      return <Info size={16} strokeWidth={2.5} />;
  }
}

// =============================================================================
// Component
// =============================================================================

function WeatherMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const globalPopupRef = useRef<maplibregl.Popup | null>(null);
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
  // Unified layer visibility state
  // null = auto (follow season), true = forced on, false = forced off
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean | null>>({
    weatherStations: true,  // Core layer - always on by default
    skiResorts: false,      // Off by default - user can enable manually
    creemeeStands: null,    // Seasonal - auto show during creemee season (Apr-Sep)
  });
  const [showStargazing, setShowStargazing] = useState(false);
  const [showTrafficFlow, setShowTrafficFlow] = useState(false);

  // Seasonal layers hook
  const { isInSeason } = useSeasonalLayers();

  // Calculate actual layer visibility (user override or auto based on season)
  const isLayerVisible = useCallback((layerId: string): boolean => {
    const manualToggle = layerVisibility[layerId] ?? null;

    // If user has manually toggled, respect that
    if (manualToggle !== null) return manualToggle;

    // Otherwise, check if it's a seasonal layer and if it's in season
    const seasonalConfig = SEASONAL_LAYERS.find(l => l.id === layerId);
    if (seasonalConfig) {
      return isInSeason(seasonalConfig);
    }

    // Non-seasonal layers default to false if not in visibility state
    return false;
  }, [layerVisibility, isInSeason]);

  // Mobile responsiveness
  const isMobile = useIsMobile();
  const [controlsPanelOpen, setControlsPanelOpen] = useState(false); // Collapsed by default on mobile

  // DetailPanel state
  const [detailPanelContent, setDetailPanelContent] = useState<DetailPanelContent>(null);

  // Add alerts to map
  const addAlertsToMap = useCallback((alertFeatures: AlertFeature[]): void => {
    if (!map.current) return;

    // Remove existing event handlers to prevent memory leak
    if (map.current.getLayer('alert-fills')) {
      (map.current as any).off('click', 'alert-fills');
      (map.current as any).off('mouseenter', 'alert-fills');
      (map.current as any).off('mouseleave', 'alert-fills');
    }

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

    // Add click handlers for alerts - open DetailPanel
    map.current.on('click', 'alert-fills', (e) => {
      if (!e.features || e.features.length === 0) return;

      const feature = e.features[0];
      if (!feature) return;

      // Convert GeoJSON feature to AlertFeature type
      const alertFeature: AlertFeature = {
        type: 'Feature',
        properties: feature.properties as AlertFeature['properties'],
        geometry: feature.geometry as AlertFeature['geometry'],
      };

      setDetailPanelContent({
        type: 'alert',
        data: alertFeature,
      });
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

    // Calculate bounding box from geometry (handles both Polygon and MultiPolygon)
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    const processPoint = (point: number[]): void => {
      const lng = point[0];
      const lat = point[1];
      if (lng !== undefined && lat !== undefined) {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    };

    if (alert.geometry.type === 'MultiPolygon') {
      // MultiPolygon: coordinates[polygon][ring][point]
      for (const polygon of alert.geometry.coordinates) {
        for (const ring of polygon) {
          for (const point of ring) {
            processPoint(point);
          }
        }
      }
    } else {
      // Polygon: coordinates[ring][point]
      for (const ring of alert.geometry.coordinates) {
        for (const point of ring) {
          processPoint(point);
        }
      }
    }

    // Ensure we have valid bounds
    if (minLng === Infinity || maxLng === -Infinity) return;

    // Fly to bounds with smooth animation (backed out for better context)
    map.current.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      {
        padding: 120,       // 120px buffer on all sides for more context
        duration: 1500,     // 1.5 second smooth animation
        maxZoom: 11         // Keep zoomed out to see surrounding area
      }
    );

    // Open the detail panel with full alert information
    setDetailPanelContent({ type: 'alert', data: alert });
  }, [isMobile]);

  // Convert MergedAlertData to AlertFeature format for map display
  const mergedAlertToFeature = useCallback((alert: MergedAlertData): AlertFeature => ({
    type: 'Feature',
    properties: {
      id: alert.id,
      event: alert.event,
      headline: alert.headline,
      severity: alert.severity,
      certainty: alert.certainty,
      urgency: alert.urgency,
      areaDesc: alert.areaDesc,
      description: alert.description,
      instruction: alert.instruction,
      effective: alert.effective,
      expires: alert.expires,
      mergedFrom: alert.mergedFrom,
      affectedZoneIds: alert.affectedZoneIds,
    },
    geometry: alert.geometry,
  }), []);

  // Fetch merged weather alerts from backend
  const fetchAlertsFromBackend = useCallback(async (): Promise<void> => {
    try {
      const mergedAlerts = await fetchMergedAlerts('VT');

      if (mergedAlerts.length > 0) {
        const alertFeatures = mergedAlerts.map(mergedAlertToFeature);
        setAlerts(alertFeatures);
        addAlertsToMap(alertFeatures);
      } else {
        setAlerts([]);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching merged alerts:', error);
      }
    }
  }, [addAlertsToMap, mergedAlertToFeature]);

  // Initialize map with Protomaps basemap
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    // Create map with Protomaps style
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: getMapStyle(isDark),
      center: [VERMONT_CENTER.lng, VERMONT_CENTER.lat],
      zoom: VERMONT_CENTER.zoom,
      minZoom: 5.5,  // Allow zooming out to see regional weather patterns
      maxZoom: 18,   // Allow detailed street-level zoom
      maxBounds: [
        [-77.5, 40.5], // Southwest corner - extends into NY for weather context
        [-68.5, 47.5]  // Northeast corner - includes northern Maine/Quebec border
      ]
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    map.current.addControl(new maplibregl.FullscreenControl(), 'bottom-right');

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
      fetchAlertsFromBackend();
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

    // Map click handler - show historical data or clear alert highlight
    map.current.on('click', (e) => {
      if (!map.current) return;

      // Check if clicking on any interactive feature (alerts, highlights)
      // Filter to only layers that exist to avoid MapLibre errors
      const interactiveLayers = [
        'alert-fills',
        'alert-borders',
        'alert-highlight-fill',
        'alert-highlight-border',
        'incident-highlight',
        'incident-highlight-outline',
      ].filter(layerId => map.current?.getLayer(layerId));

      const features = interactiveLayers.length > 0
        ? map.current.queryRenderedFeatures(e.point, { layers: interactiveLayers })
        : [];
      const clickedOnFeature = features.length > 0;

      // If clicked on empty map, show historical data
      if (!clickedOnFeature) {
        setDetailPanelContent({
          type: 'historical',
          coordinates: {
            lat: e.lngLat.lat,
            lng: e.lngLat.lng,
          },
        });

        // Clear alert highlight
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
  }, [fetchAlertsFromBackend, isDark]);

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

  // Toggle layer visibility (unified function)
  const toggleLayer = useCallback((layerId: string): void => {
    setLayerVisibility(prev => {
      const current = prev[layerId];

      // Cycle: null (auto) → true (on) → false (off) → null (auto)
      // For core layers (always true/false), just toggle between true/false
      const seasonalConfig = SEASONAL_LAYERS.find(l => l.id === layerId);

      if (seasonalConfig) {
        // Seasonal layer: cycle through null → true → false → null
        if (current === null) return { ...prev, [layerId]: true };
        if (current === true) return { ...prev, [layerId]: false };
        return { ...prev, [layerId]: null };
      } else {
        // Core layer: simple boolean toggle
        return { ...prev, [layerId]: !current };
      }
    });
  }, []);

  // Convenience functions for backward compatibility
  const toggleWeatherStations = useCallback((): void => {
    toggleLayer('weatherStations');
  }, [toggleLayer]);

  const toggleSkiResorts = useCallback((): void => {
    toggleLayer('skiResorts');
  }, [toggleLayer]);

  const toggleCreemeeStands = useCallback((): void => {
    toggleLayer('creemeeStands');
  }, [toggleLayer]);

  // Toggle stargazing visibility
  const toggleStargazing = useCallback((): void => {
    setShowStargazing(prev => !prev);
  }, []);

  // Toggle traffic flow visibility
  const toggleTrafficFlow = useCallback((): void => {
    setShowTrafficFlow(prev => !prev);
  }, []);

  // Handle weather station click - memoized to prevent marker recreation
  const handleStationClick = useCallback((station: ObservationStation): void => {
    setDetailPanelContent({ type: 'station', data: station });
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

      {/* Standalone Theme Toggle */}
      <div className="standalone-theme-toggle">
        <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
      </div>

      {/* Controls Panel - hidden on mobile unless toggled open */}
      <div className={`controls-panel ${isDark ? 'dark' : ''} ${isMobile ? 'mobile' : ''} ${isMobile && !controlsPanelOpen ? 'hidden' : ''}`}>
        <div className="logo-container">
          <img
            src={isDark ? "/assets/vt-liveview-dark.svg" : "/assets/vt-liveview-vintage.svg"}
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
              <RadarOverlay map={map.current} isDark={isDark} key={mapStyleVersion} collapsed={showStargazing} />
            </div>
          )}

          {/* Map Features (Travel Layer with Weather Stations and Ski Resorts toggles) */}
          {mapLoaded && (
            <TravelLayer
              map={map.current}
              visible={true}
              currentZoom={currentZoom}
              isDark={isDark}
              showWeatherStations={isLayerVisible('weatherStations')}
              onToggleWeatherStations={toggleWeatherStations}
              showSkiResorts={isLayerVisible('skiResorts')}
              onToggleSkiResorts={toggleSkiResorts}
              showCreemeeStands={isLayerVisible('creemeeStands')}
              onToggleCreemeeStands={toggleCreemeeStands}
              showStargazing={showStargazing}
              onToggleStargazing={toggleStargazing}
              showTrafficFlow={showTrafficFlow}
              onToggleTrafficFlow={toggleTrafficFlow}
              globalPopupRef={globalPopupRef}
              mapStyleVersion={mapStyleVersion}
            />
          )}

          {/* Weather Stations Layer */}
          {mapLoaded && (
            <WeatherStationsLayer
              map={map.current}
              visible={isLayerVisible('weatherStations')}
              onStationClick={handleStationClick}
              globalPopupRef={globalPopupRef}
            />
          )}

          {/* Ski Resorts Layer */}
          {mapLoaded && (
            <SkiLayer
              map={map.current}
              visible={isLayerVisible('skiResorts')}
            />
          )}

          {/* Creemee Stands Layer */}
          {mapLoaded && (
            <CreemeeLayer
              map={map.current}
              visible={isLayerVisible('creemeeStands')}
            />
          )}

          {/* Traffic Flow Layer */}
          {mapLoaded && (
            <TrafficFlowLayer
              key={mapStyleVersion}
              map={map.current}
              visible={showTrafficFlow}
              isDark={isDark}
            />
          )}

          {/* Active Alerts */}
          {alerts.length > 0 && (
            <div className="control-section">
              <h3>Active Alerts ({alerts.length})</h3>
              <div className="alerts-list">
                {alerts.map((alert) => (
                    <div
                      key={alert.properties.id || alert.properties.event}
                      className={`alert-card severity-${alert.properties.severity?.toLowerCase()} ${isDark ? 'dark' : ''}`}
                      onClick={() => handleAlertClick(alert)}
                      onKeyDown={(e) => handleAlertKeyDown(e, alert)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Zoom to ${alert.properties.event} affected area`}
                    >
                      <div className="alert-icon-container">
                        {getSeverityIcon(alert.properties.severity || 'Minor')}
                      </div>
                      <div className="alert-body">
                        <div className="alert-event">{alert.properties.event}</div>
                        <div className="alert-headline">{alert.properties.headline || alert.properties.areaDesc}</div>
                      </div>
                      <button
                        className="alert-dismiss"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Close button functionality - could dismiss alert
                        }}
                        aria-label="Dismiss alert"
                      >
                        <X size={14} />
                      </button>
                    </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <DetailPanel
        content={detailPanelContent}
        onClose={() => setDetailPanelContent(null)}
        isDark={isDark}
      />
    </div>
  );
}

export default WeatherMap;
