import { useState, useEffect, useRef, useCallback, useMemo, ReactNode, memo } from 'react';
import { ChevronDown, ChevronRight, ZoomIn } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import { fetchAllIncidentsWithStatus, type TravelIncident } from '../services/travelApi';
import { getIncidentColor, shouldShowIncident } from '../utils/incidentColors';
import { getIncidentIcon } from '../utils/incidentIcons';
import { useMapMarkers, type BuiltMarker } from '../hooks/useMapMarkers';
import { createMapMarker } from '../utils/mapMarker';
import { INTERVALS } from '../utils/constants';
import { useVisibleInterval } from '../hooks/useVisibleInterval';
import type { MapLibreMap, IncidentType } from '../types';
import StargazingLayer from './StargazingLayer';
import { LAYER_STYLES, layerColorVars, type LayerStyleKey } from '../config/layers';
import CampingContent from './CampingContent';
import './TravelLayer.css';

// =============================================================================
// Types
// =============================================================================

interface ActiveFilters {
  ACCIDENT: boolean;
  CONSTRUCTION: boolean;
  CLOSURE: boolean;
  FLOODING: boolean;
  HAZARD: boolean;
}

interface TravelLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  currentZoom: number;
  isDark: boolean;
  showWeatherStations: boolean;
  onToggleWeatherStations: () => void;
  /** Traffic cameras chip (VTL-56); omitted props hide the chip. */
  showCameras?: boolean;
  onToggleCameras?: () => void;
  /** Seasonal road closures chip (VTL-55); omitted props hide the chip. */
  showSeasonalRoads?: boolean;
  onToggleSeasonalRoads?: () => void;
  /** Road weather stations chip (VTL-61); omitted props hide the chip. */
  showRoadWeather?: boolean;
  onToggleRoadWeather?: () => void;
  /** Called with every successful incident refresh (seasonal-road override). */
  onIncidentsLoaded?: (incidents: TravelIncident[]) => void;
  showSkiResorts: boolean;
  onToggleSkiResorts: () => void;
  showCreemeeStands: boolean;
  onToggleCreemeeStands: () => void;
  showCampingSites: boolean;
  onToggleCampingSites: () => void;
  showCampgrounds: boolean;
  onToggleCampgrounds: () => void;
  showBackcountrySites: boolean;
  onToggleBackcountrySites: () => void;
  campgroundCount: number;
  backcountryCount: number;
  showBeachSites: boolean;
  onToggleBeachSites: () => void;
  showStargazing: boolean;
  onToggleStargazing: () => void;
  showTrafficFlow: boolean;
  onToggleTrafficFlow: () => void;
  /** Opens an incident in the side panel (marker or list click) */
  onIncidentClick?: (incident: TravelIncident) => void;
  mapStyleVersion: number;
}

interface IncidentsByType {
  [key: string]: TravelIncident[];
}

// =============================================================================
// Helper Functions
// =============================================================================

function getIcon(type: IncidentType, size: number = 16): ReactNode {
  const Icon = LAYER_STYLES[type].icon;
  return <Icon size={size} strokeWidth={2.5} aria-hidden="true" />;
}

function getTypeLabel(type: IncidentType, short: boolean = false): string {
  const labels: Record<IncidentType, string> = {
    ACCIDENT: 'Accidents',
    CONSTRUCTION: 'Construction',
    CLOSURE: short ? 'Closures' : 'Road Closures',
    FLOODING: short ? 'Floods' : 'Flooding',
    HAZARD: 'Hazards',
  };
  return labels[type] || 'Other';
}

/** Singular names for marker labels */
const INCIDENT_NAME: Record<IncidentType, string> = {
  ACCIDENT: 'Accident',
  CONSTRUCTION: 'Construction',
  CLOSURE: 'Road closure',
  FLOODING: 'Flooding',
  HAZARD: 'Hazard',
};

function buildIncidentMarker(incident: TravelIncident): BuiltMarker {
  const element = createMapMarker({
    layer: incident.type,
    // Hard-coded icon SVG, white via currentColor
    iconSvg: getIncidentIcon(incident.type, 16, 'currentColor'),
    label: `${INCIDENT_NAME[incident.type]}: ${incident.title}`,
    title: incident.title,
    className: 'incident-marker',
  });
  element.dataset.type = incident.type.toLowerCase();
  return { lngLat: [incident.location.lng, incident.location.lat], element };
}

interface FilterChipProps {
  layer: LayerStyleKey;
  /** Stable hook for tests (data-chip-type) */
  chipType: string;
  active: boolean;
  onClick: () => void;
  count?: number;
}

/** A layer toggle; label, icon and color come from the layer registry (VTL-64). */
function FilterChip({ layer, chipType, active, onClick, count = 0 }: FilterChipProps) {
  const { label, icon: Icon, description } = LAYER_STYLES[layer];
  return (
    <button
      className={`filter-chip ${active ? 'active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
      data-chip-type={chipType}
      style={layerColorVars(layer)}
      {...(description ? { title: description } : {})}
    >
      <span className="chip-icon">
        <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
      </span>
      {label}
      {count > 0 && <span className="chip-count">{count}</span>}
    </button>
  );
}

// =============================================================================
// Component
// =============================================================================

function TravelLayer({
  map,
  visible,
  currentZoom,
  isDark,
  showWeatherStations,
  onToggleWeatherStations,
  showCameras = false,
  onToggleCameras,
  showSeasonalRoads = false,
  onToggleSeasonalRoads,
  showRoadWeather = false,
  onToggleRoadWeather,
  onIncidentsLoaded,
  showSkiResorts,
  onToggleSkiResorts,
  showCreemeeStands,
  onToggleCreemeeStands,
  showCampingSites,
  onToggleCampingSites,
  showCampgrounds,
  onToggleCampgrounds,
  showBackcountrySites,
  onToggleBackcountrySites,
  campgroundCount,
  backcountryCount,
  showBeachSites,
  onToggleBeachSites,
  showStargazing,
  onToggleStargazing,
  showTrafficFlow,
  onToggleTrafficFlow,
  onIncidentClick,
  mapStyleVersion,
}: TravelLayerProps) {
  const [incidents, setIncidents] = useState<TravelIncident[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<TravelIncident | null>(null);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    ACCIDENT: true,
    CONSTRUCTION: false,
    CLOSURE: false,
    FLOODING: false,
    HAZARD: false,
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Sources that failed on the last refresh while others loaded
  const [unavailableSources, setUnavailableSources] = useState<string[]>([]);
  const onIncidentsLoadedRef = useRef(onIncidentsLoaded);
  useEffect(() => {
    onIncidentsLoadedRef.current = onIncidentsLoaded;
  }, [onIncidentsLoaded]);

  // Fetch incidents function (accessible to retry button)
  const fetchIncidentsData = useCallback(async (): Promise<void> => {
    if (!map) return;

    setLoading(true);
    try {
      setError(null); // Clear previous errors
      const { incidents: data, unavailableSources: failed } = await fetchAllIncidentsWithStatus();
      setIncidents(data);
      onIncidentsLoadedRef.current?.(data);
      setUnavailableSources(failed);
      setLastUpdated(new Date());
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching travel incidents:', error);
      }
      setError(error instanceof Error ? error.message : 'Failed to load incidents');
    } finally {
      setLoading(false);
    }
  }, [map]);

  // Fetch incidents on mount, then every 2 minutes while the page is visible
  useEffect(() => {
    if (!map) return;
    void fetchIncidentsData();
  }, [map, fetchIncidentsData]);
  useVisibleInterval(() => void fetchIncidentsData(), map ? INTERVALS.INCIDENTS_REFRESH : null);

  // Toggle filter for incident type
  const toggleFilter = (type: IncidentType): void => {
    setActiveFilters((prev) => ({
      ...prev,
      [type]: !prev[type],
    }));
  };

  const onIncidentClickRef = useRef(onIncidentClick);
  useEffect(() => {
    onIncidentClickRef.current = onIncidentClick;
  }, [onIncidentClick]);

  /** Remove the highlighted route, if any */
  const clearHighlight = useCallback((): void => {
    if (!map) return;
    if (map.getLayer('incident-highlight')) map.removeLayer('incident-highlight');
    if (map.getLayer('incident-highlight-outline')) map.removeLayer('incident-highlight-outline');
    if (map.getSource('incident-highlight')) map.removeSource('incident-highlight');
  }, [map]);

  /** Highlight an incident's route in its layer color; optionally bring it into view */
  const showHighlight = useCallback(
    (incident: TravelIncident, fit: boolean): void => {
      if (!map) return;
      clearHighlight();
      const color = getIncidentColor(incident.type).primary;
      if (incident.geometry?.type === 'LineString') {
        map.addSource('incident-highlight', {
          type: 'geojson',
          data: { type: 'Feature', properties: {}, geometry: incident.geometry },
        });
        map.addLayer({
          id: 'incident-highlight-outline',
          type: 'line',
          source: 'incident-highlight',
          paint: { 'line-color': color, 'line-width': 8, 'line-opacity': 0.4 },
        });
        map.addLayer({
          id: 'incident-highlight',
          type: 'line',
          source: 'incident-highlight',
          paint: { 'line-color': color, 'line-width': 4, 'line-opacity': 0.8 },
        });
      }
      if (!fit) return;
      const coordinates = incident.geometry?.coordinates;
      if (coordinates && coordinates.length > 0) {
        const bounds = coordinates.reduce(
          (bnds, coord) => bnds.extend(coord),
          new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
        );
        map.fitBounds(bounds, {
          padding: { top: 100, bottom: 100, left: 450, right: 100 },
          maxZoom: 14,
        });
      } else if (incident.location?.lat && incident.location?.lng) {
        // Point reports (like flooding): fly to the location
        map.flyTo({
          center: [incident.location.lng, incident.location.lat],
          zoom: 13,
          duration: 1500,
          padding: { top: 100, bottom: 100, left: 450, right: 100 },
        });
      }
    },
    [map, clearHighlight],
  );

  // List item: toggle the highlight and zoom to it; selecting also opens the panel
  const handleIncidentClick = (incident: TravelIncident): void => {
    if (!map) return;
    if (selectedIncident?.id === incident.id) {
      setSelectedIncident(null);
      clearHighlight();
      return;
    }
    setSelectedIncident(incident);
    showHighlight(incident, true);
    onIncidentClickRef.current?.(incident);
  };

  // Map marker: highlight in place (the user is already looking there) and open the panel
  const handleMarkerActivate = useCallback(
    (incident: TravelIncident): void => {
      setSelectedIncident(incident);
      showHighlight(incident, false);
      onIncidentClickRef.current?.(incident);
    },
    [showHighlight],
  );

  // Filter incidents by active filters and zoom level
  // Memoize to prevent unnecessary marker recreation
  const visibleIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      const typeMatch = activeFilters[incident.type];
      const zoomMatch = shouldShowIncident(incident, currentZoom);
      return typeMatch && zoomMatch;
    });
  }, [incidents, activeFilters, currentZoom]);

  // Incidents with a usable location get a marker
  const markerIncidents = useMemo(
    () => visibleIncidents.filter((i) => i.location?.lat && i.location?.lng),
    [visibleIncidents],
  );
  useMapMarkers(map, visible, markerIncidents, buildIncidentMarker, handleMarkerActivate);

  // Remove the highlight route when the layer unmounts
  useEffect(() => {
    if (!map) return;
    return () => {
      // The parent may already have removed the map (see FINDINGS C1)
      try {
        if (map.getLayer('incident-highlight')) map.removeLayer('incident-highlight');
        if (map.getLayer('incident-highlight-outline'))
          map.removeLayer('incident-highlight-outline');
        if (map.getSource('incident-highlight')) map.removeSource('incident-highlight');
      } catch {
        // Map already destroyed; nothing to clean up
      }
    };
  }, [map]);

  // Group incidents by type
  const incidentsByType: IncidentsByType = visibleIncidents.reduce((acc, incident) => {
    const incidentList = acc[incident.type] ?? (acc[incident.type] = []);
    incidentList.push(incident);
    return acc;
  }, {} as IncidentsByType);

  const totalCount = visibleIncidents.length;

  if (!visible) return null;

  return (
    <div className="travel-section">
      {/* TODO(VTL-45 Phase 4): make the header a <button> (see docs/review/FINDINGS.md, Low/a11y) */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="section-header" onClick={() => setExpanded(!expanded)}>
        <h3>
          Map Features
          {totalCount > 0 && <span className="incident-badge">{totalCount}</span>}
        </h3>
        <button
          className="expand-toggle"
          aria-label={expanded ? 'Collapse map features' : 'Expand map features'}
          aria-expanded={expanded}
          aria-controls="map-features-content"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="section-content" id="map-features-content">
          {/* Weather & Travel Section */}
          <div className="filter-group">
            <h4 className="filter-group-label">Weather & Travel</h4>
            <div className="filter-chips">
              <FilterChip
                layer="weatherStations"
                chipType="weather"
                active={showWeatherStations}
                onClick={onToggleWeatherStations}
              />
              <FilterChip
                layer="trafficFlow"
                chipType="traffic"
                active={showTrafficFlow}
                onClick={onToggleTrafficFlow}
              />
              {onToggleCameras && (
                <FilterChip
                  layer="trafficCameras"
                  chipType="cameras"
                  active={showCameras}
                  onClick={onToggleCameras}
                />
              )}
              {onToggleRoadWeather && (
                <FilterChip
                  layer="roadWeather"
                  chipType="roadwx"
                  active={showRoadWeather}
                  onClick={onToggleRoadWeather}
                />
              )}
              {onToggleSeasonalRoads && (
                <FilterChip
                  layer="seasonalRoads"
                  chipType="seasonal"
                  active={showSeasonalRoads}
                  onClick={onToggleSeasonalRoads}
                />
              )}
              {(Object.keys(activeFilters) as IncidentType[]).map((type) => (
                <FilterChip
                  key={type}
                  layer={type}
                  chipType={type.toLowerCase()}
                  active={activeFilters[type]}
                  onClick={() => toggleFilter(type)}
                  count={incidentsByType[type]?.length ?? 0}
                />
              ))}
            </div>
          </div>

          {/* Points of Interest Section */}
          <div className="filter-group">
            <h4 className="filter-group-label">Points of Interest</h4>
            <div className="filter-chips">
              <FilterChip
                layer="skiResorts"
                chipType="ski"
                active={showSkiResorts}
                onClick={onToggleSkiResorts}
              />
              <FilterChip
                layer="stargazing"
                chipType="stargazing"
                active={showStargazing}
                onClick={onToggleStargazing}
              />
              <FilterChip
                layer="creemeeStands"
                chipType="creemee"
                active={showCreemeeStands}
                onClick={onToggleCreemeeStands}
              />
              <FilterChip
                layer="campingSites"
                chipType="camping"
                active={showCampingSites}
                onClick={onToggleCampingSites}
              />
              <FilterChip
                layer="beachSites"
                chipType="beach"
                active={showBeachSites}
                onClick={onToggleBeachSites}
              />
            </div>
          </div>

          {/* Stargazing content - shown when stargazing chip is active */}
          {showStargazing && <StargazingLayer map={map} isDark={isDark} key={mapStyleVersion} />}

          {/* Camping content - shown when camping chip is active */}
          {showCampingSites && (
            <CampingContent
              showCampgrounds={showCampgrounds}
              onToggleCampgrounds={onToggleCampgrounds}
              showBackcountrySites={showBackcountrySites}
              onToggleBackcountrySites={onToggleBackcountrySites}
              campgroundCount={campgroundCount}
              backcountryCount={backcountryCount}
            />
          )}

          {/* Incidents content - hidden when stargazing or camping is active */}
          {!showStargazing && !showCampingSites && (
            <>
              {/* Loading state with skeleton */}
              {loading && (
                <div className="incidents-skeleton" aria-live="polite" aria-busy="true">
                  <div className="skeleton-item" />
                  <div className="skeleton-item" />
                  <div className="skeleton-item" />
                </div>
              )}

              {/* Last updated timestamp */}
              {lastUpdated && !loading && (
                <div className="last-updated" aria-live="polite">
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>
                    Updated{' '}
                    {lastUpdated.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}

              {/* Error state with retry */}
              {error && !loading && (
                <div className="incidents-error" role="alert" aria-live="assertive">
                  <p style={{ margin: '0 0 8px 0', color: '#ef4444' }}>
                    ⚠️ Failed to load incidents
                  </p>
                  <p style={{ margin: '0 0 8px 0', fontSize: '12px', opacity: 0.8 }}>{error}</p>
                  <button
                    className="retry-button"
                    onClick={() => {
                      void fetchIncidentsData();
                    }}
                    aria-label="Retry loading incidents"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Partial outage: some sources loaded, others didn't */}
              {!error && !loading && unavailableSources.length > 0 && (
                <div className="incidents-partial" role="status">
                  ⚠️ {unavailableSources.join(' and ')} unavailable right now. Showing what loaded.
                </div>
              )}

              {/* Incidents list. Never claim "no incidents" when a fetch failed. */}
              {!error && !loading && totalCount === 0 && (
                <div className="no-incidents">
                  {incidents.length > 0 ? (
                    // Loaded, but hidden by the type filters or zoom level
                    <p>No incidents match the current filters or zoom level</p>
                  ) : unavailableSources.length === 0 ? (
                    <>
                      <span className="success-icon">✓</span>
                      <p>No travel incidents reported</p>
                    </>
                  ) : (
                    <p>No incidents in the data that loaded</p>
                  )}
                </div>
              )}

              {!loading && totalCount > 0 && (
                <div className="incidents-list">
                  {(Object.keys(incidentsByType) as IncidentType[]).sort().map((type) => (
                    <div key={type} className="incident-group">
                      <div className="group-header">
                        <span
                          className="group-icon"
                          style={{ color: getIncidentColor(type).primary }}
                        >
                          {getIcon(type)}
                        </span>
                        <span className="group-title">
                          {getTypeLabel(type)} ({incidentsByType[type]?.length ?? 0})
                        </span>
                      </div>
                      {(incidentsByType[type] ?? []).map((incident) => (
                        // TODO(VTL-45 Phase 4/H15): keyboard access for incident items
                        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                        <div
                          key={incident.id}
                          className={`incident-item ${selectedIncident?.id === incident.id ? 'selected' : ''} ${incident.geometry || incident.location ? 'clickable' : ''}`}
                          data-incident-type={incident.type.toLowerCase()}
                          style={layerColorVars(incident.type)}
                          onClick={() =>
                            (incident.geometry || incident.location) &&
                            handleIncidentClick(incident)
                          }
                        >
                          <div className="incident-title">
                            {incident.title}
                            {(incident.geometry || incident.location) &&
                              selectedIncident?.id === incident.id && (
                                <span style={{ marginLeft: '8px', fontSize: '12px' }}>📍</span>
                              )}
                          </div>
                          {incident.roadName && (
                            <div className="incident-road">{incident.roadName}</div>
                          )}
                          {incident.description && (
                            <div className="incident-desc">{incident.description}</div>
                          )}
                          <div className="incident-source">
                            {incident.source}
                            {(incident.geometry || incident.location) && (
                              <span style={{ marginLeft: '8px', fontSize: '11px', opacity: 0.7 }}>
                                • Click to view
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* Zoom hint */}
              {currentZoom < 8 && (
                <div className="zoom-hint">
                  <ZoomIn size={16} />
                  <span>Zoom in to see more incidents</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(TravelLayer);
