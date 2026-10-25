import { useEffect, useRef, useState, useCallback } from 'react';
import { useMapMarkers, type BuiltMarker } from '../hooks/useMapMarkers';
import { createMapMarker } from '../utils/mapMarker';
import { textOn } from '../config/layers';
import { VERMONT_DARK_SKY_ZONES } from '../data/lightPollution';
import { DARK_SKY_SITES } from '../data/darkSkySites';
import { BORTLE_DESCRIPTIONS } from '../types/stargazing';
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

// Lucide Star icon as static SVG (one React root per marker was never safely unmounted)
function starMarkerSVG(bortleClass: BortleClass): string {
  const color = bortleClass <= 3 ? '#ffd700' : bortleClass <= 5 ? '#ffa500' : '#888888';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" style="width:17px;height:17px" fill="${color}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>`;
}

const noop = (): void => {};

function buildDarkSkyMarker(site: DarkSkySite): BuiltMarker {
  // Night-indigo circle in the Stargazing layer color; the star inside keeps
  // its gold/orange/grey sky-quality color
  const element = createMapMarker({
    layer: 'stargazing',
    iconSvg: starMarkerSVG(site.bortleClass),
    label: `Dark sky site: ${site.name}, Bortle ${site.bortleClass}`,
    title: site.name,
    className: `dark-sky-marker bortle-${site.bortleClass}`,
  });
  return { lngLat: site.coordinates, element };
}

export default function StargazingLayer({
  map,
  isDark = false,
  onSiteClick,
  cloudCoverPercent = 20,
}: StargazingLayerProps) {
  const [hoveredBortle, setHoveredBortle] = useState<BortleClass | null>(null);
  const layersInitialized = useRef(false);

  // Calculate current moon phase and stargazing quality
  const moonPhase = calculateMoonPhase();
  const { score: qualityScore, rating: qualityRating } = calculateStargazingScore(
    cloudCoverPercent,
    moonPhase.illumination,
  );

  // Helper to safely check if layer exists
  const hasLayer = useCallback(
    (layerId: string): boolean => {
      if (!map || !map.isStyleLoaded()) return false;
      try {
        return !!map.getLayer(layerId);
      } catch {
        return false;
      }
    },
    [map],
  );

  // Helper to safely check if source exists
  const hasSource = useCallback(
    (sourceId: string): boolean => {
      if (!map || !map.isStyleLoaded()) return false;
      try {
        return !!map.getSource(sourceId);
      } catch {
        return false;
      }
    },
    [map],
  );

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
            2,
            '#1a1a4e', // Deepest blue-purple (best skies)
            3,
            '#2d2d6b', // Rich blue (excellent skies)
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
            2,
            '#6366f1', // Indigo glow for class 2
            3,
            '#818cf8', // Lighter indigo for class 3
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

  // Dark sky site markers (shown whenever stargazing is on); clicking opens
  // the site in the side panel (VTL-64)
  useMapMarkers(map, true, DARK_SKY_SITES, buildDarkSkyMarker, onSiteClick ?? noop);

  // Get quality color
  const getQualityColor = (rating: string): string => {
    switch (rating) {
      case 'Excellent':
        return '#22c55e';
      case 'Good':
        return '#84cc16';
      case 'Fair':
        return '#eab308';
      case 'Poor':
        return '#ef4444';
      default:
        return '#6b7280';
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
                  <circle className="quality-meter-bg" cx="22" cy="22" r={meterRadius} />
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
                  style={{
                    backgroundColor: getQualityColor(qualityRating),
                    color: textOn(getQualityColor(qualityRating)),
                  }}
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
          Shaded zones show Vermont's darkest skies. Star markers indicate accessible viewing sites
          with parking.
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
                    color: '#fff',
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
