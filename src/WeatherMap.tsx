import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import maplibregl, { type MapLayerMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './WeatherMap.css';
import TravelLayer from './components/TravelLayer';
import WeatherStationsLayer from './components/WeatherStationsLayer';
import SkiLayer from './components/SkiLayer';
import TrafficFlowLayer from './components/TrafficFlowLayer';
import CameraLayer from './components/CameraLayer';
import type { TrafficCamera } from './services/cameraApi';
import SeasonalRoadsLayer from './components/SeasonalRoadsLayer';
import { SEASONAL_ROADS, type SeasonalRoad } from './data/seasonalRoads';
import {
  closurePoints,
  getSeasonalStatuses,
  type ClosurePoint,
  type RoadStatus,
} from './utils/seasonalRoads';
import type { TravelIncident } from './services/travelApi';
import CreemeeLayer from './components/CreemeeLayer';
import CampingLayer from './components/CampingLayer';
import CampingAreasLayer from './components/CampingAreasLayer';
import BeachLayer from './components/BeachLayer';
import CurrentWeather from './components/CurrentWeather';
import RadarOverlay from './components/RadarOverlay';
import ThemeToggle from './components/ThemeToggle';
import SearchBox from './components/SearchBox';
import { useSearchItems } from './hooks/useSearchItems';
import type { SearchItem } from './utils/search';
import DetailPanel from './components/DetailPanel';
import { getMapStyle, isDarkMode } from './utils/mapStyles';
import {
  createGeolocateControl,
  createScaleControl,
  explainBlockedGeolocation,
} from './utils/mapControls';
import {
  buildUrlHash,
  parseUrlState,
  type LayerId,
  type Selection,
  type UrlState,
} from './utils/urlState';
import { shareLink, shareResultMessage } from './utils/share';
import type { MapLibreMap, DetailPanelContent, AlertFeature, ObservationStation } from './types';
import { VERMONT, INTERVALS } from './utils/constants';
import { useIsMobile } from './hooks/useIsMobile';
import { useSeasonalLayers } from './hooks/useSeasonalLayers';
import { useVisibleInterval } from './hooks/useVisibleInterval';
import { SEASONAL_LAYERS } from './config/seasonalLayers';
import { Menu, X, AlertTriangle, AlertCircle, Info, Share2 } from 'lucide-react';
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
  zoom: VERMONT.centerZoom,
};

// =============================================================================
// Helper Functions
// =============================================================================

// Get Lucide icon based on severity - defined outside component for performance
// Stable identity for an alert across refetches (merged alert ids are stable, FINDINGS H1)
function alertKey(alert: AlertFeature): string {
  return alert.properties.id || alert.properties.event;
}

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

interface WeatherMapProps {
  /** Called when the map can't be created (e.g. WebGL context failure). */
  onMapUnavailable?: (reason: string) => void;
}

function WeatherMap({ onMapUnavailable }: WeatherMapProps = {}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  // Ref so the init effect doesn't re-run when the callback identity changes
  const onMapUnavailableRef = useRef(onMapUnavailable);
  useEffect(() => {
    onMapUnavailableRef.current = onMapUnavailable;
  }, [onMapUnavailable]);
  const map = useRef<MapLibreMap | null>(null);
  const globalPopupRef = useRef<maplibregl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  // Map view, layers and selection from a shared link (read once, VTL-52)
  const [initialUrlState] = useState<UrlState>(() => parseUrlState(window.location.hash));
  // Stable (from state): the map is created from this; later URL changes go through hashchange
  const initialView = initialUrlState.view ?? VERMONT_CENTER;
  // A selection from the link waits here until its data has loaded
  const pendingSelection = useRef<Selection | undefined>(initialUrlState.selection);
  const [currentZoom, setCurrentZoom] = useState(initialView.zoom);
  const [isDark, setIsDark] = useState(() => isDarkMode());
  const [manualThemeOverride, setManualThemeOverride] = useState(false);
  const [mapStyleVersion, setMapStyleVersion] = useState(0); // Track map style changes
  const [alerts, setAlerts] = useState<AlertFeature[]>([]);
  // True after the first alerts fetch settles (a shared alert link waits for it)
  const [alertsLoaded, setAlertsLoaded] = useState(false);
  // Alerts the user dismissed; kept across refetches so they don't reappear
  const [dismissedAlertKeys, setDismissedAlertKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const visibleAlerts = useMemo(
    () => alerts.filter((a) => !dismissedAlertKeys.has(alertKey(a))),
    [alerts, dismissedAlertKeys],
  );
  // Key of the alert whose boundary is currently highlighted
  const highlightedAlertKey = useRef<string | null>(null);

  // Refs to avoid stale closures in WebGL context event listeners
  const isDarkRef = useRef(isDark);
  const alertsRef = useRef(visibleAlerts);
  const addAlertsToMapRef = useRef<((alerts: AlertFeature[]) => void) | null>(null);

  // Keep refs in sync
  useEffect(() => {
    isDarkRef.current = isDark;
  }, [isDark]);

  useEffect(() => {
    alertsRef.current = visibleAlerts;
  }, [visibleAlerts]);

  const [mapCenter, setMapCenter] = useState<MapCenterState>({
    lat: initialView.lat,
    lng: initialView.lng,
  });
  // Unified layer visibility state
  // null = auto (follow season), true = forced on, false = forced off
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean | null>>(() => {
    const defaults: Record<string, boolean | null> = {
      weatherStations: true, // Core layer - always on by default
      skiResorts: false, // Off by default - user can enable manually
      creemeeStands: false, // Off by default - user can enable manually (was null for auto-show)
      campingSites: false, // Off by default - user can enable manually
      beachSites: false, // Off by default - user can enable manually
      trafficCameras: false, // Off by default (VTL-56)
      // On while any notch/gap road is closed or about to close (VTL-55)
      seasonalRoads: [...getSeasonalStatuses([]).values()].some((s) => s.status !== 'open'),
    };
    const fromUrl = initialUrlState.layers;
    if (!fromUrl) return defaults;
    // A shared link lists exactly the layers that are on
    return Object.fromEntries(Object.keys(defaults).map((id) => [id, fromUrl.has(id as LayerId)]));
  });
  const [showStargazing, setShowStargazing] = useState(
    () => initialUrlState.layers?.has('stargazing') ?? false,
  );
  const [showTrafficFlow, setShowTrafficFlow] = useState(
    () => initialUrlState.layers?.has('trafficFlow') ?? true,
  );

  // Camping sub-filter state
  const [showCampgrounds, setShowCampgrounds] = useState(true);
  const [showBackcountrySites, setShowBackcountrySites] = useState(false);

  // Camping counts
  const [campgroundCount, setCampgroundCount] = useState(0);
  const [backcountryCount, setBackcountryCount] = useState(0);

  // Seasonal layers hook
  const { isInSeason } = useSeasonalLayers();

  // Calculate actual layer visibility (user override or auto based on season)
  const isLayerVisible = useCallback(
    (layerId: string): boolean => {
      const manualToggle = layerVisibility[layerId] ?? null;

      // If user has manually toggled, respect that
      if (manualToggle !== null) return manualToggle;

      // Otherwise, check if it's a seasonal layer and if it's in season
      const seasonalConfig = SEASONAL_LAYERS.find((l) => l.id === layerId);
      if (seasonalConfig) {
        return isInSeason(seasonalConfig);
      }

      // Non-seasonal layers default to false if not in visibility state
      return false;
    },
    [layerVisibility, isInSeason],
  );

  // Mobile responsiveness
  const isMobile = useIsMobile();
  const [controlsPanelOpen, setControlsPanelOpen] = useState(false); // Collapsed by default on mobile

  // DetailPanel state
  const [detailPanelContent, setDetailPanelContent] = useState<DetailPanelContent>(null);
  // Short-lived message over the map (e.g. why "Locate me" didn't work)
  // `id` makes a repeated identical message a new notice (restarts the timer)
  const [mapNotice, setMapNotice] = useState<{ text: string; id: number } | null>(null);
  const showMapNotice = useCallback((text: string): void => {
    setMapNotice({ text, id: Date.now() + Math.random() });
  }, []);
  const showMapNoticeRef = useRef(showMapNotice);
  useEffect(() => {
    if (!mapNotice) return;
    const timer = setTimeout(() => setMapNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [mapNotice]);

  // Alert layer event handlers. These must keep a stable identity so map.off() can
  // remove them: off(type, layerId) without the listener is a no-op in maplibre, and
  // delegated layer listeners survive setStyle(), so they would otherwise accumulate.
  const handleAlertFillClick = useCallback((e: MapLayerMouseEvent): void => {
    const feature = e.features?.[0];
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
  }, []);

  const handleAlertFillEnter = useCallback((): void => {
    if (map.current) {
      map.current.getCanvas().style.cursor = 'pointer';
    }
  }, []);

  const handleAlertFillLeave = useCallback((): void => {
    if (map.current) {
      map.current.getCanvas().style.cursor = '';
    }
  }, []);

  // Add alerts to map
  const addAlertsToMap = useCallback(
    (alertFeatures: AlertFeature[]): void => {
      if (!map.current) return;

      // Remove existing event handlers to prevent duplicate handlers
      map.current.off('click', 'alert-fills', handleAlertFillClick);
      map.current.off('mouseenter', 'alert-fills', handleAlertFillEnter);
      map.current.off('mouseleave', 'alert-fills', handleAlertFillLeave);

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
          features: alertFeatures.filter((f) => f.geometry) as GeoJSON.Feature[],
        },
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
            'Extreme',
            '#d00000',
            'Severe',
            '#ff6d00',
            'Moderate',
            '#ffba08',
            'Minor',
            '#3b82f6',
            '#8b8b8b',
          ],
          'fill-opacity': 0.3,
        },
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
            'Extreme',
            '#d00000',
            'Severe',
            '#ff6d00',
            'Moderate',
            '#ffba08',
            'Minor',
            '#3b82f6',
            '#8b8b8b',
          ],
          'line-width': 2,
        },
      });

      // Add click handlers for alerts - open DetailPanel
      map.current.on('click', 'alert-fills', handleAlertFillClick);

      // Change cursor on hover
      map.current.on('mouseenter', 'alert-fills', handleAlertFillEnter);
      map.current.on('mouseleave', 'alert-fills', handleAlertFillLeave);
    },
    [handleAlertFillClick, handleAlertFillEnter, handleAlertFillLeave],
  );

  // Store addAlertsToMap in ref for WebGL context restore handler
  useEffect(() => {
    addAlertsToMapRef.current = addAlertsToMap;
  }, [addAlertsToMap]);

  // Remove the highlighted alert boundary, if any
  const removeAlertHighlight = useCallback((): void => {
    if (!map.current) return;
    if (map.current.getLayer('alert-highlight-border')) {
      map.current.removeLayer('alert-highlight-border');
    }
    if (map.current.getLayer('alert-highlight-fill')) {
      map.current.removeLayer('alert-highlight-fill');
    }
    if (map.current.getSource('alert-highlight')) {
      map.current.removeSource('alert-highlight');
    }
    highlightedAlertKey.current = null;
  }, []);

  // Handle alert item click to fly to affected area and highlight boundary
  const handleAlertClick = useCallback(
    (alert: AlertFeature): void => {
      if (!map.current || !alert.geometry) return;

      // Close mobile controls panel for better visibility
      if (isMobile) {
        setControlsPanelOpen(false);
      }

      removeAlertHighlight();
      highlightedAlertKey.current = alertKey(alert);

      // Add highlight source for this specific alert
      map.current.addSource('alert-highlight', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: alert.properties,
          geometry: alert.geometry,
        } as GeoJSON.Feature,
      });

      // Get color based on severity
      const severityColor =
        alert.properties.severity === 'Extreme'
          ? '#d00000'
          : alert.properties.severity === 'Severe'
            ? '#ff6d00'
            : alert.properties.severity === 'Moderate'
              ? '#ffba08'
              : alert.properties.severity === 'Minor'
                ? '#3b82f6'
                : '#8b8b8b';

      // Add highlighted fill layer
      map.current.addLayer({
        id: 'alert-highlight-fill',
        type: 'fill',
        source: 'alert-highlight',
        paint: {
          'fill-color': severityColor,
          'fill-opacity': 0.25,
        },
      });

      // Add prominent highlighted border
      map.current.addLayer({
        id: 'alert-highlight-border',
        type: 'line',
        source: 'alert-highlight',
        paint: {
          'line-color': severityColor,
          'line-width': 4,
          'line-opacity': 0.9,
        },
      });

      // Calculate bounding box from geometry (handles both Polygon and MultiPolygon)
      let minLng = Infinity,
        maxLng = -Infinity;
      let minLat = Infinity,
        maxLat = -Infinity;

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
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        {
          padding: 120, // 120px buffer on all sides for more context
          duration: 1500, // 1.5 second smooth animation
          maxZoom: 11, // Keep zoomed out to see surrounding area
        },
      );

      // Open the detail panel with full alert information
      setDetailPanelContent({ type: 'alert', data: alert });
    },
    [isMobile, removeAlertHighlight],
  );

  // Convert MergedAlertData to AlertFeature format for map display
  const mergedAlertToFeature = useCallback(
    (alert: MergedAlertData): AlertFeature => ({
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
    }),
    [],
  );

  // Fetch merged weather alerts from backend
  const fetchAlertsFromBackend = useCallback(async (): Promise<void> => {
    try {
      const mergedAlerts = await fetchMergedAlerts('VT');
      // The map layer follows visibleAlerts (see the sync effect below)
      setAlerts(mergedAlerts.map(mergedAlertToFeature));
      // Only after success: a failed fetch must not discard a pending shared alert
      setAlertsLoaded(true);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching merged alerts:', error);
      }
    }
  }, [mergedAlertToFeature]);

  // Keep the alert polygons in sync with the non-dismissed alerts. After a style
  // swap the style.load handlers re-add them from alertsRef.
  useEffect(() => {
    if (!mapLoaded) return;
    try {
      addAlertsToMap(visibleAlerts);
    } catch (error) {
      // The style is being replaced; its style.load handler re-adds the alerts.
      if (import.meta.env.DEV) {
        console.warn('Could not update alert layers:', error);
      }
    }
  }, [mapLoaded, visibleAlerts, addAlertsToMap]);

  const handleDismissAlert = useCallback(
    (alert: AlertFeature): void => {
      const key = alertKey(alert);
      setDismissedAlertKeys((prev) => new Set(prev).add(key));
      if (highlightedAlertKey.current === key) removeAlertHighlight();
      setDetailPanelContent((content) =>
        content?.type === 'alert' && alertKey(content.data) === key ? null : content,
      );
    },
    [removeAlertHighlight],
  );

  // Initialize map with Protomaps basemap
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    // Create map with Protomaps style. The constructor throws when a WebGL
    // context can't be created (the up-front check in App can pass while the
    // real context still fails, e.g. blocklisted drivers).
    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: getMapStyle(isDark),
        center: [initialView.lng, initialView.lat],
        zoom: initialView.zoom,
        minZoom: 5.5, // Allow zooming out to see regional weather patterns
        maxZoom: 18, // Allow detailed street-level zoom
        maxBounds: [
          [-77.5, 40.5], // Southwest corner - extends into NY for weather context
          [-68.5, 47.5], // Northeast corner - includes northern Maine/Quebec border
        ],
      });
    } catch (error) {
      map.current = null;
      onMapUnavailableRef.current?.(
        error instanceof Error ? error.message : 'The map could not be created',
      );
      return;
    }

    map.current.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    map.current.addControl(new maplibregl.FullscreenControl(), 'bottom-right');
    map.current.addControl(
      createGeolocateControl((message) => showMapNoticeRef.current(message)),
      'bottom-right',
    );
    explainBlockedGeolocation(map.current.getContainer());
    map.current.addControl(createScaleControl(), 'bottom-left');

    // Expose map for debugging
    (window as { map?: MapLibreMap }).map = map.current;

    // Handle WebGL context loss/restore
    // This is critical for preventing layer disappearance on GPU throttling
    const canvas = map.current.getCanvas();

    canvas.addEventListener('webglcontextlost', (e) => {
      console.warn('WebGL context lost - preventing default to allow recovery');
      e.preventDefault(); // Prevent context from being permanently lost
    });

    canvas.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored - triggering style reload to recreate layers');
      if (map.current) {
        // Force style reload to recreate all layers
        // This will trigger 'style.load' events that custom layers listen to
        const currentCenter = map.current.getCenter();
        const currentZoom = map.current.getZoom();

        // Use refs to get latest values (avoid stale closure)
        map.current.setStyle(getMapStyle(isDarkRef.current));

        // once() with a listener returns the map, not a promise; its typing is a union
        void map.current.once('style.load', () => {
          if (!map.current) return;
          map.current.setCenter(currentCenter);
          map.current.setZoom(currentZoom);

          // Re-add alerts if we have them (use refs for latest values)
          if (alertsRef.current.length > 0 && addAlertsToMapRef.current) {
            addAlertsToMapRef.current(alertsRef.current);
          }
        });
      }
    });

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
        if (import.meta.env.DEV) {
          console.log('Source loaded:', sourceEvent.sourceId);
        }
      }
    });

    map.current.on('load', () => {
      if (import.meta.env.DEV) {
        console.log('WeatherMap: Map load event fired');
      }

      if (import.meta.env.DEV && map.current) {
        console.log('Map loaded!', {
          sources: Object.keys(map.current.getStyle().sources || {}),
          layers: (map.current.getStyle().layers || []).length,
          firstLayer: (map.current.getStyle().layers || [])[0],
        });
      }

      try {
        setLoading(false);
        setMapLoaded(true);
        if (import.meta.env.DEV) {
          console.log('WeatherMap: mapLoaded state set to true');
        }
        void fetchAlertsFromBackend();
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('WeatherMap: Error in load callback:', error);
        }
      }
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
      ].filter((layerId) => map.current?.getLayer(layerId));

      const features =
        interactiveLayers.length > 0
          ? map.current.queryRenderedFeatures(e.point, { layers: interactiveLayers })
          : [];
      const clickedOnFeature = features.length > 0;

      // If clicked on empty map, show location details
      if (!clickedOnFeature) {
        setDetailPanelContent({
          type: 'location',
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
  }, [fetchAlertsFromBackend, isDark, initialView]);

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

    // Check immediately; the visible-only interval below handles the rest
    checkTheme();
  }, [isDark, manualThemeOverride]);
  useVisibleInterval(() => {
    if (manualThemeOverride) return;
    const shouldBeDark = isDarkMode();
    if (shouldBeDark !== isDark) setIsDark(shouldBeDark);
  }, INTERVALS.THEME_CHECK);

  // Update map style when theme changes (debounced to prevent race conditions)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Debounce theme changes to prevent rapid toggling from destroying layers
    const debounceTimer = setTimeout(() => {
      if (!map.current) return;

      // Get current center and zoom
      const center = map.current.getCenter();
      const zoom = map.current.getZoom();

      // Set new style
      map.current.setStyle(getMapStyle(isDark));

      // Restore center and zoom after style load
      void map.current.once('style.load', () => {
        if (!map.current) return;

        map.current.setCenter(center);
        map.current.setZoom(zoom);

        // Re-add alerts layer if we have alerts (use refs to avoid stale closure)
        if (alertsRef.current.length > 0 && addAlertsToMapRef.current) {
          addAlertsToMapRef.current(alertsRef.current);
        }

        // Increment mapStyleVersion to trigger radar layer recreation
        setMapStyleVersion((v) => v + 1);
      });
    }, 150); // 150ms debounce - prevents rapid toggles from stacking

    return () => clearTimeout(debounceTimer);
    // TODO(VTL-45 C1): theme handling is entangled with map init (see docs/review/FINDINGS.md)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDark]); // ONLY run when theme actually changes, not when map loads or alerts change

  // Toggle theme manually
  const toggleTheme = useCallback((): void => {
    setIsDark((prev) => !prev);
    setManualThemeOverride(true); // User has manually set the theme
  }, []);

  // Toggle layer visibility (unified function)
  const toggleLayer = useCallback((layerId: string): void => {
    setLayerVisibility((prev) => {
      const current = prev[layerId];

      // Cycle: null (auto) → true (on) → false (off) → null (auto)
      // For core layers (always true/false), just toggle between true/false
      const seasonalConfig = SEASONAL_LAYERS.find((l) => l.id === layerId);

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

  const toggleCampingSites = useCallback((): void => {
    toggleLayer('campingSites');
  }, [toggleLayer]);

  const toggleBeachSites = useCallback((): void => {
    toggleLayer('beachSites');
  }, [toggleLayer]);

  // Toggle stargazing visibility
  const toggleStargazing = useCallback((): void => {
    setShowStargazing((prev) => !prev);
  }, []);

  // Toggle traffic flow visibility
  const toggleTrafficFlow = useCallback((): void => {
    setShowTrafficFlow((prev) => !prev);
  }, []);

  // Handle weather station click - memoized to prevent marker recreation
  const handleStationClick = useCallback((station: ObservationStation): void => {
    setDetailPanelContent({ type: 'station', data: station });
  }, []);

  // ===========================================================================
  // Shareable URL (VTL-52)
  // ===========================================================================

  // What the detail panel shows, as a URL selection (incidents aren't shareable yet)
  const currentSelection = useMemo((): Selection | undefined => {
    switch (detailPanelContent?.type) {
      case 'station':
        return { type: 'station', id: detailPanelContent.data.id };
      case 'camera':
        return { type: 'camera', id: detailPanelContent.data.id };
      case 'seasonalRoad':
        return { type: 'road', id: detailPanelContent.data.id };
      case 'alert':
        return detailPanelContent.data.properties.id
          ? { type: 'alert', id: detailPanelContent.data.properties.id }
          : undefined;
      case 'location':
        return { type: 'location', ...detailPanelContent.coordinates };
      default:
        return undefined;
    }
  }, [detailPanelContent]);

  const activeLayers = useMemo((): Set<LayerId> => {
    const on = new Set<LayerId>();
    (
      [
        'weatherStations',
        'skiResorts',
        'creemeeStands',
        'campingSites',
        'beachSites',
        'trafficCameras',
        'seasonalRoads',
      ] as const
    )
      .filter((id) => isLayerVisible(id))
      .forEach((id) => on.add(id));
    if (showTrafficFlow) on.add('trafficFlow');
    if (showStargazing) on.add('stargazing');
    return on;
  }, [isLayerVisible, showTrafficFlow, showStargazing]);

  // Keep the address bar in sync (replaceState: no history entries, no hashchange)
  useEffect(() => {
    if (!mapLoaded) return;
    const timer = setTimeout(() => {
      const hash = buildUrlHash({
        view: { zoom: currentZoom, lat: mapCenter.lat, lng: mapCenter.lng },
        layers: activeLayers,
        // Keep a not-yet-resolved selection from the link in the URL
        selection: currentSelection ?? pendingSelection.current,
      });
      if (hash !== window.location.hash) {
        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}${window.location.search}${hash}`,
        );
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [mapLoaded, currentZoom, mapCenter, activeLayers, currentSelection]);

  // Seasonal road closures (VTL-55): 511 full closures override the calendar
  const [closures, setClosures] = useState<ClosurePoint[]>([]);
  const closuresRef = useRef(closures);
  useEffect(() => {
    closuresRef.current = closures;
  }, [closures]);
  const handleIncidentsLoaded = useCallback((incidents: TravelIncident[]): void => {
    const next = closurePoints(incidents);
    // Same closures: keep the array so the road layer doesn't redraw
    setClosures((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, []);
  const handleSeasonalRoadClick = useCallback((road: SeasonalRoad, status: RoadStatus): void => {
    setDetailPanelContent({ type: 'seasonalRoad', data: road, status });
  }, []);
  /** Open a road's panel with its current status (search, shared links). */
  const openSeasonalRoad = useCallback((id: string): void => {
    const road = SEASONAL_ROADS.find((r) => r.id === id);
    const status = road && getSeasonalStatuses(closuresRef.current).get(road.id);
    if (road && status) setDetailPanelContent({ type: 'seasonalRoad', data: road, status });
  }, []);

  // Restore a point or alert selection from the link once the map / alerts are ready
  useEffect(() => {
    const pending = pendingSelection.current;
    if (!mapLoaded || !pending) return;
    if (pending.type === 'location') {
      pendingSelection.current = undefined;
      setDetailPanelContent({
        type: 'location',
        coordinates: { lat: pending.lat, lng: pending.lng },
      });
    } else if (pending.type === 'road') {
      pendingSelection.current = undefined;
      openSeasonalRoad(pending.id);
    } else if (pending.type === 'alert' && alertsLoaded) {
      pendingSelection.current = undefined;
      const alert = alerts.find((a) => a.properties.id === pending.id);
      // An expired alert is simply not opened
      if (alert) handleAlertClick(alert);
    }
  }, [mapLoaded, alertsLoaded, alerts, handleAlertClick, openSeasonalRoad]);

  // Restore a station selection once stations have loaded
  // Latest stations, for search (VTL-53)
  const [stations, setStations] = useState<ObservationStation[]>([]);
  const handleStationsLoaded = useCallback((loaded: ObservationStation[]): void => {
    setStations(loaded);
    const pending = pendingSelection.current;
    if (pending?.type !== 'station') return;
    pendingSelection.current = undefined;
    const station = loaded.find((s) => s.id === pending.id);
    if (station) setDetailPanelContent({ type: 'station', data: station });
  }, []);

  // Traffic cameras (VTL-56): latest list for search, and shared-link restore
  const [cameras, setCameras] = useState<TrafficCamera[]>([]);
  const handleCamerasLoaded = useCallback((loaded: TrafficCamera[]): void => {
    setCameras(loaded);
    const pending = pendingSelection.current;
    if (pending?.type !== 'camera') return;
    pendingSelection.current = undefined;
    const camera = loaded.find((c) => c.id === pending.id);
    if (camera) setDetailPanelContent({ type: 'camera', data: camera });
  }, []);
  const handleCameraClick = useCallback((camera: TrafficCamera): void => {
    setDetailPanelContent({ type: 'camera', data: camera });
  }, []);

  // Opening something else (or closing the panel) drops an unresolved selection
  const closeDetailPanel = useCallback((): void => {
    pendingSelection.current = undefined;
    setDetailPanelContent(null);
  }, []);

  // A pasted or edited link in the same tab: move the map and apply layers
  useEffect(() => {
    const onHashChange = (): void => {
      const next = parseUrlState(window.location.hash);
      if (next.view && map.current) {
        map.current.jumpTo({ center: [next.view.lng, next.view.lat], zoom: next.view.zoom });
      }
      if (next.layers) {
        const layers = next.layers;
        setLayerVisibility((prev) =>
          Object.fromEntries(Object.keys(prev).map((id) => [id, layers.has(id as LayerId)])),
        );
        setShowTrafficFlow(layers.has('trafficFlow'));
        setShowStargazing(layers.has('stargazing'));
      }
      // Roads are static data, so open now; others wait for their data
      if (next.selection?.type === 'road') openSeasonalRoad(next.selection.id);
      else if (next.selection) pendingSelection.current = next.selection;
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [openSeasonalRoad]);

  // ===========================================================================
  // Search (VTL-53)
  // ===========================================================================

  const [searchActive, setSearchActive] = useState(false);
  const { items: searchItems, loading: searchLoading } = useSearchItems(
    searchActive,
    stations,
    cameras,
  );

  const handleSearchSelect = useCallback(
    (item: SearchItem): void => {
      const m = map.current;
      if (!m) return;
      if (item.bounds) {
        const [w, s, e, n] = item.bounds;
        m.fitBounds(
          [
            [w, s],
            [e, n],
          ],
          { padding: isMobile ? 24 : 60, maxZoom: 13, duration: 1200 },
        );
      } else {
        m.flyTo({ center: [item.lng, item.lat], zoom: Math.max(m.getZoom(), 13), duration: 1200 });
      }

      // Make sure the found thing is actually visible / open
      const layerFor: Partial<Record<SearchItem['kind'], string>> = {
        ski: 'skiResorts',
        beach: 'beachSites',
        creemee: 'creemeeStands',
        campground: 'campingSites',
        station: 'weatherStations',
        camera: 'trafficCameras',
        road: 'seasonalRoads',
      };
      const layer = layerFor[item.kind];
      if (layer) setLayerVisibility((prev) => ({ ...prev, [layer]: true }));
      if (item.kind === 'station') {
        const station = stations.find((s) => `station:${s.id}` === item.id);
        if (station) setDetailPanelContent({ type: 'station', data: station });
      }
      if (item.kind === 'camera') {
        const camera = cameras.find((c) => `camera:${c.id}` === item.id);
        if (camera) setDetailPanelContent({ type: 'camera', data: camera });
      }
      if (item.kind === 'road') openSeasonalRoad(item.id.slice('road:'.length));
      if (isMobile) setControlsPanelOpen(false);
    },
    [isMobile, stations, cameras, openSeasonalRoad],
  );

  const handleShare = useCallback(async (): Promise<void> => {
    const result = await shareLink(window.location.href, document.title);
    const message = shareResultMessage(result);
    if (message) showMapNotice(message);
  }, [showMapNotice]);

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
        <button
          type="button"
          className={`map-share-button ${isDark ? 'dark' : ''}`}
          onClick={() => void handleShare()}
          title="Share this view"
          aria-label="Share this view"
        >
          <Share2 size={18} />
        </button>
        <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
      </div>

      {/* Controls Panel - hidden on mobile unless toggled open */}
      <div
        className={`controls-panel ${isDark ? 'dark' : ''} ${isMobile ? 'mobile' : ''} ${isMobile && !controlsPanelOpen ? 'hidden' : ''}`}
      >
        <div className="logo-container">
          <img
            src={isDark ? '/assets/vt-liveview-dark.svg' : '/assets/vt-liveview-vintage.svg'}
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

        <SearchBox
          items={searchItems}
          onSelect={handleSearchSelect}
          onActivate={() => setSearchActive(true)}
          loadingMore={searchLoading}
          isDark={isDark}
        />

        <div className="controls-panel-scroll">
          {/* Radar Controls */}
          {mapLoaded && (
            <div className="control-section">
              <RadarOverlay
                map={map.current}
                isDark={isDark}
                key={mapStyleVersion}
                collapsed={showStargazing}
              />
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
              showCameras={isLayerVisible('trafficCameras')}
              onToggleCameras={() => toggleLayer('trafficCameras')}
              showSeasonalRoads={isLayerVisible('seasonalRoads')}
              onToggleSeasonalRoads={() => toggleLayer('seasonalRoads')}
              onIncidentsLoaded={handleIncidentsLoaded}
              showSkiResorts={isLayerVisible('skiResorts')}
              onToggleSkiResorts={toggleSkiResorts}
              showCreemeeStands={isLayerVisible('creemeeStands')}
              onToggleCreemeeStands={toggleCreemeeStands}
              showCampingSites={isLayerVisible('campingSites')}
              onToggleCampingSites={toggleCampingSites}
              showCampgrounds={showCampgrounds}
              onToggleCampgrounds={() => setShowCampgrounds(!showCampgrounds)}
              showBackcountrySites={showBackcountrySites}
              onToggleBackcountrySites={() => setShowBackcountrySites(!showBackcountrySites)}
              showBeachSites={isLayerVisible('beachSites')}
              onToggleBeachSites={toggleBeachSites}
              showStargazing={showStargazing}
              onToggleStargazing={toggleStargazing}
              showTrafficFlow={showTrafficFlow}
              onToggleTrafficFlow={toggleTrafficFlow}
              globalPopupRef={globalPopupRef}
              mapStyleVersion={mapStyleVersion}
              campgroundCount={campgroundCount}
              backcountryCount={backcountryCount}
            />
          )}

          {/* Weather Stations Layer */}
          {mapLoaded && (
            <WeatherStationsLayer
              map={map.current}
              visible={isLayerVisible('weatherStations')}
              onStationClick={handleStationClick}
              onStationsLoaded={handleStationsLoaded}
              globalPopupRef={globalPopupRef}
            />
          )}

          {/* Ski Resorts Layer */}
          {mapLoaded && <SkiLayer map={map.current} visible={isLayerVisible('skiResorts')} />}

          {/* Camping Sites Layer - Campgrounds shown individually */}
          {mapLoaded && showCampgrounds && (
            <CampingLayer
              map={map.current}
              visible={isLayerVisible('campingSites')}
              showCampgrounds={true}
              showBackcountry={false}
              onCountsChange={(campgrounds, _backcountry) => {
                setCampgroundCount(campgrounds);
              }}
            />
          )}

          {/* Backcountry Sites Layer - Grouped by wilderness area */}
          {mapLoaded && showBackcountrySites && (
            <CampingAreasLayer
              map={map.current}
              visible={isLayerVisible('campingSites')}
              mapStyleVersion={mapStyleVersion}
              onCountChange={setBackcountryCount}
            />
          )}

          {/* Beach Sites Layer */}
          {mapLoaded && <BeachLayer map={map.current} visible={isLayerVisible('beachSites')} />}

          {/* Creemee Stands Layer */}
          {mapLoaded && (
            <CreemeeLayer map={map.current} visible={isLayerVisible('creemeeStands')} />
          )}

          {/* Traffic Cameras Layer (VTL-56) */}
          {mapLoaded && (
            <CameraLayer
              map={map.current}
              visible={isLayerVisible('trafficCameras')}
              onCameraClick={handleCameraClick}
              onCamerasLoaded={handleCamerasLoaded}
            />
          )}

          {/* Seasonal notch/gap/toll road closures (VTL-55) */}
          {mapLoaded && (
            <SeasonalRoadsLayer
              map={map.current}
              visible={isLayerVisible('seasonalRoads')}
              isDark={isDark}
              mapStyleVersion={mapStyleVersion}
              closures={closures}
              onRoadClick={handleSeasonalRoadClick}
            />
          )}

          {/* Traffic Flow Layer */}
          {mapLoaded && (
            <TrafficFlowLayer map={map.current} visible={showTrafficFlow} isDark={isDark} />
          )}

          {/* Active Alerts */}
          {visibleAlerts.length > 0 && (
            <div className="control-section">
              <h3>Active Alerts ({visibleAlerts.length})</h3>
              <div className="alerts-list">
                {visibleAlerts.map((alert) => (
                  <div
                    key={alertKey(alert)}
                    className={`alert-card severity-${alert.properties.severity?.toLowerCase()} ${isDark ? 'dark' : ''}`}
                  >
                    {/* Sibling buttons: nesting the dismiss button inside a role="button"
                        card made it unreachable for assistive tech (FINDINGS H16) */}
                    <button
                      type="button"
                      className="alert-select"
                      onClick={() => handleAlertClick(alert)}
                      aria-label={`Zoom to ${alert.properties.event} affected area`}
                    >
                      <span className="alert-icon-container">
                        {getSeverityIcon(alert.properties.severity || 'Minor')}
                      </span>
                      <span className="alert-body">
                        <span className="alert-event">{alert.properties.event}</span>
                        <span className="alert-headline">
                          {alert.properties.headline || alert.properties.areaDesc}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="alert-dismiss"
                      onClick={() => handleDismissAlert(alert)}
                      aria-label={`Dismiss ${alert.properties.event} alert`}
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

      {mapNotice && (
        <div className={`map-notice ${isDark ? 'dark' : ''}`} role="status">
          <span>{mapNotice.text}</span>
          <button type="button" onClick={() => setMapNotice(null)} aria-label="Dismiss message">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Detail Panel */}
      <DetailPanel
        content={detailPanelContent}
        onClose={closeDetailPanel}
        onShare={() => void handleShare()}
        isDark={isDark}
      />
    </div>
  );
}

export default WeatherMap;
