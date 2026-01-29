import { useEffect, useRef, useState, useCallback, ChangeEvent } from 'react';
import { createRoot } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import { Star, Eye, EyeOff, MapPin, Moon } from 'lucide-react';
import { LIGHT_POLLUTION_DATA, VERMONT_DARK_SKY_ZONES } from '../data/lightPollution';
import { DARK_SKY_SITES } from '../data/darkSkySites';
import { BORTLE_COLORS, BORTLE_DESCRIPTIONS } from '../types/stargazing';
import { calculateMoonPhase, calculateStargazingScore } from '../utils/astronomy';
import AstronomyEvents from './AstronomyEvents';
import type { MapLibreMap } from '../types';
import type { DarkSkySite, BortleClass } from '../types/stargazing';
import './StargazingLayer.css';

interface StargazingLayerProps {
  map: MapLibreMap | null;
  isDark?: boolean;
  onSiteClick?: (site: DarkSkySite) => void;
  cloudCoverPercent?: number;
}

interface MarkerEntry {
  marker: maplibregl.Marker;
  element: HTMLDivElement;
  handler: (e: MouseEvent) => void;
  root?: ReturnType<typeof createRoot>;
}

// Marker icon component
function StarMarkerIcon({ bortleClass }: { bortleClass: BortleClass }) {
  const color = bortleClass <= 3 ? '#ffd700' : bortleClass <= 5 ? '#ffa500' : '#888888';
  return (
    <Star
      size={20}
      fill={color}
      color={color}
      strokeWidth={1.5}
    />
  );
}

export default function StargazingLayer({
  map,
  isDark = false,
  onSiteClick,
  cloudCoverPercent = 20,
}: StargazingLayerProps) {
  const [visible, setVisible] = useState(true); // On by default when stargazing mode is active
  const [showSites, setShowSites] = useState(true);
  const [opacity, setOpacity] = useState(0.5);
  const layersInitialized = useRef(false);
  const markersRef = useRef<MarkerEntry[]>([]);
  const currentPopupRef = useRef<maplibregl.Popup | null>(null);

  // Calculate current moon phase and stargazing quality
  const moonPhase = calculateMoonPhase();
  const { score: qualityScore, rating: qualityRating } = calculateStargazingScore(
    cloudCoverPercent,
    moonPhase.illumination
  );

  // Helper to safely check if layer exists
  const hasLayer = useCallback((layerId: string): boolean => {
    if (!map || !map.isStyleLoaded()) return false;
    try {
      return !!map.getLayer(layerId);
    } catch {
      return false;
    }
  }, [map]);

  // Helper to safely check if source exists
  const hasSource = useCallback((sourceId: string): boolean => {
    if (!map || !map.isStyleLoaded()) return false;
    try {
      return !!map.getSource(sourceId);
    } catch {
      return false;
    }
  }, [map]);

  // Cleanup markers
  const cleanupMarkers = useCallback(() => {
    markersRef.current.forEach(({ marker, element, handler, root }) => {
      if (element && handler) {
        element.removeEventListener('click', handler as EventListener);
      }
      if (root) {
        root.unmount();
      }
      marker.remove();
    });
    markersRef.current = [];

    if (currentPopupRef.current) {
      currentPopupRef.current.remove();
      currentPopupRef.current = null;
    }
  }, []);

  // Initialize light pollution layers
  useEffect(() => {
    if (!map || !map.isStyleLoaded()) return;

    // Only initialize once
    if (layersInitialized.current) return;

    // Add dark sky base zones (Bortle 2-3 areas)
    if (!hasSource('dark-sky-zones')) {
      map.addSource('dark-sky-zones', {
        type: 'geojson',
        data: VERMONT_DARK_SKY_ZONES,
      });

      map.addLayer({
        id: 'dark-sky-zones-fill',
        type: 'fill',
        source: 'dark-sky-zones',
        paint: {
          'fill-color': [
            'match',
            ['get', 'bortleClass'],
            2, BORTLE_COLORS[2],
            3, BORTLE_COLORS[3],
            BORTLE_COLORS[3], // default
          ],
          'fill-opacity': 0,
        },
      });
    }

    // Add light pollution zones (population centers)
    if (!hasSource('light-pollution')) {
      map.addSource('light-pollution', {
        type: 'geojson',
        data: LIGHT_POLLUTION_DATA,
      });

      map.addLayer({
        id: 'light-pollution-fill',
        type: 'fill',
        source: 'light-pollution',
        paint: {
          'fill-color': [
            'match',
            ['get', 'bortleClass'],
            4, BORTLE_COLORS[4],
            5, BORTLE_COLORS[5],
            6, BORTLE_COLORS[6],
            7, BORTLE_COLORS[7],
            8, BORTLE_COLORS[8],
            9, BORTLE_COLORS[9],
            BORTLE_COLORS[5], // default
          ],
          'fill-opacity': 0,
        },
      });
    }

    layersInitialized.current = true;

    return () => {
      // Cleanup layers
      if (hasLayer('light-pollution-fill')) {
        map.removeLayer('light-pollution-fill');
      }
      if (hasSource('light-pollution')) {
        map.removeSource('light-pollution');
      }
      if (hasLayer('dark-sky-zones-fill')) {
        map.removeLayer('dark-sky-zones-fill');
      }
      if (hasSource('dark-sky-zones')) {
        map.removeSource('dark-sky-zones');
      }
      layersInitialized.current = false;
    };
  }, [map, hasLayer, hasSource]);

  // Update layer visibility and opacity
  useEffect(() => {
    if (!map || !layersInitialized.current) return;

    const targetOpacity = visible ? opacity : 0;

    if (hasLayer('dark-sky-zones-fill')) {
      map.setPaintProperty('dark-sky-zones-fill', 'fill-opacity', targetOpacity * 0.6);
    }
    if (hasLayer('light-pollution-fill')) {
      map.setPaintProperty('light-pollution-fill', 'fill-opacity', targetOpacity);
    }
  }, [map, visible, opacity, hasLayer]);

  // Create dark sky site markers
  useEffect(() => {
    if (!map || !visible || !showSites) {
      cleanupMarkers();
      return;
    }

    // Create markers for each dark sky site
    DARK_SKY_SITES.forEach((site) => {
      const el = document.createElement('div');
      el.className = `dark-sky-marker bortle-${site.bortleClass}`;
      el.title = site.name;

      // Use React to render the icon
      const root = createRoot(el);
      root.render(<StarMarkerIcon bortleClass={site.bortleClass} />);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(site.coordinates)
        .addTo(map);

      // Create popup content safely using DOM methods
      const bortleInfo = BORTLE_DESCRIPTIONS[site.bortleClass];

      const createPopupContent = (): HTMLDivElement => {
        const container = document.createElement('div');
        container.className = `stargazing-popup ${isDark ? 'dark' : ''}`;

        // Header
        const header = document.createElement('div');
        header.className = 'popup-header';
        const starIcon = document.createElement('span');
        starIcon.className = 'popup-star';
        starIcon.textContent = '★';
        const title = document.createElement('h3');
        title.textContent = site.name;
        header.appendChild(starIcon);
        header.appendChild(title);
        container.appendChild(header);

        // Bortle badge
        const badge = document.createElement('div');
        badge.className = 'bortle-badge';
        badge.style.backgroundColor = BORTLE_COLORS[site.bortleClass];
        badge.style.color = site.bortleClass <= 4 ? '#fff' : '#000';
        badge.textContent = `Bortle ${site.bortleClass} - ${bortleInfo.description}`;
        container.appendChild(badge);

        // Description
        const desc = document.createElement('p');
        desc.className = 'popup-description';
        desc.textContent = site.description;
        container.appendChild(desc);

        // Facilities
        const facilities = document.createElement('div');
        facilities.className = 'popup-facilities';
        if (site.facilities.parking) {
          const tag = document.createElement('span');
          tag.className = 'facility-tag';
          tag.textContent = '🅿️ Parking';
          facilities.appendChild(tag);
        }
        if (site.facilities.camping) {
          const tag = document.createElement('span');
          tag.className = 'facility-tag';
          tag.textContent = '⛺ Camping';
          facilities.appendChild(tag);
        }
        if (site.facilities.restrooms) {
          const tag = document.createElement('span');
          tag.className = 'facility-tag';
          tag.textContent = '🚻 Restrooms';
          facilities.appendChild(tag);
        }
        container.appendChild(facilities);

        // Viewing notes
        const notes = document.createElement('p');
        notes.className = 'popup-notes';
        notes.textContent = site.viewingNotes;
        container.appendChild(notes);

        return container;
      };

      const popup = new maplibregl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: false,
        maxWidth: '320px',
      }).setDOMContent(createPopupContent());

      const handleMarkerClick = (e: MouseEvent) => {
        e.stopPropagation();

        if (currentPopupRef.current) {
          currentPopupRef.current.remove();
        }

        popup.setLngLat(site.coordinates).addTo(map);
        currentPopupRef.current = popup;

        if (onSiteClick) {
          onSiteClick(site);
        }
      };

      el.addEventListener('click', handleMarkerClick as EventListener);
      markersRef.current.push({ marker, element: el, handler: handleMarkerClick, root });
    });

    // Close popup when clicking on map
    const handleMapClick = () => {
      if (currentPopupRef.current) {
        currentPopupRef.current.remove();
        currentPopupRef.current = null;
      }
    };
    map.on('click', handleMapClick);

    return () => {
      cleanupMarkers();
      map.off('click', handleMapClick);
    };
  }, [map, visible, showSites, isDark, onSiteClick, cleanupMarkers]);

  const handleOpacityChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setOpacity(parseFloat(e.target.value));
  };

  // Get quality color
  const getQualityColor = (rating: string): string => {
    switch (rating) {
      case 'Excellent': return '#22c55e';
      case 'Good': return '#84cc16';
      case 'Fair': return '#eab308';
      case 'Poor': return '#ef4444';
      default: return '#6b7280';
    }
  };

  // Get moon phase CSS class
  const getMoonPhaseClass = (phaseName: string): string => {
    const normalized = phaseName.toLowerCase().replace(/\s+/g, '-');
    return normalized;
  };

  // Calculate quality meter stroke
  const meterRadius = 18;
  const meterCircumference = 2 * Math.PI * meterRadius;
  const meterOffset = meterCircumference - (qualityScore / 100) * meterCircumference;

  return (
    <div className={`stargazing-layer ${isDark ? 'dark' : ''}`}>
      <div className="section-content">
          {/* Tonight's Conditions - Hero Card */}
          <div className="stargazing-conditions">
            <div className="conditions-header">
              {/* Moon Phase Display */}
              <div className="moon-display">
                <div className={`moon-icon ${getMoonPhaseClass(moonPhase.phaseName)}`} />
                <div className="moon-info">
                  <span className="moon-phase-name">{moonPhase.phaseName}</span>
                  <span className="moon-illumination">{moonPhase.illumination}% illuminated</span>
                </div>
              </div>

              {/* Quality Score Meter */}
              <div className="quality-display">
                <div className="quality-meter">
                  <svg width="44" height="44" viewBox="0 0 44 44">
                    <circle
                      className="quality-meter-bg"
                      cx="22"
                      cy="22"
                      r={meterRadius}
                    />
                    <circle
                      className="quality-meter-fill"
                      cx="22"
                      cy="22"
                      r={meterRadius}
                      stroke={getQualityColor(qualityRating)}
                      strokeDasharray={meterCircumference}
                      strokeDashoffset={meterOffset}
                    />
                  </svg>
                  <span className="quality-meter-text">{qualityScore}</span>
                </div>
                <div className="quality-info">
                  <span
                    className="quality-rating"
                    style={{ backgroundColor: getQualityColor(qualityRating) }}
                  >
                    {qualityRating}
                  </span>
                  <span className="quality-label">Tonight</span>
                </div>
              </div>
            </div>
          </div>

          {/* Layer Toggle */}
          <div className="toggle-row">
            <label className="toggle-control">
              <input
                type="checkbox"
                checked={visible}
                onChange={() => setVisible(!visible)}
              />
              <span>Light Pollution</span>
            </label>
            <button
              className="visibility-toggle"
              onClick={() => setVisible(!visible)}
              title={visible ? 'Hide layer' : 'Show layer'}
              aria-label={visible ? 'Hide light pollution layer' : 'Show light pollution layer'}
              aria-pressed={visible}
            >
              {visible ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
          </div>

          {visible && (
            <>
              {/* Opacity Slider */}
              <div className="opacity-control">
                <label htmlFor="stargazing-opacity">Opacity</label>
                <input
                  id="stargazing-opacity"
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.1"
                  value={opacity}
                  onChange={handleOpacityChange}
                  aria-label="Light pollution overlay opacity"
                />
                <span>{Math.round(opacity * 100)}%</span>
              </div>

              {/* Sites Toggle */}
              <div className="toggle-row">
                <label className="toggle-control">
                  <input
                    type="checkbox"
                    checked={showSites}
                    onChange={() => setShowSites(!showSites)}
                  />
                  <MapPin size={14} />
                  <span>Dark Sky Sites ({DARK_SKY_SITES.length})</span>
                </label>
              </div>

              {/* Bortle Scale Legend */}
              <div className="bortle-legend">
                <div className="legend-title">Light Pollution (Bortle Scale)</div>
                <div className="legend-gradient">
                  {([2, 3, 4, 5, 6, 7] as BortleClass[]).map((bortle) => (
                    <div
                      key={bortle}
                      className="legend-segment"
                      style={{ backgroundColor: BORTLE_COLORS[bortle] }}
                      title={`Class ${bortle}: ${BORTLE_DESCRIPTIONS[bortle].description}`}
                    />
                  ))}
                </div>
                <div className="legend-labels">
                  <span>Darkest</span>
                  <span>Brightest</span>
                </div>
              </div>
            </>
          )}

          {/* Astronomy Events */}
          <AstronomyEvents isDark={isDark} />
        </div>
    </div>
  );
}
