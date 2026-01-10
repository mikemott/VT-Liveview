import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './WeatherMap.css';
import TravelLayer from './components/TravelLayer';
import MapTilerRadar from './components/MapTilerRadar';

const VERMONT_CENTER = {
  lng: -72.7,
  lat: 44.0,
  zoom: 7.5
};

function WeatherMap() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [radarVisible, setRadarVisible] = useState(true);
  const [radarOpacity, setRadarOpacity] = useState(0.7);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [travelVisible, setTravelVisible] = useState(true);
  const [currentZoom, setCurrentZoom] = useState(VERMONT_CENTER.zoom);
  const [selectedAlert, setSelectedAlert] = useState(null);

  // Handle alert selection - zoom to alert and highlight it
  const handleAlertClick = async (alert) => {
    setSelectedAlert(alert);

    if (!map.current) return;

    // Fetch zone geometries from affectedZones URLs
    const affectedZones = alert.properties.affectedZones || [];
    if (affectedZones.length === 0) return;

    // Get color based on severity
    const getSeverityColor = (severity) => {
      const severityLower = severity?.toLowerCase();
      switch (severityLower) {
        case 'extreme': return '#dc2626';
        case 'severe': return '#ea580c';
        case 'moderate': return '#ca8a04';
        case 'minor': return '#2563eb';
        default: return '#808080';
      }
    };

    const severityColor = getSeverityColor(alert.properties.severity);

    try {
      // Fetch all zone geometries
      const zonePromises = affectedZones.map(zoneUrl =>
        fetch(zoneUrl).then(res => res.json())
      );
      const zones = await Promise.all(zonePromises);

      // Filter zones with valid geometry and create features
      const zoneFeatures = zones
        .filter(zone => zone.geometry)
        .map(zone => ({
          type: 'Feature',
          geometry: zone.geometry,
          properties: {}
        }));

      if (zoneFeatures.length === 0) return;

      // Update or create highlighted zones on map
      if (map.current.getSource('highlighted-zones')) {
        map.current.getSource('highlighted-zones').setData({
          type: 'FeatureCollection',
          features: zoneFeatures
        });
        // Update layer colors
        map.current.setPaintProperty('highlighted-zones-fill', 'fill-color', severityColor);
        map.current.setPaintProperty('highlighted-zones-border', 'line-color', severityColor);
      } else {
        // Add highlighted zones source and layers
        map.current.addSource('highlighted-zones', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: zoneFeatures
          }
        });

        map.current.addLayer({
          id: 'highlighted-zones-fill',
          type: 'fill',
          source: 'highlighted-zones',
          paint: {
            'fill-color': severityColor,
            'fill-opacity': 0.25
          }
        });

        map.current.addLayer({
          id: 'highlighted-zones-border',
          type: 'line',
          source: 'highlighted-zones',
          paint: {
            'line-color': severityColor,
            'line-width': 3,
            'line-opacity': 0.8
          }
        });
      }

      // Calculate bounds for all zone features
      const allCoordinates = [];
      zoneFeatures.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
          allCoordinates.push(...feature.geometry.coordinates[0]);
        } else if (feature.geometry.type === 'MultiPolygon') {
          feature.geometry.coordinates.forEach(polygon => {
            allCoordinates.push(...polygon[0]);
          });
        }
      });

      if (allCoordinates.length > 0) {
        const bounds = allCoordinates.reduce((bounds, coord) => {
          return bounds.extend(coord);
        }, new maplibregl.LngLatBounds(allCoordinates[0], allCoordinates[0]));

        map.current.fitBounds(bounds, {
          padding: { top: 100, bottom: 100, left: 100, right: 500 },
          duration: 1000
        });
      }
    } catch (error) {
      console.error('Error fetching zone geometries:', error);
    }
  };

  // Clear highlighted alert when modal closes
  const handleCloseAlert = () => {
    setSelectedAlert(null);
    if (map.current && map.current.getSource('highlighted-zones')) {
      map.current.getSource('highlighted-zones').setData({
        type: 'FeatureCollection',
        features: []
      });
    }
  };

  // Initialize map
  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: [
              'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      center: [VERMONT_CENTER.lng, VERMONT_CENTER.lat],
      zoom: VERMONT_CENTER.zoom
    });

    map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.current.addControl(new maplibregl.FullscreenControl(), 'top-right');

    map.current.on('load', () => {
      setLoading(false);
      fetchAlerts();
    });

    // Track zoom changes for travel layer filtering
    map.current.on('zoom', () => {
      setCurrentZoom(map.current.getZoom());
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Fetch NOAA weather alerts
  const fetchAlerts = async () => {
    try {
      const response = await fetch('https://api.weather.gov/alerts/active?area=VT');
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        setAlerts(data.features);
        addAlertsToMap(data.features);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  // Add alerts to map
  const addAlertsToMap = (alertFeatures) => {
    if (!map.current) return;

    // Add alerts source
    if (!map.current.getSource('alerts')) {
      map.current.addSource('alerts', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: alertFeatures
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
            'Extreme', '#FF0000',
            'Severe', '#FF8C00',
            'Moderate', '#FFD700',
            'Minor', '#4169E1',
            '#808080' // default
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
            'Extreme', '#FF0000',
            'Severe', '#FF8C00',
            'Moderate', '#FFD700',
            'Minor', '#4169E1',
            '#808080'
          ],
          'line-width': 2
        }
      });

      // Add click handler for alerts
      map.current.on('click', 'alert-fills', (e) => {
        const properties = e.features[0].properties;
        new maplibregl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(`
            <div style="max-width: 300px;">
              <h3 style="margin: 0 0 8px 0; color: #333;">${properties.event}</h3>
              <p style="margin: 0 0 8px 0; font-weight: bold; color: #666;">
                Severity: ${properties.severity}
              </p>
              <p style="margin: 0; color: #666; font-size: 14px;">
                ${properties.headline}
              </p>
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
    }
  };

  // Toggle radar visibility
  const toggleRadar = () => {
    setRadarVisible(!radarVisible);
  };

  // Update radar opacity
  const updateRadarOpacity = (value) => {
    setRadarOpacity(value);
  };

  return (
    <div className="weather-map-container">
      <div ref={mapContainer} className="map-container" />
      
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading Vermont Weather Map...</p>
        </div>
      )}

      <div className="controls-panel">
        <h2>Vermont Weather</h2>
        
        <div className="control-section">
          <h3>Weather Radar</h3>
          <label className="toggle-control">
            <input
              type="checkbox"
              checked={radarVisible}
              onChange={toggleRadar}
            />
            <span>Show Radar</span>
          </label>
        </div>

        {/* MapTiler Radar with Animation Controls */}
        {!loading && (
          <MapTilerRadar
            map={map.current}
            visible={radarVisible}
            opacity={radarOpacity}
            onOpacityChange={updateRadarOpacity}
          />
        )}

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

        {travelVisible && (
          <TravelLayer
            map={map.current}
            visible={travelVisible}
            currentZoom={currentZoom}
          />
        )}

        {alerts.length > 0 && (
          <div className="control-section">
            <h3>Active Alerts ({alerts.length})</h3>
            <div className="alerts-list">
              {alerts.map((alert, index) => (
                <div
                  key={index}
                  className={`alert-item severity-${alert.properties.severity?.toLowerCase()}`}
                  onClick={() => handleAlertClick(alert)}
                  style={{ cursor: 'pointer' }}
                  title="Click to view full alert details"
                >
                  <div className="alert-event">{alert.properties.event}</div>
                  <div className="alert-headline">{alert.properties.headline}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="attribution">
          <p>Weather: NOAA</p>
          <p>Radar: <a href="https://www.maptiler.com/weather/" target="_blank" rel="noopener noreferrer">MapTiler Weather</a></p>
          <p>Traffic: HERE, USGS, VTrans</p>
          <p>Map: OpenStreetMap</p>
        </div>
      </div>

      {selectedAlert && (
        <div className="alert-modal-overlay" onClick={handleCloseAlert}>
          <div
            className={`alert-modal severity-${selectedAlert.properties.severity?.toLowerCase()}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="alert-modal-header">
              <div className="alert-modal-title">
                <h2>{selectedAlert.properties.event}</h2>
                <span className={`severity-badge severity-${selectedAlert.properties.severity?.toLowerCase()}`}>
                  {selectedAlert.properties.severity}
                </span>
              </div>
              <button className="alert-modal-close" onClick={handleCloseAlert}>×</button>
            </div>

            <div className="alert-modal-content">
              <div className="alert-modal-section">
                <h3>Headline</h3>
                <p>{selectedAlert.properties.headline}</p>
              </div>

              {selectedAlert.properties.description && (
                <div className="alert-modal-section">
                  <h3>Description</h3>
                  <p className="alert-description">{selectedAlert.properties.description}</p>
                </div>
              )}

              {selectedAlert.properties.instruction && (
                <div className="alert-modal-section">
                  <h3>Instructions</h3>
                  <p className="alert-instruction">{selectedAlert.properties.instruction}</p>
                </div>
              )}

              <div className="alert-modal-meta">
                <div><strong>Area:</strong> {selectedAlert.properties.areaDesc}</div>
                <div><strong>Effective:</strong> {new Date(selectedAlert.properties.effective).toLocaleString()}</div>
                {selectedAlert.properties.ends && (
                  <div><strong>Ends:</strong> {new Date(selectedAlert.properties.ends).toLocaleString()}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WeatherMap;
