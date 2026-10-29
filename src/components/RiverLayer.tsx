/**
 * River and lake gauges (VTL-81): NWS/USGS gauges in and along Vermont. A
 * gauge at or forecast to reach action stage or flooding takes the NWS
 * category color; gauges without a current reading are dimmed.
 */
import { memo } from 'react';
import { fetchRiverGauges, type RiverGauge } from '../services/riverApi';
import { useLayerData } from '../hooks/useLayerData';
import { useMapMarkers, type BuiltMarker } from '../hooks/useMapMarkers';
import { createMapMarker } from '../utils/mapMarker';
import { FLOOD_LEVELS, formatStage, isRiverReadingStale, worstCategory } from '../utils/rivers';
import type { MapLibreMap } from '../types';

interface RiverLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  onSelect: (gauge: RiverGauge) => void;
  /** Called after each successful fetch (search, shared links) */
  onLoaded?: (gauges: RiverGauge[]) => void;
}

/** The backend caches for 10 minutes; gauges report every 15-60 */
const REFRESH_MS = 10 * 60 * 1000;

// Lucide Droplet icon (hard-coded; white via currentColor)
const DROPLET_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>
  </svg>
`;

function buildRiverMarker(gauge: RiverGauge): BuiltMarker {
  const worst = worstCategory(gauge);
  const level = FLOOD_LEVELS[worst];
  const stale = isRiverReadingStale(gauge.observedAt);
  const forecastWorse = worst !== gauge.category;
  const status =
    gauge.stageFt === null
      ? 'no current reading'
      : `${formatStage(gauge.stageFt)}, ${FLOOD_LEVELS[gauge.category].name.toLowerCase()}`;
  const element = createMapMarker({
    layer: 'riverGauges',
    iconSvg: DROPLET_ICON,
    ...(level.color ? { statusFill: level.color } : {}),
    label: `River gauge: ${gauge.name}, ${status}${
      forecastWorse ? `; forecast ${level.name.toLowerCase()}` : ''
    }${stale && gauge.stageFt !== null ? ' (old reading)' : ''}`,
    title: forecastWorse ? `${gauge.name}: forecast ${level.name.toLowerCase()}` : gauge.name,
    dimmed: stale,
    className: ['river-marker', `flood-${worst}`, stale ? 'stale' : ''].filter(Boolean).join(' '),
  });
  return { lngLat: [gauge.lng, gauge.lat], element };
}

function RiverLayer({ map, visible, onSelect, onLoaded }: RiverLayerProps) {
  const gauges = useLayerData(!!map, fetchRiverGauges, REFRESH_MS, onLoaded, 'river gauges');
  useMapMarkers(map, visible, gauges, buildRiverMarker, onSelect);
  return null;
}

export default memo(RiverLayer);
