import { useEffect, useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import maplibregl from 'maplibre-gl';
import { Star } from 'lucide-react';
import { VERMONT_DARK_SKY_ZONES } from '../data/lightPollution';
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
  const [hoveredBortle, setHoveredBortle] = useState<BortleClass | null>(null);
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

    // Dark sky zones - show WHERE the dark skies are (the goal)
    // Rich blue/purple colors = excellent stargazing areas
    if (!hasSource('dark-sky-zones')) {
      map.addSource('dark-sky-zones', {
        type: 'geojson',
        data: VERMONT_DARK_SKY_ZONES,
      });

      // Fill layer with night-sky colors based on Bortle class
      map.addLayer({
        id: 'dark-sky-zones-fill',
        type: 'fill',
        source: 'dark-sky-zones',
        paint: {
          'fill-color': [
            'match',
            ['get', 'bortleClass'],
            2, '#1a1a4e',  // Deepest blue-purple (best skies)
            3, '#2d2d6b',  // Rich blue (excellent skies)
            '#2d2d6b',
          ],
          'fill-opacity': 0,
        },
      });

      // Subtle glow outline to make zones feel special
      map.addLayer({
        id: 'dark-sky-zones-outline',
        type: 'line',
        source: 'dark-sky-zones',
        paint: {
          'line-color': [
            'match',
            ['get', 'bortleClass'],
            2, '#6366f1',  // Indigo glow for class 2
            3, '#818cf8',  // Lighter indigo for class 3
            '#818cf8',
          ],
          'line-width': 2,
          'line-opacity': 0,
          'line-blur': 2,
        },
      });

      // Set initial opacity immediately (80% visibility)
      map.setPaintProperty('dark-sky-zones-fill', 'fill-opacity', 0.4);
      map.setPaintProperty('dark-sky-zones-outline', 'line-opacity', 0.56);
    }

    layersInitialized.current = true;

    return () => {
      // Cleanup dark sky layers
      if (hasLayer('dark-sky-zones-outline')) {
        map.removeLayer('dark-sky-zones-outline');
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

  // Set layer opacity (fixed at 80% for clear visibility)
  useEffect(() => {
    if (!map || !layersInitialized.current) return;

    const targetOpacity = 0.8;

    // Dark sky zone fills
    if (hasLayer('dark-sky-zones-fill')) {
      map.setPaintProperty('dark-sky-zones-fill', 'fill-opacity', targetOpacity * 0.5);
    }
    // Dark sky zone outlines (glowing border)
    if (hasLayer('dark-sky-zones-outline')) {
      map.setPaintProperty('dark-sky-zones-outline', 'line-opacity', targetOpacity * 0.7);
    }
  }, [map, hasLayer]);

  // Create dark sky site markers (always shown when stargazing is active)
  useEffect(() => {
    if (!map) {
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
  }, [map, isDark, onSiteClick, cleanupMarkers]);

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

          {/* Dark Sky Sites Description */}
          <p className="dark-sky-description">
            Shaded zones show Vermont's darkest skies. Star markers indicate accessible viewing sites with parking.
          </p>

          {/* Dark Sky Quality Legend */}
              <div className="bortle-legend">
                <div className="legend-title">Dark Sky Quality (Bortle Scale)</div>
                <div className="legend-gradient dark-sky-gradient">
                  {([2, 3] as BortleClass[]).map((bortle) => (
                    <div
                      key={bortle}
                      className={`legend-segment ${hoveredBortle === bortle ? 'active' : ''}`}
                      style={{ backgroundColor: bortle === 2 ? '#1a1a4e' : '#2d2d6b' }}
                      onMouseEnter={() => setHoveredBortle(bortle)}
                      onMouseLeave={() => setHoveredBortle(null)}
                      title={`Class ${bortle}: ${BORTLE_DESCRIPTIONS[bortle].description}`}
                    >
                      <span className="legend-segment-label">{bortle}</span>
                    </div>
                  ))}
                </div>
                <div className="legend-labels">
                  <span>Excellent</span>
                  <span>Very Good</span>
                </div>

                {/* Expanded detail on hover */}
                {hoveredBortle && (
                  <div className="bortle-detail">
                    <div className="bortle-detail-header">
                      <span
                        className="bortle-detail-badge"
                        style={{
                          backgroundColor: hoveredBortle === 2 ? '#1a1a4e' : '#2d2d6b',
                          color: '#fff'
                        }}
                      >
                        Bortle {hoveredBortle}
                      </span>
                      <span className="bortle-detail-name">
                        {BORTLE_DESCRIPTIONS[hoveredBortle].description}
                      </span>
                    </div>
                    <div className="bortle-detail-list">
                      <span className="bortle-detail-label">What you can see:</span>
                      <ul>
                        {BORTLE_DESCRIPTIONS[hoveredBortle].canSee.slice(0, 3).map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

          {/* Astronomy Events */}
          <AstronomyEvents isDark={isDark} />
        </div>
    </div>
  );
}
