import { useState, useEffect, useRef, useCallback, ReactNode, memo } from 'react';
import { AlertTriangle, Construction, Ban, Waves, AlertOctagon, ChevronDown, ChevronRight, Thermometer } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import { fetchAllIncidents, type TravelIncident } from '../services/travelApi';
import { getIncidentColor, shouldShowIncident } from '../utils/incidentColors';
import { createMarkerElement } from '../utils/incidentIcons';
import { INTERVALS } from '../utils/constants';
import { escapeHTML } from '../utils/sanitize';
import { cleanupMarkers, type MarkerEntry } from '../utils/markerCleanup';
import type { MapLibreMap, Popup, IncidentType } from '../types';
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
}

interface IncidentsByType {
  [key: string]: TravelIncident[];
}

// =============================================================================
// Helper Functions
// =============================================================================

function getIcon(type: IncidentType): ReactNode {
  const iconProps = { size: 16, strokeWidth: 2.5 };
  switch (type) {
    case 'ACCIDENT':
      return <AlertTriangle {...iconProps} />;
    case 'CONSTRUCTION':
      return <Construction {...iconProps} />;
    case 'CLOSURE':
      return <Ban {...iconProps} />;
    case 'FLOODING':
      return <Waves {...iconProps} />;
    case 'HAZARD':
    default:
      return <AlertOctagon {...iconProps} />;
  }
}

function getTypeLabel(type: IncidentType): string {
  const labels: Record<IncidentType, string> = {
    ACCIDENT: 'Accidents',
    CONSTRUCTION: 'Construction',
    CLOSURE: 'Road Closures',
    FLOODING: 'Flooding',
    HAZARD: 'Hazards'
  };
  return labels[type] || 'Other';
}

// =============================================================================
// Component
// =============================================================================

function TravelLayer({ map, visible, currentZoom, isDark, showWeatherStations, onToggleWeatherStations }: TravelLayerProps) {
  const [incidents, setIncidents] = useState<TravelIncident[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState<TravelIncident | null>(null);
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    ACCIDENT: true,
    CONSTRUCTION: true,
    CLOSURE: true,
    FLOODING: true,
    HAZARD: true
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const markersRef = useRef<MarkerEntry[]>([]);
  const currentPopupRef = useRef<Popup | null>(null);

  // Fetch incidents function (accessible to retry button)
  const fetchIncidentsData = useCallback(async (): Promise<void> => {
    if (!map) return;

    setLoading(true);
    try {
      setError(null); // Clear previous errors
      const data = await fetchAllIncidents();
      setIncidents(data);
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

  // Fetch incidents on mount and every 2 minutes
  useEffect(() => {
    if (!map) return;

    void fetchIncidentsData();
    const interval = setInterval(() => void fetchIncidentsData(), INTERVALS.INCIDENTS_REFRESH);
    return () => clearInterval(interval);
  }, [map, fetchIncidentsData]);

  // Toggle filter for incident type
  const toggleFilter = (type: IncidentType): void => {
    setActiveFilters(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  // Handle incident click to highlight affected area
  const handleIncidentClick = (incident: TravelIncident): void => {
    if (!map) return;

    // Toggle selection - if already selected, deselect
    if (selectedIncident?.id === incident.id) {
      setSelectedIncident(null);
      // Remove highlight layers
      if (map.getLayer('incident-highlight')) {
        map.removeLayer('incident-highlight');
      }
      if (map.getLayer('incident-highlight-outline')) {
        map.removeLayer('incident-highlight-outline');
      }
      if (map.getSource('incident-highlight')) {
        map.removeSource('incident-highlight');
      }
      return;
    }

    // Set new selection
    setSelectedIncident(incident);

    // Remove existing highlight
    if (map.getLayer('incident-highlight')) {
      map.removeLayer('incident-highlight');
    }
    if (map.getLayer('incident-highlight-outline')) {
      map.removeLayer('incident-highlight-outline');
    }
    if (map.getSource('incident-highlight')) {
      map.removeSource('incident-highlight');
    }

    // Add highlight if incident has geometry
    if (incident.geometry) {
      // Add source
      map.addSource('incident-highlight', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: incident.geometry
        }
      });

      const color = getIncidentColor(incident.type);

      // Add line layer for route
      if (incident.geometry.type === 'LineString') {
        map.addLayer({
          id: 'incident-highlight-outline',
          type: 'line',
          source: 'incident-highlight',
          paint: {
            'line-color': color.primary,
            'line-width': 8,
            'line-opacity': 0.4
          }
        });

        map.addLayer({
          id: 'incident-highlight',
          type: 'line',
          source: 'incident-highlight',
          paint: {
            'line-color': color.primary,
            'line-width': 4,
            'line-opacity': 0.8
          }
        });
      }

      // Fit map to show the entire route
      const coordinates = incident.geometry.coordinates as [number, number][];
      const bounds = coordinates.reduce((bnds, coord) => {
        return bnds.extend(coord);
      }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

      map.fitBounds(bounds, {
        padding: { top: 100, bottom: 100, left: 450, right: 100 },
        maxZoom: 14
      });
    } else if (incident.location && incident.location.lat && incident.location.lng) {
      // For point locations (like flooding), fly to the location
      map.flyTo({
        center: [incident.location.lng, incident.location.lat],
        zoom: 13,
        duration: 1500,
        padding: { top: 100, bottom: 100, left: 450, right: 100 }
      });
    }
  };

  // Filter incidents by active filters and zoom level
  const visibleIncidents = incidents.filter(incident => {
    const typeMatch = activeFilters[incident.type as keyof ActiveFilters];
    const zoomMatch = shouldShowIncident(incident, currentZoom);
    return typeMatch && zoomMatch;
  });

  // Add markers to map when incidents or filters change
  useEffect(() => {
    if (!map || !visible) {
      // Clear existing markers, event listeners, and popup
      cleanupMarkers(markersRef.current);
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

    // Remove old markers and clean up event listeners
    cleanupMarkers(markersRef.current);

    // Add new markers for visible incidents
    visibleIncidents.forEach(incident => {
      if (!incident.location || !incident.location.lat || !incident.location.lng) {
        return;
      }

      const el = createMarkerElement(incident.type);
      if (!el) return;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([incident.location.lng, incident.location.lat])
        .addTo(map);

      // Create popup with theme-aware colors
      const color = getIncidentColor(incident.type);
      const themeColors = isDark ? {
        title: '#f5f5f5',
        text: '#c0c0c0',
        textSecondary: '#b5b5b5',
        metadata: '#a5a5a5',
        border: 'rgba(255, 255, 255, 0.1)',
        background: '#1a1a1a'
      } : {
        title: '#1f2937',
        text: '#6b7280',
        textSecondary: '#6b7280',
        metadata: '#9ca3af',
        border: '#e5e7eb',
        background: '#ffffff'
      };

      // Escape user-controlled content to prevent XSS
      const safeTitle = escapeHTML(incident.title);
      const safeRoadName = escapeHTML(incident.roadName);
      const safeDescription = escapeHTML(incident.description);
      const safeSource = escapeHTML(incident.source);

      const popup = new maplibregl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
        maxWidth: '320px'
      }).setHTML(`
        <div style="padding: 4px; background: ${themeColors.background}; color: ${themeColors.text};">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="
              background: ${color.background};
              color: ${color.primary};
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            ">${incident.type}</span>
          </div>
          <h3 style="margin: 0 0 8px 0; color: ${themeColors.title}; font-size: 15px; font-weight: 600;">
            ${safeTitle}
          </h3>
          ${safeRoadName ? `
            <p style="margin: 0 0 6px 0; color: ${themeColors.text}; font-size: 13px; font-weight: 500;">
              📍 ${safeRoadName}
            </p>
          ` : ''}
          ${safeDescription ? `
            <p style="margin: 0 0 8px 0; color: ${themeColors.textSecondary}; font-size: 13px; line-height: 1.4;">
              ${safeDescription}
            </p>
          ` : ''}
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px solid ${themeColors.border};">
            <span style="font-size: 11px; color: ${themeColors.metadata}; font-style: italic;">
              ${safeSource}
            </span>
            ${incident.startTime ? `
              <span style="font-size: 11px; color: ${themeColors.metadata};">
                ${new Date(incident.startTime).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </span>
            ` : ''}
          </div>
        </div>
      `);

      // Store click handler for cleanup
      const handleMarkerClick = (e: MouseEvent): void => {
        e.stopPropagation(); // Prevent map click from closing immediately

        // Close existing popup if any (atomic operation)
        if (currentPopupRef.current && currentPopupRef.current !== popup) {
          currentPopupRef.current.remove();
          currentPopupRef.current = null;
        }

        // Toggle popup: close if clicking same marker, open if different
        if (currentPopupRef.current === popup) {
          popup.remove();
          currentPopupRef.current = null;
        } else {
          popup.setLngLat([incident.location.lng, incident.location.lat]).addTo(map);
          currentPopupRef.current = popup;
        }
      };

      // Add event listener and store for cleanup
      el.addEventListener('click', handleMarkerClick as EventListener);

      // Store marker and its cleanup function
      markersRef.current.push({
        marker: marker as Marker,
        element: el,
        handler: handleMarkerClick
      });
    });

    // Cleanup function
    return () => {
      // Clean up markers and event listeners
      cleanupMarkers(markersRef.current);

      // Clean up popup
      if (currentPopupRef.current) {
        currentPopupRef.current.remove();
        currentPopupRef.current = null;
      }

      // Clean up map click handler
      map.off('click', handleMapClick);
    };
  }, [map, visible, visibleIncidents, activeFilters, currentZoom, isDark]);

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
          {/* Filter checkboxes */}
          <div className="filter-grid">
            {/* Weather Stations toggle */}
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={showWeatherStations}
                onChange={onToggleWeatherStations}
              />
              <span className="checkbox-icon" style={{ color: '#3b82f6' }}>
                <Thermometer size={16} strokeWidth={2.5} />
              </span>
              <span className="checkbox-label">
                Weather Stations
              </span>
            </label>

            {/* Incident type toggles */}
            {(Object.keys(activeFilters) as IncidentType[]).map(type => {
              const color = getIncidentColor(type);
              const count = incidentsByType[type]?.length || 0;

              return (
                <label key={type} className="filter-checkbox">
                  <input
                    type="checkbox"
                    checked={activeFilters[type]}
                    onChange={() => toggleFilter(type)}
                  />
                  <span className="checkbox-icon" style={{ color: color.primary }}>
                    {getIcon(type)}
                  </span>
                  <span className="checkbox-label">
                    {getTypeLabel(type)}
                    {count > 0 && <span className="count">({count})</span>}
                  </span>
                </label>
              );
            })}
          </div>

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
                Updated {lastUpdated.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit'
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
              <p style={{ margin: '0 0 8px 0', fontSize: '12px', opacity: 0.8 }}>
                {error}
              </p>
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

          {/* Incidents list */}
          {!loading && totalCount === 0 && (
            <div className="no-incidents">
              <span className="success-icon">✓</span>
              <p>No travel incidents reported</p>
            </div>
          )}

          {!loading && totalCount > 0 && (
            <div className="incidents-list">
              {(Object.keys(incidentsByType) as IncidentType[])
                .sort()
                .map(type => (
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
                    {(incidentsByType[type] ?? []).map(incident => (
                      <div
                        key={incident.id}
                        className={`incident-item ${selectedIncident?.id === incident.id ? 'selected' : ''} ${(incident.geometry || incident.location) ? 'clickable' : ''}`}
                        style={{
                          borderLeftColor: getIncidentColor(incident.type).primary
                        }}
                        onClick={() => (incident.geometry || incident.location) && handleIncidentClick(incident)}
                      >
                        <div className="incident-title">
                          {incident.title}
                          {(incident.geometry || incident.location) && selectedIncident?.id === incident.id && (
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
                          {(incident.geometry || incident.location) && <span style={{ marginLeft: '8px', fontSize: '11px', opacity: 0.7 }}>• Click to view</span>}
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
              <span>🔍 Zoom in to see more incidents</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(TravelLayer);
