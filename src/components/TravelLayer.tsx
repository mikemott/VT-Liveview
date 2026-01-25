import { useState, useEffect, useRef, useCallback, useMemo, ReactNode, memo } from 'react';
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

function getIcon(type: IncidentType, size: number = 16): ReactNode {
  const iconProps = { size, strokeWidth: 2.5 };
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

function getTypeLabel(type: IncidentType, short: boolean = false): string {
  const labels: Record<IncidentType, string> = {
    ACCIDENT: short ? 'Incidents' : 'Accidents',
    CONSTRUCTION: 'Construction',
    CLOSURE: short ? 'Closures' : 'Road Closures',
    FLOODING: short ? 'Floods' : 'Flooding',
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
  // Memoize to prevent unnecessary marker recreation
  const visibleIncidents = useMemo(() => {
    return incidents.filter(incident => {
      const typeMatch = activeFilters[incident.type as keyof ActiveFilters];
      const zoomMatch = shouldShowIncident(incident, currentZoom);
      return typeMatch && zoomMatch;
    });
  }, [incidents, activeFilters, currentZoom]);

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

      // Create popup with theme-aware colors matching chip design
      const color = getIncidentColor(incident.type);

      // Get gradient and colors based on incident type (matching chip styles)
      const getPopupGradient = (type: IncidentType, dark: boolean) => {
        const gradients: Record<IncidentType, { light: string; dark: string; textLight: string; textDark: string; accentLight: string; accentDark: string }> = {
          ACCIDENT: {
            light: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)',
            dark: 'linear-gradient(135deg, rgba(139, 92, 246, 0.18) 0%, rgba(139, 92, 246, 0.12) 100%)',
            textLight: '#7C3AED',
            textDark: '#C4B5FD',
            accentLight: '#8B5CF6',
            accentDark: '#A78BFA'
          },
          CONSTRUCTION: {
            light: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(249, 115, 22, 0.08) 100%)',
            dark: 'linear-gradient(135deg, rgba(249, 115, 22, 0.18) 0%, rgba(249, 115, 22, 0.12) 100%)',
            textLight: '#EA580C',
            textDark: '#FDBA74',
            accentLight: '#F97316',
            accentDark: '#FB923C'
          },
          CLOSURE: {
            light: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.08) 100%)',
            dark: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(239, 68, 68, 0.12) 100%)',
            textLight: '#DC2626',
            textDark: '#FCA5A5',
            accentLight: '#EF4444',
            accentDark: '#F87171'
          },
          FLOODING: {
            light: 'linear-gradient(135deg, rgba(20, 184, 166, 0.12) 0%, rgba(20, 184, 166, 0.08) 100%)',
            dark: 'linear-gradient(135deg, rgba(20, 184, 166, 0.18) 0%, rgba(20, 184, 166, 0.12) 100%)',
            textLight: '#0D9488',
            textDark: '#5EEAD4',
            accentLight: '#14B8A6',
            accentDark: '#2DD4BF'
          },
          HAZARD: {
            light: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.08) 100%)',
            dark: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18) 0%, rgba(245, 158, 11, 0.12) 100%)',
            textLight: '#D97706',
            textDark: '#FCD34D',
            accentLight: '#F59E0B',
            accentDark: '#FBBF24'
          }
        };
        return gradients[type] || gradients.HAZARD;
      };

      const gradient = getPopupGradient(incident.type, isDark);
      const themeColors = isDark ? {
        title: '#f5f5f5',
        text: '#e5e5e5',
        textSecondary: '#d1d1d1',
        metadata: '#a3a3a3',
        border: 'rgba(255, 255, 255, 0.1)',
        background: 'rgba(23, 23, 23, 0.95)',
        badgeText: gradient.textDark,
        badgeAccent: gradient.accentDark,
        gradient: gradient.dark
      } : {
        title: '#1f2937',
        text: '#4b5563',
        textSecondary: '#6b7280',
        metadata: '#9ca3af',
        border: 'rgba(0, 0, 0, 0.1)',
        background: 'rgba(255, 255, 255, 0.98)',
        badgeText: gradient.textLight,
        badgeAccent: gradient.accentLight,
        gradient: gradient.light
      };

      // Escape user-controlled content to prevent XSS
      const safeTitle = escapeHTML(incident.title);
      const safeRoadName = escapeHTML(incident.roadName);
      const safeDescription = escapeHTML(incident.description);
      const safeSource = escapeHTML(incident.source);

      // Location pin SVG icon (replaces emoji)
      const pinIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${themeColors.badgeAccent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

      const popup = new maplibregl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
        maxWidth: '320px',
        className: 'incident-popup'
      }).setHTML(`
        <div style="
          padding: 12px;
          background: ${themeColors.background};
          backdrop-filter: blur(12px);
          border-radius: 12px;
          border: 1px solid ${themeColors.border};
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
          <div style="
            background: ${themeColors.gradient};
            border: 1.5px solid ${themeColors.badgeAccent}40;
            border-radius: 8px;
            padding: 10px;
            margin-bottom: 10px;
          ">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              <span style="
                background: ${themeColors.badgeAccent}25;
                color: ${themeColors.badgeText};
                padding: 3px 8px;
                border-radius: 6px;
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.8px;
              ">${incident.type}</span>
            </div>
            <h3 style="
              margin: 0;
              color: ${themeColors.badgeText};
              font-size: 14px;
              font-weight: 600;
              line-height: 1.3;
            ">${safeTitle}</h3>
          </div>
          ${safeRoadName ? `
            <div style="
              display: flex;
              align-items: center;
              gap: 6px;
              margin-bottom: 8px;
              color: ${themeColors.text};
              font-size: 12px;
              font-weight: 500;
            ">
              ${pinIcon}
              <span>${safeRoadName}</span>
            </div>
          ` : ''}
          ${safeDescription ? `
            <p style="
              margin: 0 0 10px 0;
              color: ${themeColors.textSecondary};
              font-size: 12px;
              line-height: 1.5;
            ">${safeDescription}</p>
          ` : ''}
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-top: 8px;
            border-top: 1px solid ${themeColors.border};
          ">
            <span style="
              font-size: 10px;
              color: ${themeColors.metadata};
              font-style: italic;
              font-weight: 500;
            ">${safeSource}</span>
            ${incident.startTime ? `
              <span style="
                font-size: 10px;
                color: ${themeColors.metadata};
                font-weight: 500;
              ">${new Date(incident.startTime).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}</span>
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
  }, [map, visible, visibleIncidents, isDark]);

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
          {/* Filter chips - compact horizontal layout */}
          <div className="filter-chips">
            {/* Weather Stations chip */}
            <button
              className={`filter-chip ${showWeatherStations ? 'active' : ''}`}
              onClick={onToggleWeatherStations}
              aria-pressed={showWeatherStations}
              data-chip-type="weather"
            >
              <span className="chip-icon">
                <Thermometer size={14} strokeWidth={2.5} />
              </span>
              Stations
            </button>

            {/* Incident type chips */}
            {(Object.keys(activeFilters) as IncidentType[]).map(type => {
              const count = incidentsByType[type]?.length || 0;

              return (
                <button
                  key={type}
                  className={`filter-chip ${activeFilters[type] ? 'active' : ''}`}
                  onClick={() => toggleFilter(type)}
                  aria-pressed={activeFilters[type]}
                  data-chip-type={type.toLowerCase()}
                >
                  <span className="chip-icon">
                    {getIcon(type, 14)}
                  </span>
                  {getTypeLabel(type, true)}
                  {count > 0 && <span className="chip-count">{count}</span>}
                </button>
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
                          borderLeftColor: getIncidentColor(incident.type).primary,
                          background: isDark
                            ? `linear-gradient(135deg, ${getIncidentColor(incident.type).primary}15 0%, ${getIncidentColor(incident.type).primary}08 100%)`
                            : `linear-gradient(135deg, ${getIncidentColor(incident.type).primary}0A 0%, ${getIncidentColor(incident.type).primary}05 100%)`
                        }}
                        onClick={() => (incident.geometry || incident.location) && handleIncidentClick(incident)}
                      >
                        <div
                          className="incident-title"
                          style={{ color: getIncidentColor(incident.type).primary }}
                        >
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
