/**
 * Ski areas (Ski Vermont conditions). Shared markers (VTL-64): the fill shows
 * conditions (green/yellow/red, grey when not reporting) with the Ski layer's
 * sky-blue ring; clicking opens the area in the side panel.
 */
import { memo } from 'react';
import { fetchSkiResorts, type SkiResort } from '../services/skiApi';
import { useLayerData } from '../hooks/useLayerData';
import { useMapMarkers, type BuiltMarker } from '../hooks/useMapMarkers';
import { createMapMarker } from '../utils/mapMarker';
import { isSkiReporting, SKI_STATUS_FILL } from '../utils/skiStatus';
import type { MapLibreMap } from '../types';

interface SkiLayerProps {
  map: MapLibreMap | null;
  visible: boolean;
  onSelect: (resort: SkiResort) => void;
  /** Called after each successful fetch (shared links, search) */
  onLoaded?: (resorts: SkiResort[]) => void;
}

/** Conditions are scraped twice a day */
const REFRESH_MS = 6 * 60 * 60 * 1000;

// Lucide Mountain icon (hard-coded; white via currentColor)
const MOUNTAIN_ICON = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
  </svg>
`;

const CONDITION: Record<string, string> = {
  green: 'good conditions',
  yellow: 'decent conditions',
  red: 'limited conditions',
};

function buildSkiMarker(resort: SkiResort): BuiltMarker {
  const reporting = isSkiReporting(resort);
  const color = resort.color as keyof typeof SKI_STATUS_FILL;
  const fill = reporting ? (SKI_STATUS_FILL[color] ?? SKI_STATUS_FILL.yellow) : SKI_STATUS_FILL.off;
  const element = createMapMarker({
    layer: 'skiResorts',
    iconSvg: MOUNTAIN_ICON,
    statusFill: fill,
    label: `Ski area: ${resort.name}, ${reporting ? (CONDITION[resort.color] ?? 'conditions reported') : 'not reporting yet'}`,
    title: resort.name,
    className: 'ski-resort-marker',
  });
  return { lngLat: [resort.longitude, resort.latitude], element };
}

function SkiLayer({ map, visible, onSelect, onLoaded }: SkiLayerProps) {
  const resorts = useLayerData(!!map, fetchSkiResorts, REFRESH_MS, onLoaded, 'ski resorts');
  useMapMarkers(map, visible, resorts, buildSkiMarker, onSelect);
  return null;
}

export default memo(SkiLayer);
