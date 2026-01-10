import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, Construction, Ban, Waves, AlertOctagon, ChevronDown, ChevronRight } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import { fetchAllIncidents } from '../services/travelApi';
import { getIncidentColor, shouldShowIncident } from '../utils/incidentColors';
import { createMarkerElement } from '../utils/incidentIcons';
import './TravelLayer.css';

function TravelLayer({ map, visible, currentZoom }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [activeFilters, setActiveFilters] = useState({
    ACCIDENT: true,
    CONSTRUCTION: true,
    CLOSURE: true,
    FLOODING: true,
    HAZARD: true
  });
  const markersRef = useRef([]);
  const currentPopupRef = useRef(null);

  // Fetch incidents on mount and every 2 minutes
  useEffect(() => {
    if (!map) return;

    fetchIncidents();
    const interval = setInterval(fetchIncidents, 2 * 60 * 1000); // 2 minutes
    return () => clearInterval(interval);
  }, [map]);

  const fetchIncidents = async () => {
    if (!map) return;

    setLoading(true);
    try {
      const bounds = map.getBounds();
      const data = await fetchAllIncidents({
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth()
      });
      setIncidents(data);
    } catch (error) {
      console.error('Error fetching travel incidents:', error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle filter for incident type
  const toggleFilter = (type) => {
    setActiveFilters(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  // Get icon component for incident type
  const getIcon = (type) => {
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
  };

  // Get type label
  const getTypeLabel = (type) => {
    const labels = {
      ACCIDENT: 'Accidents',
      CONSTRUCTION: 'Construction',
      CLOSURE: 'Road Closures',
      FLOODING: 'Flooding',
      HAZARD: 'Hazards'
    };
    return labels[type] || 'Other';
  };

  // Filter incidents by active filters and zoom level
  const visibleIncidents = incidents.filter(incident => {
    const typeMatch = activeFilters[incident.type];
    const zoomMatch = shouldShowIncident(incident, currentZoom);
    return typeMatch && zoomMatch;
  });

  // Add markers to map when incidents or filters change
  useEffect(() => {
    if (!map || !visible) {
      // Clear existing markers and popup
      markersRef.current.forEach(marker => marker.remove());
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
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add new markers for visible incidents
    visibleIncidents.forEach(incident => {
      if (!incident.location || !incident.location.lat || !incident.location.lng) {
        return;
      }

      const el = createMarkerElement(incident.type);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([incident.location.lng, incident.location.lat])
        .addTo(map);

      // Create popup
      const color = getIncidentColor(incident.type);

      // Generate status badge based on timeStatus
      const getStatusBadge = (status) => {
        const statusStyles = {
          active: { bg: '#10B98120', color: '#10B981', label: 'Active' },
          ongoing: { bg: '#10B98120', color: '#10B981', label: 'Ongoing' },
          scheduled: { bg: '#6366F120', color: '#6366F1', label: 'Scheduled' },
          upcoming: { bg: '#6366F120', color: '#6366F1', label: 'Upcoming' },
          ending: { bg: '#F5920B20', color: '#F59E0B', label: 'Ending Soon' },
          completing: { bg: '#F5920B20', color: '#F59E0B', label: 'Wrapping Up' }
        };
        const style = statusStyles[status] || statusStyles.active;
        return `<span style="
          background: ${style.bg};
          color: ${style.color};
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        ">${style.label}</span>`;
      };

      // Format time range if both start and end exist
      const formatTimeInfo = () => {
        if (!incident.startTime && !incident.endTime) return '';

        const formatDate = (dateStr) => {
          if (!dateStr) return null;
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return null;
          return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          });
        };

        const start = formatDate(incident.startTime);
        const end = formatDate(incident.endTime);

        if (start && end) {
          return `${start} - ${end}`;
        } else if (start) {
          return `Started: ${start}`;
        } else if (end) {
          return `Until: ${end}`;
        }
        return '';
      };

      const popup = new maplibregl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
        maxWidth: '320px'
      }).setHTML(`
        <div style="padding: 4px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
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
            ${incident.timeStatus ? getStatusBadge(incident.timeStatus) : ''}
          </div>
          <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 15px; font-weight: 600;">
            ${incident.title}
          </h3>
          ${incident.roadName && incident.roadName !== incident.title ? `
            <p style="margin: 0 0 6px 0; color: #6b7280; font-size: 13px; font-weight: 500;">
              📍 ${incident.roadName}
            </p>
          ` : ''}
          ${incident.description && incident.description !== incident.title ? `
            <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px; line-height: 1.4;">
              ${incident.description}
            </p>
          ` : ''}
          <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; color: #9ca3af; font-style: italic;">
                ${incident.source}
              </span>
            </div>
            ${formatTimeInfo() ? `
              <span style="font-size: 11px; color: #6b7280;">
                🕐 ${formatTimeInfo()}
              </span>
            ` : ''}
          </div>
        </div>
      `);

      // Add popup on click
      el.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent map click from closing immediately

        // Close existing popup if any
        if (currentPopupRef.current) {
          currentPopupRef.current.remove();
        }

        // Open new popup and store reference
        popup.setLngLat([incident.location.lng, incident.location.lat]).addTo(map);
        currentPopupRef.current = popup;
      });

      markersRef.current.push(marker);
    });

    // Cleanup function
    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      if (currentPopupRef.current) {
        currentPopupRef.current.remove();
        currentPopupRef.current = null;
      }
      map.off('click', handleMapClick);
    };
  }, [map, visible, visibleIncidents, activeFilters, currentZoom]);

  // Group incidents by type
  const incidentsByType = visibleIncidents.reduce((acc, incident) => {
    if (!acc[incident.type]) {
      acc[incident.type] = [];
    }
    acc[incident.type].push(incident);
    return acc;
  }, {});

  const totalCount = visibleIncidents.length;

  if (!visible) return null;

  return (
    <div className="travel-section">
      <div className="section-header" onClick={() => setExpanded(!expanded)}>
        <h3>
          Travel Incidents
          {totalCount > 0 && <span className="incident-badge">{totalCount}</span>}
        </h3>
        <button className="expand-toggle">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="section-content">
          {/* Filter checkboxes */}
          <div className="filter-grid">
            {Object.keys(activeFilters).map(type => {
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

          {/* Loading state */}
          {loading && (
            <div className="incidents-loading">
              <div className="loading-spinner-small"></div>
              <span>Updating...</span>
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
              {Object.keys(incidentsByType)
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
                        {getTypeLabel(type)} ({incidentsByType[type].length})
                      </span>
                    </div>
                    {incidentsByType[type].map(incident => (
                      <div
                        key={incident.id}
                        className="incident-item"
                        style={{
                          borderLeftColor: getIncidentColor(incident.type).primary
                        }}
                      >
                        <div className="incident-header">
                          <div className="incident-title">{incident.title}</div>
                          {incident.timeStatus && (
                            <span className={`status-badge status-${incident.timeStatus}`}>
                              {incident.timeStatus === 'scheduled' || incident.timeStatus === 'upcoming' ? '⏱️' :
                               incident.timeStatus === 'ending' || incident.timeStatus === 'completing' ? '⏳' : '●'}
                            </span>
                          )}
                        </div>
                        {incident.roadName && incident.roadName !== incident.title && (
                          <div className="incident-road">{incident.roadName}</div>
                        )}
                        {incident.description && incident.description !== incident.title && (
                          <div className="incident-desc">{incident.description}</div>
                        )}
                        <div className="incident-source">{incident.source}</div>
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

export default TravelLayer;
