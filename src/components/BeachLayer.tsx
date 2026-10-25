/**
 * Beaches with water-quality status. Shared markers (VTL-64): the fill shows
 * the status (open/alert/closed, grey when unmonitored or out of season) with
 * the Beaches layer's gold ring; clicking opens the beach in the side panel.
 */
import { memo } from 'react';
import { fetchBeaches, type Beach } from '../services/beachApi';
import { useLayerData } from '../hooks/useLayerData';
import { useMapMarkers, type BuiltMarker } from '../hooks/useMapMarkers';
import { createMapMarker } from '../utils/mapMarker';
import { getBeachDisplay } from '../utils/beachStatus';
import type { MapLibreMap } from '../types';

interface BeachLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  onSelect: (beach: Beach) => void;
  /** Called after each successful fetch (shared links, search) */
  onLoaded?: (beaches: Beach[]) => void;
}

/** Matches the backend cache */
const REFRESH_MS = 12 * 60 * 60 * 1000;

// Lucide Waves icon (hard-coded; white via currentColor)
const WAVES_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
    <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
    <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>
  </svg>
`;

/** Marker fills: darker than the badge colors so the white icon reads */
const STATUS_FILL: Record<string, string> = {
  open: '#15803d',
  alert: '#a16207',
  closed: '#dc2626',
};

function buildBeachMarker(beach: Beach): BuiltMarker {
  const display = getBeachDisplay(beach);
  const element = createMapMarker({
    layer: 'beachSites',
    iconSvg: WAVES_ICON,
    statusFill: STATUS_FILL[display.state] ?? '#64748b',
    label: `Beach: ${beach.name}, ${display.label.toLowerCase()}`,
    title: beach.name,
    className: `beach-marker beach-${display.state}`,
  });
  return { lngLat: [beach.longitude, beach.latitude], element };
}

function BeachLayer({ map, visible, onSelect, onLoaded }: BeachLayerProps) {
  const beaches = useLayerData(!!map, fetchBeaches, REFRESH_MS, onLoaded, 'beaches');
  useMapMarkers(map, visible, beaches, buildBeachMarker, onSelect);
  return null;
}

export default memo(BeachLayer);
