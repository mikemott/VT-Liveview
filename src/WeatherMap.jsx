import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './WeatherMap.css';
import TravelLayer from './components/TravelLayer';

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
      addRadarLayer();
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

  // Add radar overlay
  const addRadarLayer = async () => {
    if (!map.current) return;

    try {
      // Fetch latest radar timestamp from RainViewer
      const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      const data = await response.json();
      
      if (data.radar && data.radar.past && data.radar.past.length > 0) {
        const latestRadar = data.radar.past[data.radar.past.length - 1];
        
        map.current.addSource('radar', {
          type: 'raster',
          tiles: [
            `https://tilecache.rainviewer.com${latestRadar.path}/256/{z}/{x}/{y}/2/1_1.png`
          ],
          tileSize: 256
        });

        map.current.addLayer({
          id: 'radar-layer',
          type: 'raster',
          source: 'radar',
          paint: {
            'raster-opacity': radarOpacity
          }
        });
      }
    } catch (error) {
      console.error('Error loading radar:', error);
    }
  };

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
    if (!map.current) return;
    
    const newVisibility = !radarVisible;
    setRadarVisible(newVisibility);
    
    if (map.current.getLayer('radar-layer')) {
      map.current.setLayoutProperty(
        'radar-layer',
        'visibility',
        newVisibility ? 'visible' : 'none'
      );
    }
  };

  // Update radar opacity
  const updateRadarOpacity = (value) => {
    setRadarOpacity(value);
    if (map.current && map.current.getLayer('radar-layer')) {
      map.current.setPaintProperty('radar-layer', 'raster-opacity', value);
    }
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
          <h3>Radar</h3>
          <label className="toggle-control">
            <input
              type="checkbox"
              checked={radarVisible}
              onChange={toggleRadar}
            />
            <span>Show Radar</span>
          </label>
          
          {radarVisible && (
            <div className="slider-control">
              <label>Opacity</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={radarOpacity}
                onChange={(e) => updateRadarOpacity(parseFloat(e.target.value))}
              />
            </div>
          )}
        </div>

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
          <p>Radar: RainViewer</p>
          <p>Traffic: HERE, USGS, VTrans</p>
          <p>Map: OpenStreetMap</p>
        </div>
      </div>
    </div>
  );
}

export default WeatherMap;
